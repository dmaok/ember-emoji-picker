import Component from '@ember/component';
import { run } from '@ember/runloop';
import { computed, observer } from '@ember/object';
import layout from '../templates/components/emoji-picker';
import detectEmojiSupport from 'detect-emoji-support';
import { allEmoji, CATEGORIES, DEFAULT_TRANSLATIONS, EMOJI_BY_CATEGORIES, emojiHash } from '../data';
import icons from '../svg';
import $ from 'jquery';
import { storageFor } from 'ember-local-storage/helpers/storage';

const RECENT_KEY = 'recent';

export default Component.extend({
  recent: storageFor('recent'),

  doesClientSupportsEmoji: detectEmojiSupport(),
  maxSearchResultsCount: 84,

  showRecent: true,
  maxRecentCount: 21,

  init() {
    this._super(...arguments);

    const
      emojiByCategories = EMOJI_BY_CATEGORIES,
      categories = [];

    if (this.get('showRecent')) {
      this._getRecentEmoji();

      categories.push({
        name: RECENT_KEY,
        icon: icons[RECENT_KEY]
      });
    }

    categories.push(...CATEGORIES.map(name => ({
      name,
      icon: icons[name]
    })));

    this.setProperties(Object.assign({}, {
      emojiByCategories,
      categories,
    }));

    if (!this.get('texts')) {
      this.set('texts', DEFAULT_TRANSLATIONS);
    }

    this._checkScroll = this._checkScroll.bind(this);
  },

  _activeCategory: 0,
  _searchQuery: null,
  _searchQueryFormatted: computed('_searchQuery', function() {
    const querySrc = this.get('_searchQuery');
    if (!querySrc || !querySrc.length) return null;

    const query = querySrc.trim();

    if (!query.length) return null;

    return formatString(query);
  }),

  _isSearchMode: computed('_searchQueryFormatted', function() {
    return !!this.get('_searchQueryFormatted');
  }),

  _searchObserver: observer('_isSearchMode', function() {
    //for nano scroll
    run.next(() => $(window).trigger('resize'));

    this.get('$scroller').scrollTop(0);

    if (!this.get('_isSearchMode')) {
      this.set('_activeCategory', 0);
      this._onLeaveSearch();
    }
  }),

  _onLeaveSearch() {
    this._getRecentEmoji();
  },

  _searchResults: computed('_searchQueryFormatted', function() {
    const query = this.get('_searchQueryFormatted');

    if (!query) return;

    const
      scores = {};

    allEmoji
      .forEach(emoji => {
        const
          { name, keywords } = emoji,
          incrementScore = (name, incrementBy = 1) => {
            if (typeof scores[name] === 'undefined') {
              scores[name] = 0;
            }

            scores[name] += incrementBy;
          };

        query.forEach((string, i) => {
          let wasScored = false;
          const nameSubIndex = formatString(name).join(' ').indexOf(string);
          if (i > 0 && typeof scores[name] === 'undefined') return;

          if (~nameSubIndex) {
            wasScored = true;
            incrementScore(name, 100 - nameSubIndex);
          }

          keywords.forEach(keyword => {
            const keywordSubIndex = keyword.indexOf(string);
            if (~keywordSubIndex) {
              wasScored = true;
              incrementScore(name, (100 - keywordSubIndex) / 100);
            }
          });

          if (i > 0 && !wasScored) {
            delete scores[name];
          }
        });
      });

    return Object.keys(scores)
      .map(name => Object.assign({}, { name }, emojiHash[name]))
      .sort(({ name: name1 }, { name: name2 }) => scores[name2] - scores[name1])
      .slice(0, this.get('maxSearchResultsCount'));
  }),

  _getRecentEmoji() {
    const emoji = Object.entries(this.get('recent.content'))
      .sort((entry1, entry2) => entry2[1] - entry1[1])
      .map(([name]) => Object.assign({ name }, emojiHash[name]))
      .slice(0, this.get('maxRecentCount'));

    this.set('recentEmoji', { name: RECENT_KEY, emoji });
  },

  didInsertElement() {
    this._super(...arguments);

    this.renderAllEmojisList();

    const
      $scroller = $('.nano-content'),
      $categories = $('.js-eep-select-section');

    this.setProperties({
      $scroller,
      $categories
    });

    $scroller.on('scroll', this._checkScroll);

    //refresh nanoscroller
    $('.nano').nanoScroller();
  },

  renderAllEmojisList() {
    const
      dom = document.createDocumentFragment(),
      texts = this.get('texts');

    const emojiByCategories = this.get('emojiByCategories');

    for (let i = 0; i < emojiByCategories.length; i++) {
      const
        category = emojiByCategories[i],
        emojis = category.emoji,
        section = document.createElement('div'),
        categoryName = texts && texts.categories && texts.categories[category.name] || category.name;

      section.setAttribute('class', 'eep-select-section js-eep-select-section');

      section.innerHTML = `
        <div class="eep-select-section__name js-eep-select-section-name">${categoryName}</div>
        <div class="eep-select-section__emoji">
          <div class="eep-symbols">
            
          </div>
        </div>
      `;

      const symbolsWrapper = section.querySelector('.eep-symbols');

      for (let i = 0; i < emojis.length; i++) {
        const
          emoji = emojis[i],
          element = document.createElement('div');

        element.setAttribute('class', 'eep-symbols__item eep-emoji-font');
        element.addEventListener('click', () => this.send('selectEmoji', emoji));
        element.innerHTML = `<span>${emoji.char}</span>`;

        symbolsWrapper.appendChild(element);
      }

      dom.appendChild(section);
    }

    $('.js-emoji-sections-wrap').get(0).appendChild(dom);
  },

  _checkScroll() {
    if (this.get('_isSearchMode')) return;

    const $categories = this.get('$categories');
    let activeCategory = 0;

    $categories.each((i, element) => {
      if ($(element).position().top <= 2) {
        activeCategory = i;
      }
    });

    this.set('_activeCategory', activeCategory);
  },

  _updateRecent(emoji) {
    const
      stored = this.get('recent.content'),
      timeStamp = Date.now();

    stored[emoji.name] = timeStamp;

    const
      entries = Object.entries(stored);

    if (entries.length > this.get('maxRecentCount')) {
      const sorted = entries.sort((entry1, entry2) => entry2[1] - entry1[1]);

      this.get('recent').clear();
      for (let i = 0; i < this.get('maxRecentCount'); i++) {
        const [name, stamp] = sorted[i];

        this.set(`recent.${name}`, stamp);
      }
    } else {
      this.set(`recent.${emoji.name}`, timeStamp);
    }
  },

  actions: {
    selectEmoji(emoji) {
      this.onSelectEmoji(emoji);

      this._updateRecent(emoji);
    },

    navigate(categoryIndex) {
      this._getRecentEmoji();

      const
        { $scroller, $categories } = this.getProperties('$scroller', '$categories'),
        scrollToCategory = () => {
          $scroller.scrollTop($categories.eq(categoryIndex).position().top + $scroller.scrollTop());
        };

      if (this.get('_isSearchMode')) {
        this.set('_searchQuery', null);
        this._onLeaveSearch();
        run.next(scrollToCategory);
      } else {
        scrollToCategory();
      }
    }
  },

  layout
});

const formatString = string => string.toLowerCase().split(/[\s|,|\-|_|:]+/).filter(word => word.length);



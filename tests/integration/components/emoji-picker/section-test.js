import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('emoji-picker/section', 'Integration | Component | emoji picker/section', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{emoji-picker/section}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#emoji-picker/section}}
      template block text
    {{/emoji-picker/section}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the production TypeScript helpers without adding a test runner dependency.
const source = await readFile(new URL('../src/sdui/businessInteraction.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }}).outputText;
const { uniqueBusinessName, renamePageReferences, renameMenuActionReferences, removeMenuItemBinding } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function draft() {
  return {
    uis: [{ key: 'menu', template: 'menu_section', fields: { items: [
      { label: 'A', token: '@a' }, { label: 'B', token: '@b' }, { label: 'C', token: '@c' }
    ] }}],
    flows: [
      { key: 'a', entry: { kind: 'device', ui: 'menu', interaction: 'menu.item.1' }, steps: [] },
      { key: 'b', entry: { kind: 'device', ui: 'menu', interaction: 'menu.item.2' }, steps: [{ action: 'ui.show', ui: 'details' }] },
      { key: 'c', entry: { kind: 'device', ui: 'menu', interaction: 'menu.item.3' }, steps: [{ action: 'ui.show', ui: 'menu' }] },
      { key: 'button', entry: { kind: 'device', ui: 'menu', interaction: 'button.pwr.long_press' }, steps: [] },
      { key: 'elsewhere', entry: { kind: 'device', ui: 'other-menu', interaction: 'menu.item.3' }, steps: [] }
    ]
  };
}

test('creation allocates a unique default after deletion or rename', () => {
  assert.equal(uniqueBusinessName('环节', ['环节1', '环节3', '自定义名称']), '环节2');
  assert.equal(uniqueBusinessName('页面', ['页面1', '页面2']), '页面3');
});

test('page rename updates trigger pages and navigation targets together', () => {
  const definition = draft();
  renamePageReferences(definition, 'menu', '主菜单');
  assert.equal(definition.flows[0].entry.ui, '主菜单');
  assert.equal(definition.flows[2].steps[0].ui, '主菜单');
  assert.equal(definition.flows[1].steps[0].ui, 'details');
  assert.equal(definition.flows[4].entry.ui, 'other-menu');
});

test('menu action rename updates only the exact action reference', () => {
  const definition = draft();
  renameMenuActionReferences(definition, 'b', '打开详情');
  assert.deepEqual(definition.uis[0].fields.items.map(item => item.token), ['@a', '@打开详情', '@c']);
});

test('deleting a menu item preserves the next item action and other page bindings', () => {
  const definition = draft();
  definition.uis[0].fields.items.splice(1, 1);
  removeMenuItemBinding(definition, definition.uis[0], 1);
  assert.equal(definition.flows[1].entry.interaction, '');
  assert.equal(definition.flows[2].entry.interaction, 'menu.item.2');
  assert.equal(definition.uis[0].fields.items[1].token, '@c');
  assert.equal(definition.flows[3].entry.interaction, 'button.pwr.long_press');
  assert.equal(definition.flows[4].entry.interaction, 'menu.item.3');
});

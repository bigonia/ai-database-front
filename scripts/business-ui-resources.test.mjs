import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function compileModule(path, sourceOverride) {
  const source = sourceOverride ?? await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}

const interactionUrl = await compileModule('../src/sdui/businessInteraction.ts');
const resourcesSource = (await readFile(new URL('../src/sdui/businessUiResources.ts', import.meta.url), 'utf8'))
  .replace("'@/sdui/businessInteraction'", `'${interactionUrl}'`);
const resourcesUrl = await compileModule('', resourcesSource);
const {
  addUiArrayItem, createUiResource, moveUiResource, removeUiArrayItem, removeUiResource,
  renameUiResource, replaceUiTemplate, uiArrayBounds, uiArrayBoundsLabel, uiRemovalReferences
} = await import(resourcesUrl);

function definition() {
  return {
    id: 'business-1', name: 'Draft', description: '', devices: { local: {}}, mirror: false,
    uis: [
      { key: 'menu', owner: 'local', template: 'menu_section', fields: { items: [{ token: '@first' }, { token: '@second' }] }},
      { key: 'details', owner: 'local', template: 'text', fields: {}}
    ],
    flows: [
      { key: 'first', entry: { kind: 'device', ui: 'menu', interaction: 'menu.item.1' }, steps: [] },
      { key: 'second', entry: { kind: 'device', ui: 'menu', interaction: 'menu.item.2' }, steps: [{ action: 'ui.show', ui: 'details' }] }
    ]
  };
}

test('UI creation allocates a unique key and adds a local resource', () => {
  const draft = definition();
  draft.uis[1].key = '页面1';
  const created = createUiResource(draft, 'text', { title: '' });
  assert.equal(created.key, '页面2');
  assert.equal(created.owner, 'local');
  assert.equal(draft.uis.at(-1), created);
});

test('UI rename validates names and updates device and page references', () => {
  const draft = definition();
  const ui = draft.uis[0];
  assert.equal(renameUiResource(draft, ui, ' details '), 'invalid');
  assert.equal(renameUiResource(draft, ui, ' menu '), 'unchanged');
  assert.equal(renameUiResource(draft, ui, ' 主菜单 '), 'renamed');
  assert.equal(draft.flows[0].entry.ui, '主菜单');
  assert.equal(draft.flows[1].steps[0].ui, 'details');
});

test('UI reorder changes initial UI order and rejects indexes outside the list', () => {
  const draft = definition();
  assert.equal(moveUiResource(draft, 1, -1), true);
  assert.deepEqual(draft.uis.map(ui => ui.key), ['details', 'menu']);
  assert.equal(moveUiResource(draft, 0, -1), false);
  assert.equal(moveUiResource(draft, 2, 1), false);
});

test('changing a UI template replaces fields and clears its device interaction', () => {
  const draft = definition();
  replaceUiTemplate(draft, draft.uis[0], 'text', { title: 'new' });
  assert.equal(draft.uis[0].template, 'text');
  assert.deepEqual(draft.uis[0].fields, { title: 'new' });
  assert.equal(draft.flows[0].entry.interaction, '');
  assert.equal(draft.flows[1].entry.interaction, '');
});

test('menu item add and removal keep remaining action ordinals aligned', () => {
  const draft = definition();
  addUiArrayItem(draft.uis[0], 'items', { token: '' });
  assert.equal(draft.uis[0].fields.items.length, 3);
  assert.equal(removeUiArrayItem(draft, draft.uis[0], 'items', 0), true);
  assert.equal(draft.flows[0].entry.interaction, '');
  assert.equal(draft.flows[1].entry.interaction, 'menu.item.1');
  assert.equal(draft.uis[0].fields.items[0].token, '@second');
  assert.equal(removeUiArrayItem(draft, draft.uis[0], 'items', 20), false);
});

test('UI removal references are reported and deleting the resource leaves flow references for validation', () => {
  const draft = definition();
  assert.deepEqual(uiRemovalReferences(draft, 'menu'), ['first 的设备触发器', 'second 的设备触发器']);
  assert.equal(removeUiResource(draft, 'menu'), 0);
  assert.equal(removeUiResource(draft, 'missing'), -1);
  assert.equal(draft.uis[0].key, 'details');
  assert.equal(draft.flows[0].entry.ui, 'menu');
});

test('array limits use template constraints and explain missing limits', () => {
  const template = { constraints: { items_min: 1, items_max: 4 }};
  assert.deepEqual(uiArrayBounds(template, 'items'), { min: 1, max: 4 });
  assert.equal(uiArrayBoundsLabel(template, 'items'), '1～4 项');
  assert.equal(uiArrayBoundsLabel(undefined, 'points'), '目录未声明项数限制');
});

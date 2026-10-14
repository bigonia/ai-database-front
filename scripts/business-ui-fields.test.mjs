import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/businessUiFields.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const {
  byteLengthHint, defaultArrayItem, defaultFieldValue, defaultFieldsFor,
  hasConfiguredUiFields, isOutsideLengthBounds, utf8ByteLength
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('UI field defaults honor declared values, numeric bounds, and minimum array sizes', () => {
  assert.equal(defaultFieldValue({ name: 'count', type: 'integer', min: 2, max: 5 }), 2);
  assert.equal(defaultFieldValue({ name: 'enabled', type: 'boolean' }), false);
  assert.deepEqual(defaultFieldValue({ name: 'items', type: 'array' }, 2, () => 'item'), ['item', 'item']);
  const original = { nested: true };
  const result = defaultFieldValue({ name: 'config', type: 'object', defaultValue: original });
  assert.notEqual(result, original);
  assert.deepEqual(result, original);
});

test('nested array defaults and field maps are composed from template fields', () => {
  const field = { name: 'point', type: 'array', children: [{ name: 'x', type: 'number', min: 1 }] };
  assert.deepEqual(defaultArrayItem(field, child => defaultFieldValue(child)), { x: 1 });
  assert.deepEqual(defaultFieldsFor([field], item => item.name), { point: 'point' });
});

test('UI field presence and UTF-8 length helpers match editor bounds', () => {
  assert.equal(hasConfiguredUiFields({ empty: '', list: [], object: {}}), false);
  assert.equal(hasConfiguredUiFields({ value: 0 }), true);
  assert.equal(utf8ByteLength('中文'), 6);
  assert.equal(isOutsideLengthBounds('中文', 7, 9), true);
  assert.equal(isOutsideLengthBounds('中文', 2, 6), false);
  assert.equal(byteLengthHint('中文', 2, 6), '6 / 2～6 UTF-8 bytes');
});

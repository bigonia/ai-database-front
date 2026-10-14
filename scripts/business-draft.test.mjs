import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/businessDraft.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { definitionSnapshot, parseBusinessPayload, parseBusinessResources } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function payload() {
  return {
    businessId: 'business-1',
    revision: 2,
    definition: {
      id: 'business-1', name: '业务', description: '', devices: { local: {}}, mirror: false,
      uis: [{ key: 'home', owner: 'local', template: 'text', fields: {}}],
      flows: [{ key: 'start', entry: { kind: 'device', ui: 'home' }, steps: [] }]
    }
  };
}

test('business draft parser binds payload identity and rejects malformed or duplicate definitions', () => {
  assert.equal(parseBusinessPayload(payload(), 'business-1').revision, 2);
  assert.throws(() => parseBusinessPayload(payload(), 'other-business'));
  const duplicate = payload();
  duplicate.definition.uis.push({ ...duplicate.definition.uis[0] });
  assert.throws(() => parseBusinessPayload(duplicate, 'business-1'));
  const invalidStep = payload();
  invalidStep.definition.flows[0].steps.push({ action: '' });
  assert.throws(() => parseBusinessPayload(invalidStep, 'business-1'));
});

test('business draft parser normalizes optional editor maps before exposing the typed draft', () => {
  const input = payload();
  input.definition.flows[0].entry = { kind: 'external' };
  input.definition.flows[0].steps.push({ action: 'display.image.show' });
  const { definition } = parseBusinessPayload(input, 'business-1');
  assert.deepEqual(definition.flows[0].entry, {
    kind: 'external', values: {}, valueDescriptions: {}
  });
  assert.deepEqual(definition.flows[0].steps[0].with, {});
  assert.deepEqual(definition.flows[0].steps[0].bind, {});
});

test('resource parser checks owner identity and every referenced value shape', () => {
  const resources = {
    businessId: 'business-1',
    uis: [{ key: 'home', owner: 'local', template: 'text', initial: true, origin: 'definition', referencedBy: [] }],
    values: [{ name: 'result', type: 'text', flowKey: 'start', origin: 'step:1', fromTrigger: false, transient: false }]
  };
  assert.equal(parseBusinessResources(resources, 'business-1'), resources);
  assert.throws(() => parseBusinessResources(resources, 'other-business'));
  assert.throws(() => parseBusinessResources({ ...resources, values: [{ ...resources.values[0], transient: 'false' }] }, 'business-1'));
});

test('definition snapshot isolates editor changes from the accepted server state', () => {
  const original = payload().definition;
  const snapshot = definitionSnapshot(original);
  snapshot.uis[0].fields.title = 'changed';
  assert.equal(original.uis[0].fields.title, undefined);
});

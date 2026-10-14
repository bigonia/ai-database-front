import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/flowResources.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }}).outputText;
const { collectFlowResources, availableFlowResources, registerStepResources, normalizeRecordingProducts } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const actions = [{ action: 'audio.record', out: { result: 'product' }}];
function draft() {
  return { flows: [
    { key: 'capture', entry: { kind: 'external', values: { request: 'text' }}, steps: [
      { action: 'audio.record', produces: {}}, { action: 'audio.play', produces: {}},
      { action: 'audio.record', produces: {}}
    ] },
    { key: 'other', steps: [{ action: 'audio.record', produces: { result: '@other.sound' }}] }
  ] };
}

test('registers one product per recording with stable unique names', () => {
  const value = draft(); const flow = value.flows[0];
  registerStepResources(flow, 0, actions[0].out);
  registerStepResources(flow, 2, actions[0].out);
  registerStepResources(flow, 0, actions[0].out);
  assert.deepEqual(flow.steps[0].produces, { result: '@capture.采集结果' });
  assert.deepEqual(flow.steps[2].produces, { result: '@capture.采集结果2' });
});

test('only current-flow trigger values and preceding products are selectable', () => {
  const value = draft(); const flow = value.flows[0];
  registerStepResources(flow, 0, actions[0].out); registerStepResources(flow, 2, actions[0].out);
  const resources = collectFlowResources(value, actions);
  assert.deepEqual(availableFlowResources(resources, 'capture', 0).map(item => item.reference), ['@capture.request']);
  assert.deepEqual(availableFlowResources(resources, 'capture', 1).map(item => item.reference),
    ['@capture.request', '@capture.采集结果']);
  assert.deepEqual(availableFlowResources(resources, 'capture', 2).map(item => item.reference),
    ['@capture.request', '@capture.采集结果']);
  assert.deepEqual(availableFlowResources(resources, 'other', 0), []);
});

test('saved capture consumers use the same product for UI text and original audio', () => {
  const value = { flows: [{ key: 'talk', steps: [
    { action: 'ui.show', bind: { text: '@' }},
    { action: 'audio.record', produces: { audio: '@talk.recording', text: '@talk.transcript' }},
    { action: 'ui.show', bind: { text: '@talk.transcript' }},
    { action: 'audio.play', with: { text: '@talk.transcript' }}
  ] }] };
  normalizeRecordingProducts(value);
  assert.deepEqual(value.flows[0].steps[0].bind, {});
  assert.deepEqual(value.flows[0].steps[1].produces, { result: '@talk.recording' });
  assert.equal(value.flows[0].steps[2].bind.text, '@talk.recording');
  assert.deepEqual(value.flows[0].steps[3].with, { source: '@talk.recording' });
  const snapshot = JSON.stringify(value);
  normalizeRecordingProducts(value);
  assert.equal(JSON.stringify(value), snapshot);
});

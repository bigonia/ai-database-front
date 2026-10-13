import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/flowResources.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { collectFlowResources, availableFlowResources, registerStepResources } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const actions = [{ action: 'audio.record', out: { audio: 'audio', text: 'text' } }];
function draft() {
  return { flows: [
    { key: 'capture', entry: { kind: 'external', values: { request: 'text' } }, steps: [
      { action: 'audio.record', produces: {} }, { action: 'audio.play', produces: {} },
      { action: 'audio.record', produces: {} }
    ] },
    { key: 'other', steps: [{ action: 'audio.record', produces: { audio: '@other.sound' } }] }
  ] };
}

test('registers both capture outputs with stable unique names and no dependency on step positions', () => {
  const value = draft(); const flow = value.flows[0];
  registerStepResources(flow, 0, actions[0].out);
  registerStepResources(flow, 2, actions[0].out);
  registerStepResources(flow, 0, actions[0].out);
  assert.deepEqual(flow.steps[0].produces, { audio: '@capture.采集音频', text: '@capture.识别文本' });
  assert.deepEqual(flow.steps[2].produces, { audio: '@capture.采集音频2', text: '@capture.识别文本2' });
});

test('all flows and producer positions are available with type filtering', () => {
  const value = draft(); const flow = value.flows[0];
  registerStepResources(flow, 0, actions[0].out); registerStepResources(flow, 2, actions[0].out);
  const resources = collectFlowResources(value, actions);
  const expected = ['@capture.采集音频', '@capture.采集音频2', '@other.sound'];
  assert.deepEqual(availableFlowResources(resources, 'capture', 0, 'audio').map(item => item.reference), expected);
  assert.deepEqual(availableFlowResources(resources, 'other', 99, 'audio').map(item => item.reference), expected);
  assert.equal(availableFlowResources(resources, 'other', 0, 'text').length, 3);
});

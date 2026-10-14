import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function compile(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of replacements) source = source.replace(from, to);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}

const requestUrl = await compile('../src/sdui/debugRequests.ts');
const moduleUrl = await compile('../src/sdui/debugRecording.ts', [
  ["'@/sdui/debugRequests'", `'${requestUrl}'`]
]);
const { sendDebugRecordingCommand, loadDebugRecordingResult } = await import(moduleUrl);

function commandResult(overrides = {}) {
  return { requestId: 'req-1', name: 'audio.capture.start', ok: true, declared: true, reachable: true, extra: {}, ...overrides };
}

test('recording command returns a parsed result after recording history', async () => {
  const events = [];
  const result = await sendDebugRecordingCommand({
    deviceId: 'device-1', isCurrent: () => true, send: async () => commandResult(),
    onResult: async value => { events.push(value.requestId); }
  });
  assert.equal(result.kind, 'success');
  assert.deepEqual(events, ['req-1']);
});

test('recording command reports rejection and malformed responses', async () => {
  const rejected = await sendDebugRecordingCommand({
    deviceId: 'device-1', isCurrent: () => true,
    send: async () => commandResult({ ok: false, error: '设备忙' }), onResult: async () => {}
  });
  assert.deepEqual(rejected, { kind: 'failure', message: '设备忙' });
  const malformed = await sendDebugRecordingCommand({
    deviceId: 'device-1', isCurrent: () => true, send: async () => ({}), onResult: async () => {}
  });
  assert.equal(malformed.kind, 'failure');
  assert.match(malformed.message, /响应结构无效/);
});

test('recording command ignores device changes during send or history refresh', async () => {
  let current = 'device-1';
  const duringSend = await sendDebugRecordingCommand({
    deviceId: 'device-1', isCurrent: id => id === current,
    send: async () => { current = 'device-2'; return commandResult(); }, onResult: async () => {}
  });
  assert.deepEqual(duringSend, { kind: 'stale' });
  current = 'device-1';
  const duringRefresh = await sendDebugRecordingCommand({
    deviceId: 'device-1', isCurrent: id => id === current, send: async () => commandResult(),
    onResult: async () => { current = 'device-2'; }
  });
  assert.deepEqual(duringRefresh, { kind: 'stale' });
});

test('transcription result maps fields and prefers explicit errors', async () => {
  const result = await loadDebugRecordingResult({
    deviceId: 'device-1', isCurrent: () => true,
    read: async () => ({ text: 'recognized', artifactId: 'artifact-1', error: '', transcriptionError: 'no speech' })
  });
  assert.deepEqual(result, { kind: 'success', value: { text: 'recognized', artifactId: 'artifact-1', error: 'no speech' }});
});

test('transcription result handles read failures and stale device changes', async () => {
  const failed = await loadDebugRecordingResult({
    deviceId: 'device-1', isCurrent: () => true, read: async () => { throw new Error('network down'); }
  });
  assert.deepEqual(failed, { kind: 'failure', message: 'network down' });
  const stale = await loadDebugRecordingResult({
    deviceId: 'device-1', isCurrent: () => false, read: async () => ({ text: 'late result' })
  });
  assert.deepEqual(stale, { kind: 'stale' });
  const malformed = await loadDebugRecordingResult({
    deviceId: 'device-1', isCurrent: () => true, read: async () => null
  });
  assert.equal(malformed.kind, 'failure');
});

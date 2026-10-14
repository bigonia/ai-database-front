import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugRequests.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const {
  loadDebugHistoryDetail, loadDebugRequestDirectory, loadDebugRequestHistory,
  parseAvailableRequests, parseJournalEntry, parseRequestHistory, parseRequestResult
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function requestDirectory() {
  return {
    deviceId: 'device-1', online: true,
    requests: [{
      name: 'system.volume.set', usableIn: ['debug'], usableInBinding: false, usableInRequest: true,
      params: [{ name: 'value', type: 'integer', required: true, min: 0, max: 100, unit: '%', values: [0, 50, 100] }],
      parameters: [{ name: 'value', type: 'integer', required: true, min: 0, max: 100 }],
      parametersSource: 'schema'
    }]
  };
}

function historyEntry() {
  return {
    requestId: 'request-1', name: 'system.volume.set', params: { value: 50 }, ok: true,
    declared: true, detail: { result: 'ok' }, at: '2026-10-13T00:00:00Z'
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('request directory parsing binds device identity and validates parameter contracts', () => {
  const directory = requestDirectory();
  assert.equal(parseAvailableRequests(directory, 'device-1'), directory);
  assert.throws(() => parseAvailableRequests(directory, 'device-2'), /响应结构无效/);
  assert.throws(() => parseAvailableRequests({ ...directory, requests: [...directory.requests, directory.requests[0]] }, 'device-1'), /条目结构无效/);
  assert.throws(() => parseAvailableRequests({
    ...directory,
    requests: [{ ...directory.requests[0], params: [{ name: 'value', type: 'integer', min: 10, max: 2 }] }]
  }, 'device-1'), /条目结构无效/);
  assert.throws(() => parseAvailableRequests({
    ...directory,
    requests: [{ ...directory.requests[0], params: [{ name: 'value', type: 'integer', values: ['loud'] }] }]
  }, 'device-1'), /条目结构无效/);
});

test('request results require transport and device outcome fields', () => {
  const result = {
    requestId: 'request-1', name: 'system.reboot', ok: true, declared: true,
    reachable: true, extra: { code: 0 }
  };
  assert.equal(parseRequestResult(result), result);
  assert.throws(() => parseRequestResult({ ...result, extra: null }), /响应结构无效/);
});

test('history parsing validates device identity and journal row structure', () => {
  const entry = historyEntry();
  assert.equal(parseJournalEntry(entry), true);
  assert.deepEqual(parseRequestHistory({ deviceId: 'device-1', history: [entry] }, 'device-1'), [entry]);
  assert.equal(parseJournalEntry({ ...entry, params: [] }), false);
  assert.throws(() => parseRequestHistory({ deviceId: 'device-2', history: [entry] }, 'device-1'), /响应结构无效/);
  assert.throws(() => parseRequestHistory({ deviceId: 'device-1', history: [{ ...entry, ok: 'yes' }] }, 'device-1'), /响应结构无效/);
});

test('request and history reads ignore responses that arrive after the device generation changes', async () => {
  const gate = deferred();
  let current = true;
  const readRequest = {
    deviceId: 'device-1', generation: 4, isCurrent: () => current, read: () => gate.promise
  };
  const directoryRead = loadDebugRequestDirectory(readRequest);
  current = false;
  gate.resolve(requestDirectory());
  assert.deepEqual(await directoryRead, { kind: 'stale' });

  const historyRead = await loadDebugRequestHistory({
    deviceId: 'device-1', generation: 5, isCurrent: () => true,
    read: async () => ({ deviceId: 'device-1', history: [historyEntry()] })
  });
  assert.deepEqual(historyRead, { kind: 'success', value: [historyEntry()] });
});

test('current read failures are reported and stale failures are discarded', async () => {
  const currentFailure = await loadDebugRequestDirectory({
    deviceId: 'device-1', generation: 1, isCurrent: () => true,
    read: async () => { throw new Error('offline'); }
  });
  const staleFailure = await loadDebugRequestDirectory({
    deviceId: 'device-1', generation: 1, isCurrent: () => false,
    read: async () => { throw new Error('offline'); }
  });
  assert.deepEqual(currentFailure, { kind: 'failure', message: 'offline' });
  assert.deepEqual(staleFailure, { kind: 'stale' });
});

test('history detail loader requires the selected request identity', async () => {
  const outcome = await loadDebugHistoryDetail({
    deviceId: 'device-1', generation: 1, isCurrent: () => true,
    read: async () => historyEntry()
  }, 'request-2');
  assert.deepEqual(outcome, { kind: 'failure', message: '请求详情响应结构无效' });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/terminalRuntime.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createTerminalRuntimeLoader, parseTerminalRuntimeStatus } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const status = (deviceId = 'device-a', ids = ['lighting', 'dashboard']) => ({
  deviceId,
  online: true,
  observedAt: '2026-10-10T08:00:00Z',
  configuration: { confirmation: 'confirmed' },
  view: { kind: 'section', sceneId: 'lighting-home', deploymentId: 'lighting', sectionType: 'menu', snapshotAvailable: true },
  businesses: ids.map(id => ({ deploymentId: id, businessId: id, businessName: id, deploymentSerial: 1 }))
});

test('runtime parser binds the device and validates business and view ownership', () => {
  assert.deepEqual(parseTerminalRuntimeStatus(status(), 'device-a'), status());
  assert.throws(() => parseTerminalRuntimeStatus(status(), 'device-b'));
  assert.throws(() => parseTerminalRuntimeStatus(status('device-a', ['lighting', 'lighting']), 'device-a'));
  assert.throws(() => parseTerminalRuntimeStatus({ ...status(), view: { ...status().view, deploymentId: 'missing' }}, 'device-a'));
});

function createHarness(initial = null) {
  let deviceId = 'device-a';
  let current = initial;
  let loading = false;
  let error = '';
  const requests = [];
  const loader = createTerminalRuntimeLoader({
    getDeviceId: () => deviceId,
    getCurrent: () => current,
    read: requestedDevice => new Promise((resolve, reject) => requests.push({ requestedDevice, resolve, reject })),
    parse: parseTerminalRuntimeStatus,
    setValue: value => { current = value; },
    setLoading: value => { loading = value; },
    setError: value => { error = value; },
    message: cause => cause instanceof Error ? cause.message : ''
  });
  return {
    ...loader,
    requests,
    value: () => current,
    isLoading: () => loading,
    error: () => error,
    selectDevice: value => { deviceId = value; }
  };
}

test('late runtime status from a previous device cannot replace the active device status', async () => {
  const harness = createHarness();
  const previous = harness.load();
  harness.selectDevice('device-b');
  const current = harness.load();
  harness.requests[0].resolve(status('device-a'));
  await previous;
  assert.equal(harness.value(), null);
  assert.equal(harness.isLoading(), true);
  harness.requests[1].resolve(status('device-b'));
  await current;
  assert.equal(harness.value().deviceId, 'device-b');
  assert.equal(harness.isLoading(), false);
});

test('refresh failures preserve the last observed runtime status', async () => {
  const harness = createHarness(status());
  const pending = harness.load();
  harness.requests[0].reject(new Error('network failed'));
  await pending;
  assert.equal(harness.value().deviceId, 'device-a');
  assert.match(harness.error(), /上次读取的状态/);
  assert.equal(harness.isLoading(), false);
});

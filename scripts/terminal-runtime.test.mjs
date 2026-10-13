import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const api = await readFile(new URL('../src/api/terminal-runtime.ts', import.meta.url), 'utf8');
const apiAst = ts.createSourceFile('api.ts', api, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = (ast, names) => names.map(name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast)).join('\n');
const parser = functions(apiAst, ['record', 'parseTerminalRuntimeStatus']);
const vue = await readFile(new URL('../src/views/sdui/terminal/TerminalDetail.vue', import.meta.url), 'utf8');
const ast = ts.createSourceFile('terminal.ts', vue.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const methods = functions(ast, ['applyRuntimeStatus', 'moveBusinessOrder', 'saveBusinessOrder', 'loadRuntimeStatus']);
const harness = `${parser}
export function createHarness(initial) {
  const runtimeStatus = {value: initial}, deviceId = {value: 'device'}, businessOrderIds = {value: initial.businesses.map(item => item.deploymentId)};
  const runtimeStatusLoading = {value: false}, runtimeStatusError = {value: ''}, businessOrderSaving = {value: false};
  let runtimeStatusRequestId = 0;
  const businessOrderDirty = {get value() { return businessOrderIds.value.join('|') !== runtimeStatus.value.businesses.map(item => item.deploymentId).join('|'); }};
  const requests = [], messages = [];
  const getTerminalRuntimeStatus = device => new Promise((resolve, reject) => requests.push({device, resolve, reject}));
  const saveTerminalBusinessOrder = (device, order) => new Promise((resolve, reject) => requests.push({device, order, resolve, reject}));
  const ElMessage = {success: message => messages.push(message)};
  ${methods}
  return {runtimeStatus, deviceId, businessOrderIds, runtimeStatusLoading, runtimeStatusError, businessOrderSaving, businessOrderDirty, requests, messages, loadRuntimeStatus, moveBusinessOrder, saveBusinessOrder};
}`;
const compiled = ts.transpileModule(harness, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {parseTerminalRuntimeStatus, createHarness} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const status = (ids = ['lighting', 'dashboard']) => ({
  deviceId: 'device', online: true, observedAt: '2026-10-10T08:00:00Z',
  configuration: {confirmation: 'confirmed'},
  view: {kind: 'section', sceneId: 'lighting-home', deploymentId: 'lighting', sectionType: 'menu', snapshotAvailable: true},
  businesses: ids.map(id => ({deploymentId: id, businessId: id, businessName: id, deploymentSerial: 1}))
});

test('accepts unified runtime data and rejects wrong device, duplicate order, or unknown view owner', () => {
  assert.deepEqual(parseTerminalRuntimeStatus(status(), 'device'), status());
  assert.throws(() => parseTerminalRuntimeStatus(status(), 'other'));
  assert.throws(() => parseTerminalRuntimeStatus(status(['lighting', 'lighting']), 'device'));
  assert.throws(() => parseTerminalRuntimeStatus({...status(), view: {...status().view, deploymentId: 'missing'}}, 'device'));
});

test('changing order keeps the saved primary until the server acknowledges', async () => {
  const h = createHarness(status());
  h.moveBusinessOrder(1, -1);
  assert.equal(h.businessOrderDirty.value, true);
  assert.equal(h.runtimeStatus.value.businesses[0].deploymentId, 'lighting');
  const pending = h.saveBusinessOrder();
  assert.deepEqual(h.requests[0].order, ['dashboard', 'lighting']);
  h.moveBusinessOrder(0, 1);
  assert.deepEqual(h.businessOrderIds.value, ['dashboard', 'lighting']);
  h.requests[0].resolve({data: status(['dashboard', 'lighting'])});
  await pending;
  assert.equal(h.runtimeStatus.value.businesses[0].deploymentId, 'dashboard');
  assert.equal(h.businessOrderDirty.value, false);
  assert.equal(h.businessOrderSaving.value, false);
});

test('save failure preserves pending order and the saved primary', async () => {
  const h = createHarness(status());
  h.moveBusinessOrder(1, -1);
  const pending = h.saveBusinessOrder();
  h.requests[0].reject(new Error('device_offline'));
  await pending;
  assert.equal(h.runtimeStatus.value.businesses[0].deploymentId, 'lighting');
  assert.equal(h.businessOrderDirty.value, true);
  assert.match(h.runtimeStatusError.value, /device_offline/);
});

test('responses from a previous device do not replace the current status', async () => {
  const h = createHarness(status());
  const pending = h.loadRuntimeStatus();
  h.deviceId.value = 'other';
  h.requests[0].resolve({data: status(['dashboard', 'lighting'])});
  await pending;
  assert.equal(h.runtimeStatus.value.businesses[0].deploymentId, 'lighting');
});

test('refresh failure preserves the last status and reports it as stale', async () => {
  const h = createHarness(status());
  const pending = h.loadRuntimeStatus();
  h.requests[0].reject(new Error('network failed'));
  await pending;
  assert.equal(h.runtimeStatus.value.businesses.length, 2);
  assert.match(h.runtimeStatusError.value, /上次读取/);
  assert.equal(h.runtimeStatusLoading.value, false);
});

test('offline terminals cannot submit a changed business order', async () => {
  const h = createHarness({...status(), online: false});
  h.moveBusinessOrder(1, -1);
  await h.saveBusinessOrder();
  assert.equal(h.requests.length, 0);
});

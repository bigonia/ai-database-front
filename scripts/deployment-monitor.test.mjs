import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/deploymentMonitor.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createDeploymentRecordLoader } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function createHarness() {
  let deploymentId = 'A';
  let records = [];
  let total = 0;
  let loading = false;
  let error = '';
  const requests = [];
  const loader = createDeploymentRecordLoader({
    getDeploymentId: () => deploymentId,
    getPage: () => 0,
    pageSize: 20,
    read: id => new Promise((resolve, reject) => requests.push({ deploymentId: id, resolve, reject })),
    parse: row => row,
    belongsToDeployment: (row, id) => row.deploymentId === id,
    setRecords: value => { records = value; },
    setTotal: value => { total = value; },
    setLoading: value => { loading = value; },
    setError: value => { error = value; },
    getErrorMessage: cause => cause instanceof Error ? cause.message : ''
  });
  return {
    ...loader,
    requests,
    state: () => ({ deploymentId, records, total, loading, error }),
    selectDeployment: id => { deploymentId = id; }
  };
}

const response = deploymentId => ({
  data: { deploymentId, totalElements: 1, runs: [{ deploymentId, runId: deploymentId }] }
});

test('switching deployments discards a slow response from the previous deployment', async () => {
  const harness = createHarness();
  const first = harness.loadRecords();
  harness.selectDeployment('B');
  const second = harness.loadRecords();
  harness.requests[0].resolve(response('A'));
  await first;
  assert.deepEqual(harness.state().records, []);
  assert.equal(harness.state().loading, true);
  harness.requests[1].resolve(response('B'));
  await second;
  assert.equal(harness.state().records[0].deploymentId, 'B');
  assert.equal(harness.state().loading, false);
});

test('refresh failure retains previously observed records and exposes the error', async () => {
  const harness = createHarness();
  const initial = harness.loadRecords();
  harness.requests[0].resolve(response('A'));
  await initial;
  const refresh = harness.loadRecords();
  harness.requests[1].reject(new Error('offline'));
  await refresh;
  assert.equal(harness.state().records[0].runId, 'A');
  assert.equal(harness.state().error, 'offline');
  assert.equal(harness.state().loading, false);
});

test('a response containing another deployment is rejected before replacing displayed records', async () => {
  const harness = createHarness();
  const request = harness.loadRecords();
  harness.requests[0].resolve({
    data: { deploymentId: 'A', totalElements: 1, runs: [{ deploymentId: 'B', runId: 'B' }] }
  });
  await request;
  assert.deepEqual(harness.state().records, []);
  assert.match(harness.state().error, /不属于此部署/);
});

test('deactivation invalidates an in-flight monitoring request', async () => {
  const harness = createHarness();
  let active = true;
  const pending = harness.loadRecords(() => active);
  harness.invalidate();
  active = false;
  harness.requests[0].resolve(response('A'));
  await pending;
  assert.deepEqual(harness.state().records, []);
  assert.equal(harness.state().loading, false);
});

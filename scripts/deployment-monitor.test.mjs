import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const vue = await readFile(new URL('../src/views/sdui/business/DeploymentDetail.vue', import.meta.url), 'utf8');
const source = vue.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('monitor.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const loadRecords = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'loadRecords').getText(ast);
const harness = `
export function createHarness() {
 let recordsRequest = 0;
 const deploymentId = {value: 'A'}, records = {value: []}, recordsLoading = {value: false}, recordsError = {value: ''};
 const requests = [];
 const dataOf = response => response.data;
 const parseBusinessRun = row => row;
 const getDeploymentRuns = (deployment) => new Promise((resolve, reject) => requests.push({deployment, resolve, reject}));
 ${loadRecords}
 return {loadRecords, deploymentId, records, recordsLoading, recordsError, requests};
}`;
const compiled = ts.transpileModule(harness, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {createHarness} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const response = deployment => ({data: {deploymentId: deployment, count: 1, runs: [{deploymentId: deployment, runId: deployment}]}});

test('switching deployments discards a slow response from the previous deployment', async () => {
 const h = createHarness();
 const first = h.loadRecords();
 h.deploymentId.value = 'B';
 const second = h.loadRecords();
 h.requests[0].resolve(response('A'));
 await first;
 assert.deepEqual(h.records.value, []);
 assert.equal(h.recordsLoading.value, true);
 h.requests[1].resolve(response('B'));
 await second;
 assert.equal(h.records.value[0].deploymentId, 'B');
 assert.equal(h.recordsLoading.value, false);
});

test('refresh failure retains previously observed records and exposes the error', async () => {
 const h = createHarness();
 const initial = h.loadRecords(); h.requests[0].resolve(response('A')); await initial;
 const refresh = h.loadRecords(); h.requests[1].reject(new Error('offline')); await refresh;
 assert.equal(h.records.value[0].runId, 'A');
 assert.equal(h.recordsError.value, 'offline');
 assert.equal(h.recordsLoading.value, false);
});

test('a response containing another deployment is rejected before replacing the displayed records', async () => {
 const h = createHarness();
 const request = h.loadRecords();
 h.requests[0].resolve({data: {deploymentId: 'A', count: 1, runs: [{deploymentId: 'B'}]}});
 await request;
 assert.deepEqual(h.records.value, []);
 assert.match(h.recordsError.value, /不属于此部署/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';

const source = await readFile(new URL('../src/sdui/deploymentExport.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createDeploymentExportController } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const vue = await readFile(new URL('../src/views/sdui/business/DeploymentDetail.vue', import.meta.url), 'utf8');
const { descriptor } = parse(vue);

function createHarness({ failure, confirmFailure, holdConfirmation } = {}) {
  let deploymentId = 'dep';
  let generation = 1;
  const deployment = { deploymentId: 'dep', businessId: 'biz', businessName: 'Business', status: 'active', slotBindings: { local: 'device' }};
  let loading = false;
  let error = '';
  let credential = null;
  let businessExport = null;
  let visible = false;
  const calls = [];
  let releaseConfirmation;
  const confirmation = new Promise(resolve => { releaseConfirmation = resolve; });
  const template = { businessId: 'biz', tenantId: 'tenant', instructions: 'usage', instances: [{ deviceId: 'device', credential: '' }] };
  const exported = { deploymentId: 'dep', businessId: 'biz', deviceId: 'device', tenantId: 'tenant', credential: 'xc_new', triggers: ['generate'], endpoint: '/api/v1/sdui/businesses/biz/triggers/{triggerName}' };
  const controller = createDeploymentExportController({
    getDeployment: () => deployment,
    getDeploymentId: () => deploymentId,
    getGeneration: () => generation,
    isBusy: () => loading,
    confirm: async() => {
      if (confirmFailure) throw confirmFailure;
      if (holdConfirmation) await confirmation;
    },
    isCancellation: cause => cause === 'cancel',
    message: cause => cause instanceof Error ? cause.message : '',
    readTemplate: async id => { calls.push('template'); if (id !== 'dep') throw new Error('wrong deployment'); if (failure) throw failure; return { data: template }; },
    rotateCredential: async() => { calls.push('rotate'); return { data: exported }; },
    dataOf: response => response?.data,
    setLoading: value => { loading = value; },
    setError: value => { error = value; },
    setCredential: value => { credential = value; },
    setBusinessExport: value => { businessExport = value; },
    setVisible: value => { visible = value; },
    notifySuccess: () => {}
  });
  return {
    ...controller,
    releaseConfirmation,
    calls,
    state: () => ({ loading, error, credential, businessExport, visible }),
    refresh: () => { generation++; controller.invalidate(); },
    selectDeployment: id => { deploymentId = id; }
  };
}

test('failed generation exposes the server error and allows a retry without rotating credentials', async() => {
  const harness = createHarness({ failure: new Error('此部署没有外部触发器') });
  await harness.exportIntegration();
  assert.equal(harness.state().error, '此部署没有外部触发器');
  assert.equal(harness.state().loading, false);
  assert.equal(harness.state().visible, false);
  assert.deepEqual(harness.calls, ['template']);
  await harness.exportIntegration();
  assert.deepEqual(harness.calls, ['template', 'template']);
});

test('generation errors render beside the button even when the result dialog is closed', () => {
  const template = baseParse(descriptor.template.content);
  const ancestors = [];
  let found = false;
  function visit(node) {
    if (node.type === 1) {
      if (node.tag === 'el-alert' && node.props.some(prop => prop.type === 7 && prop.name === 'if' && prop.exp?.content === 'exportError')) {
        assert.ok(ancestors.includes('el-collapse-item'));
        assert.ok(!ancestors.includes('el-dialog'));
        found = true;
      }
      ancestors.push(node.tag);
    }
    for (const child of node.children || []) visit(child);
    if (node.type === 1) ancestors.pop();
  }
  visit(template);
  assert.ok(found);
});

test('successful generation opens the dialog with the new credential in the template', async() => {
  const harness = createHarness();
  await harness.exportIntegration();
  assert.deepEqual(harness.calls, ['template', 'rotate']);
  assert.equal(harness.state().visible, true);
  assert.equal(harness.state().businessExport.instances[0].credential, 'xc_new');
  assert.equal(harness.state().loading, false);
});

test('pending confirmation prevents duplicate generation and refresh from discarding the export', async() => {
  const harness = createHarness({ holdConfirmation: true });
  const pending = harness.exportIntegration();
  assert.equal(harness.state().loading, true);
  await harness.exportIntegration();
  harness.refresh();
  harness.releaseConfirmation();
  await pending;
  assert.deepEqual(harness.calls, ['template', 'rotate']);
  assert.equal(harness.state().visible, true);
});

test('canceling confirmation releases the button without making export requests', async() => {
  const harness = createHarness({ confirmFailure: 'cancel' });
  await harness.exportIntegration();
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.state().loading, false);
  assert.equal(harness.state().error, '');
});

test('changing deployments while generation is pending discards its response', async() => {
  const harness = createHarness();
  const pending = harness.exportIntegration();
  harness.selectDeployment('other');
  await pending;
  assert.equal(harness.state().visible, false);
  assert.deepEqual(harness.calls, ['template']);
});

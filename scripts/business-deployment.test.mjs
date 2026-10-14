import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/businessDeployment.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const {
  canStartBusinessDeployment,
  executeBusinessDeployment,
  isDeploymentFrozen,
  isInstallResult
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const frozen = {
  deploymentId: 'deployment-1', businessId: 'business-1', localDeviceId: 'device-a',
  targetDeviceIds: ['device-b'], triggers: [], initialRunDuplicate: false
};

function installation(offline = false) {
  return {
    deploymentId: frozen.deploymentId,
    offline: offline ? 1 : 0,
    succeeded: offline ? 1 : 2,
    failed: 0,
    devices: [
      { deviceId: 'device-a', role: 'local', status: 'ok', error: null },
      { deviceId: 'device-b', role: 'target', status: offline ? 'skipped' : 'ok', error: offline ? 'device_offline' : null }
    ]
  };
}

function attempt(overrides = {}) {
  let current = true;
  const value = {
    businessId: 'business-1', generation: 1,
    isCurrent: () => current,
    isDirty: () => false,
    getValidation: () => ({ ok: true, errorCount: 0, warningCount: 0, problems: [] }),
    getValidationError: () => '',
    getBindings: () => ({ revision: 3, localDeviceId: 'device-a', targetDeviceId: 'device-b', hasTarget: true }),
    validate: async () => true,
    setCurrent: value => { current = value; },
    ...overrides
  };
  return value;
}

test('deployment receipt and device results must match the requested binding snapshot', () => {
  const bindings = { localDeviceId: 'device-a', targetDeviceId: 'device-b' };
  assert.equal(isDeploymentFrozen(frozen, 'business-1', bindings), true);
  assert.equal(isDeploymentFrozen({ ...frozen, businessId: 'other' }, 'business-1', bindings), false);
  assert.equal(isInstallResult(installation(), frozen.deploymentId, frozen), true);
  assert.equal(isInstallResult({ ...installation(), succeeded: 9 }, frozen.deploymentId, frozen), false);
});

test('one deployment attempt submits once and accepts the validated device results', async () => {
  const calls = [];
  const result = await executeBusinessDeployment(attempt(), async (businessId, bindings) => {
    calls.push({ businessId, bindings });
    return { data: { deployment: frozen, installation: installation() }};
  });
  assert.equal(result.kind, 'success');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    businessId: 'business-1',
    bindings: { expectedRevision: 3, localDeviceId: 'device-a', targetDeviceId: 'device-b' }
  });
});

test('offline targets remain part of the deployment receipt and report as skipped', async () => {
  const result = await executeBusinessDeployment(attempt(), async () => ({
    data: { deployment: frozen, installation: installation(true) }
  }));
  assert.equal(result.kind, 'success');
  assert.equal(result.result.installation.offline, 1);
  assert.equal(result.result.installation.devices[1].status, 'skipped');
});

test('an uncertain freeze response blocks another deployment attempt', async () => {
  const value = attempt();
  let outcomeUnknown = false;
  let calls = 0;
  const result = await executeBusinessDeployment(value, async () => {
    calls += 1;
    throw new Error('network');
  });
  if (result.kind === 'failure' && result.outcomeUnknown) outcomeUnknown = true;
  assert.equal(result.kind, 'failure');
  assert.equal(outcomeUnknown, true);
  assert.equal(canStartBusinessDeployment({ loading: false, deploymentId: '', outcomeUnknown }), false);
  assert.equal(calls, 1);
});

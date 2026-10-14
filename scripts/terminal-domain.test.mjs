import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import ts from 'typescript';

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const telemetry = await loadModule('../src/sdui/terminalTelemetry.ts');
const status = await loadModule('../src/sdui/businessStatus.ts');
const runs = await loadModule('../src/sdui/businessRuns.ts');

const snapshot = {
  wifi: { rssi: -60, ip: '192.0.2.1' },
  memory: {
    freeHeapInternal: 100, largestHeapInternal: 100, freeHeapDma: 100, largestHeapDma: 100,
    freeHeapPsram: 100, largestHeapPsram: 100, freeHeapTotal: 300,
    fragInternalPct: 10, fragDmaPct: 10, fragPsramPct: 10
  },
  temperature: { celsius: 35 },
  power: {
    supported: true, batteryMv: 4000, batteryPct: 80, charging: false,
    extPowerPresent: false, extPowerCtrl: false, extPowerOn: false
  },
  uptimeS: 120,
  lastHeartbeatAt: '2026-10-13T00:00:00Z'
};

test('shared telemetry parser accepts nullable measurements and rejects malformed fields', () => {
  assert.equal(telemetry.isTelemetrySnapshot(snapshot), true);
  assert.equal(telemetry.isTelemetrySnapshot(null), true);
  const malformedMemory = { ...snapshot.memory, freeHeapTotal: '300' };
  const malformedPower = { ...snapshot.power, charging: 1 };
  assert.equal(telemetry.isTelemetrySnapshot({ ...snapshot, memory: malformedMemory }), false);
  assert.equal(telemetry.isTelemetrySnapshot({ ...snapshot, power: malformedPower }), false);
});

test('shared status presentation keeps unknown states visible and maps known states consistently', () => {
  assert.equal(status.runStatusLabel('failed'), '失败');
  assert.equal(status.runStatusType('failed'), 'danger');
  assert.equal(status.deploymentDeviceStatusLabel('uninstall_pending'), '卸载中');
  assert.equal(status.deploymentDeviceStatusType('uninstall_failed'), 'danger');
  assert.equal(status.deploymentStatusLabel('new_backend_state'), 'new_backend_state');
  assert.deepEqual(status.deploymentResultSummary(['ok', 'failed', 'installing']), [
    { label: '1 已安装', type: 'success' },
    { label: '1 失败', type: 'danger' },
    { label: '1 处理中', type: 'warning' }
  ]);
  assert.deepEqual(status.deploymentResultSummary([]), [{ label: '等待结果', type: 'warning' }]);
});

test('run parser validates object identity, step summaries, and aggregate status', () => {
  const run = {
    runId: 'run-1', businessId: 'business-1', deploymentId: 'deployment-1', deviceId: 'device-1',
    flowKey: 'main', triggerSource: 'button', invocationId: 'invocation-1', status: 'passed',
    stoppedAtIndex: null, stoppedAtAction: null, error: null,
    stepSummaries: [{ index: 0, action: 'screen.show', target: 'local', status: 'ok', detail: {}}],
    startedAt: '2026-10-13T00:00:00Z', completedAt: '2026-10-13T00:00:01Z'
  };
  assert.deepEqual(runs.parseBusinessRun(run, 'run-1', 'device-1'), run);
  assert.throws(() => runs.parseBusinessRun(run, 'other-run', 'device-1'));
  assert.throws(() => runs.parseBusinessRun({ ...run, stoppedAtIndex: 0 }));
  assert.deepEqual(runs.parseRecentBusinessRuns({ deviceId: 'device-1', count: 1, runs: [run] }, 'device-1').runs, [run]);
});

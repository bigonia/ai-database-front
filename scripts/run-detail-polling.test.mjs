import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/runPolling.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createRunPolling } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function createHarness() {
  let active = true;
  let runId = 'run-a';
  let generation = 1;
  let running = true;
  const timers = [];
  const cleared = [];
  let loads = 0;
  const polling = createRunPolling({
    isActive: () => active,
    getRunId: () => runId,
    getGeneration: () => generation,
    isRunning: () => running,
    load: () => { loads++; },
    setTimer: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimer: timer => cleared.push(timer)
  });
  return {
    ...polling,
    timers,
    cleared,
    loads: () => loads,
    deactivate: () => { active = false; generation++; polling.clear(); },
    setRun: (nextId, isRunning = true) => { runId = nextId; running = isRunning; generation++; }
  };
}

test('cached run detail does not poll after deactivation invalidates its timer', () => {
  const harness = createHarness();
  harness.schedule('run-a', 1);
  harness.deactivate();
  harness.timers[0].callback();
  assert.equal(harness.loads(), 0);
  assert.deepEqual(harness.cleared, [1]);
});

test('active run detail schedules a refresh only for its current run generation', () => {
  const harness = createHarness();
  harness.schedule('run-a', 1);
  assert.equal(harness.timers[0].delay, 2000);
  harness.timers[0].callback();
  assert.equal(harness.loads(), 1);
});

test('run changes and completed runs cannot trigger stale polling', () => {
  const harness = createHarness();
  harness.schedule('run-a', 1);
  harness.setRun('run-b');
  harness.timers[0].callback();
  harness.schedule('run-b', 2);
  harness.setRun('run-b', false);
  harness.schedule('run-b', 3);
  assert.equal(harness.timers.length, 2);
  assert.equal(harness.loads(), 0);
});

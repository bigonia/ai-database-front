import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugViewTransfer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { completeDebugViewTransfer, sendDebugCanvasTransfer, uploadDebugImageTransfer } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('image transfer opens, sends and completes in order, with identity checks', async () => {
  const events = [];
  const result = await uploadDebugImageTransfer({
    deviceId: 'device-1', isCurrent: () => true,
    prepareFrame: async () => { events.push('prepare'); return new Blob(['pixels']); },
    openIfNeeded: true,
    openSession: async () => { events.push('open'); return { ok: true }; },
    onSessionOpened: () => events.push('opened'),
    sendFrame: async frame => { events.push(`send:${frame.size}`); return { ok: true }; },
    completeSession: async () => { events.push('complete'); return { ok: true }; }
  });
  assert.deepEqual(result, { kind: 'success', value: undefined });
  assert.deepEqual(events, ['prepare', 'open', 'opened', 'send:6', 'complete']);
});

test('image transfer skips opening an existing session and returns step failures', async () => {
  const calls = [];
  const result = await uploadDebugImageTransfer({
    deviceId: 'device-1', isCurrent: () => true,
    prepareFrame: async () => new Blob(['frame']), openIfNeeded: false,
    openSession: async () => { calls.push('open'); return { ok: true }; }, onSessionOpened: () => {},
    sendFrame: async () => ({ ok: false, error: 'upload failed' }),
    completeSession: async () => { calls.push('complete'); return { ok: true }; }
  });
  assert.deepEqual(result, { kind: 'failure', message: 'upload failed' });
  assert.deepEqual(calls, []);
});

test('canvas transfer checks stale responses, pacing, stop requests, and frame counts', async () => {
  const events = [];
  let now = 0;
  const result = await sendDebugCanvasTransfer({
    deviceId: 'device-1', isCurrent: () => true,
    openSession: async () => ({ ok: true }), onSessionOpened: () => events.push('opened'),
    frames: [new Uint8Array([1]), new Uint8Array([2])], interval: 100, frameInterval: 50,
    shouldStop: () => false, now: () => now,
    wait: async delay => { events.push(`wait:${delay}`); now += delay; },
    sendFrame: async frame => { events.push(`send:${frame[0]}`); now += 20; return { ok: true }; },
    onFrameSent: count => events.push(`count:${count}`)
  });
  assert.deepEqual(result, { kind: 'success', value: { sentCount: 2, stopped: false }});
  assert.deepEqual(events, ['opened', 'send:1', 'count:1', 'wait:80', 'send:2', 'count:2', 'wait:110']);

  const stale = await sendDebugCanvasTransfer({
    deviceId: 'device-1', isCurrent: () => false,
    openSession: async () => ({ ok: true }), onSessionOpened: () => {}, frames: [],
    interval: 0, frameInterval: 0, shouldStop: () => false, now: () => 0,
    wait: async () => {}, sendFrame: async () => ({ ok: true }), onFrameSent: () => {}
  });
  assert.deepEqual(stale, { kind: 'stale' });
});

test('view completion reports failures and ignores stale completion', async () => {
  assert.deepEqual(await completeDebugViewTransfer({
    deviceId: 'device-1', isCurrent: () => true, completeSession: async () => ({ ok: false, error: 'device rejected' })
  }), { kind: 'failure', message: 'device rejected' });
  assert.deepEqual(await completeDebugViewTransfer({
    deviceId: 'device-1', isCurrent: () => false, completeSession: async () => ({ ok: true })
  }), { kind: 'stale' });
});

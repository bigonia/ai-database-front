import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugAudio.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { encodeDebugPcm16, formatDebugAudioReceipt, sendDebugAudioCommand } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('audio command returns a validated receipt and formats send progress', async () => {
  const result = await sendDebugAudioCommand({
    deviceId: 'device-1', isCurrent: () => true,
    send: async () => ({ ok: true, bytesSent: 120, framesSent: 3 }), failureMessage: 'audio failed'
  });
  assert.deepEqual(result, { kind: 'success', receipt: { bytesSent: 120, framesSent: 3 }});
  assert.equal(formatDebugAudioReceipt('播放完成', result.receipt), '播放完成：发送 120 字节 / 3 帧');
});

test('PCM encoding clamps samples and writes signed 16 bit little endian values', () => {
  const view = new DataView(encodeDebugPcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2])));
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => view.getInt16(index * 2, true)), [-32768, -32768, 0, 16384, 32767, 32767]);
});

test('audio command maps device errors, transport errors, and stale responses', async () => {
  const rejected = await sendDebugAudioCommand({
    deviceId: 'device-1', isCurrent: () => true,
    send: async () => ({ ok: false, error: '设备忙' }), failureMessage: 'audio failed'
  });
  assert.deepEqual(rejected, { kind: 'failure', message: '设备忙' });
  const failed = await sendDebugAudioCommand({
    deviceId: 'device-1', isCurrent: () => true,
    send: async () => { throw new Error('network down'); }, failureMessage: 'audio failed'
  });
  assert.deepEqual(failed, { kind: 'failure', message: 'network down' });
  const stale = await sendDebugAudioCommand({
    deviceId: 'device-1', isCurrent: () => false,
    send: async () => ({ ok: true }), failureMessage: 'audio failed'
  });
  assert.deepEqual(stale, { kind: 'stale' });
});

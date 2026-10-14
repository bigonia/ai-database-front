import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugViewState.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { parseDebugViewState } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function baseState(mode = 'none') {
  return {
    deviceId: 'device-1', online: true, mode,
    imageBytesReceived: 0, canvasFramesReceived: 0, canvasFramesRejected: 0
  };
}

test('view state accepts idle and internally consistent image and canvas sessions', () => {
  const idle = baseState();
  assert.equal(parseDebugViewState(idle, 'device-1'), idle);
  const image = {
    ...baseState('image'), imageBytesReceived: 12,
    imageSpec: { width: 16, height: 16, paletteSize: 2, expectedBytes: 32 }
  };
  const canvas = {
    ...baseState('canvas'), canvasFramesReceived: 3,
    canvasSpec: { width: 32, height: 32, paletteSize: 4, maxFps: 10 }
  };
  assert.equal(parseDebugViewState(image, 'device-1'), image);
  assert.equal(parseDebugViewState(canvas, 'device-1'), canvas);
});

test('view state binds the requested device and rejects malformed counters or specs', () => {
  assert.throws(() => parseDebugViewState(baseState(), 'device-2'), /主视图状态响应结构无效/);
  assert.throws(() => parseDebugViewState({ ...baseState(), canvasFramesRejected: -1 }, 'device-1'), /主视图状态响应结构无效/);
  assert.throws(() => parseDebugViewState({
    ...baseState('image'), imageBytesReceived: 33,
    imageSpec: { width: 16, height: 16, paletteSize: 2, expectedBytes: 32 }
  }, 'device-1'), /图片视图会话规格或接收计数无效/);
  assert.throws(() => parseDebugViewState({
    ...baseState('canvas'), canvasSpec: { width: 32, height: 16, paletteSize: 4, maxFps: 10 }
  }, 'device-1'), /Canvas 视图会话规格结构无效/);
  assert.throws(() => parseDebugViewState({
    ...baseState(), imageSpec: { width: 16, height: 16, paletteSize: 2, expectedBytes: 32 }
  }, 'device-1'), /非活动视图携带了活动会话规格/);
});

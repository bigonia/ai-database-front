import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugCanvas.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createDebugCanvasPlaybackPlan, getDebugPixelPosition, packDebugPixelIndexes, paintDebugPixelLine, undoDebugPixelStroke } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('pixel coordinates map the canvas bounds and reject outside pointer positions', () => {
  const bounds = { left: 10, top: 20, right: 50, bottom: 60, width: 40, height: 40 };
  assert.deepEqual(getDebugPixelPosition({ clientX: 10, clientY: 20, bounds, size: 4 }), { x: 0, y: 0 });
  assert.deepEqual(getDebugPixelPosition({ clientX: 49.9, clientY: 59.9, bounds, size: 4 }), { x: 3, y: 3 });
  assert.equal(getDebugPixelPosition({ clientX: 50, clientY: 30, bounds, size: 4 }), null);
});

test('pixel strokes interpolate gaps, record only changed pixels, and undo in reverse', () => {
  const pixels = new Uint8Array(16);
  const changes = [];
  paintDebugPixelLine(pixels, 4, 1, 2, { x: 0, y: 1 }, { x: 3, y: 1 }, changes);
  assert.deepEqual([...pixels.slice(4, 8)], [2, 2, 2, 2]);
  assert.equal(changes.length, 4);
  paintDebugPixelLine(pixels, 4, 1, 2, { x: 0, y: 1 }, { x: 3, y: 1 }, changes);
  assert.equal(changes.length, 4);
  undoDebugPixelStroke(pixels, changes);
  assert.deepEqual([...pixels.slice(4, 8)], [0, 0, 0, 0]);
});

test('pixel indexes pack in network bit order for 1, 2, and 4 bit depths', () => {
  assert.deepEqual([...packDebugPixelIndexes(new Uint8Array([0, 1, 1]), 1)], [0b01100000]);
  assert.deepEqual([...packDebugPixelIndexes(new Uint8Array([0, 1, 2, 3]), 2)], [0b00011011]);
  assert.deepEqual([...packDebugPixelIndexes(new Uint8Array([1, 2]), 4)], [0b00010010]);
});

test('canvas playback plans cap process frames and preserve final-frame sends', () => {
  const pixels = new Uint8Array([1, 2, 3]);
  const changes = [
    { index: 0, before: 0, after: 1 },
    { index: 1, before: 0, after: 2 },
    { index: 2, before: 0, after: 3 }
  ];
  const process = createDebugCanvasPlaybackPlan({ pixels, changes, process: true, fps: 2, seconds: 1 });
  assert.equal(process.frameBudget, 2);
  assert.equal(process.updateCount, 2);
  assert.equal(process.totalFrames, 3);
  assert.equal(process.interval, 500);
  assert.deepEqual([...process.frames].map(frame => [...frame]), [[0, 0, 0], [1, 2, 0], [1, 2, 3]]);
  const final = createDebugCanvasPlaybackPlan({ pixels, changes, process: false, fps: 10, seconds: 4 });
  assert.equal(final.totalFrames, 1);
  assert.equal(final.interval, 100);
  assert.deepEqual([...final.frames], [pixels]);
});

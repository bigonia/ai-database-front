import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugImage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { debugRgbFrom565, getDebugFrameIndexError, getDebugImageSourceRect, getDebugImageCropReset, packDebugImagePixels } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('image crop reset centers contain and cover crops', () => {
  assert.deepEqual(getDebugImageCropReset({
    bitmapWidth: 400, bitmapHeight: 200, targetWidth: 100, targetHeight: 100, fitMode: 'contain'
  }), { zoom: 1, x: 0, y: 0, size: 200 });
  assert.deepEqual(getDebugImageCropReset({
    bitmapWidth: 400, bitmapHeight: 200, targetWidth: 100, targetHeight: 100, fitMode: 'cover'
  }), { zoom: 1, x: 100, y: 0, size: 200 });
});

test('image source rectangle applies zoom and clamps crop position', () => {
  assert.deepEqual(getDebugImageSourceRect({
    bitmapWidth: 400, bitmapHeight: 200, targetWidth: 100, targetHeight: 100,
    fitMode: 'cover', zoom: 2, x: 1000, y: -10
  }), { x: 300, y: 0, width: 100, height: 100 });
  assert.deepEqual(getDebugImageSourceRect({
    bitmapWidth: 200, bitmapHeight: 400, targetWidth: 100, targetHeight: 100,
    fitMode: 'contain', zoom: 1, x: 0, y: 0
  }), { x: 0, y: 0, width: 200, height: 400 });
});

test('RGB565 conversion and image pixels preserve nearest-color and packed bit order', () => {
  assert.deepEqual(debugRgbFrom565(0xf800), { r: 255, g: 0, b: 0 });
  const rgba = new Uint8ClampedArray([
    0, 0, 0, 255,
    255, 255, 255, 255,
    0, 0, 0, 0
  ]);
  assert.deepEqual([...packDebugImagePixels(rgba, 3, 1, 1, [0, 0xffff])], [0b01100000]);
});

test('frame index validation reports the first palette overflow', () => {
  assert.equal(getDebugFrameIndexError(new Uint8Array([0b01100000]), 1, 2, 3), '');
  assert.equal(getDebugFrameIndexError(new Uint8Array([0b11100000]), 2, 3, 1), '第 1 个像素的索引 3 超出调色板范围（0～2）');
});

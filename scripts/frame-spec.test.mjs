import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the production frame-spec helpers without adding a test runner dependency.
const source = await readFile(new URL('../src/views/sdui/debug/utils/frameSpec.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const {
  FRAME_SIZES, FRAME_PLATFORM_MAX_BYTES, DEFAULT_PALETTE_COLORS,
  rgbHexTo565, colorFrom565, paletteBits, packPixelIndexes, validateFrameSpec
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('rgbHexTo565 matches the RGB565 bit layout', () => {
  assert.equal(rgbHexTo565('#ffffff'), 0xffff);
  assert.equal(rgbHexTo565('#000000'), 0x0000);
  assert.equal(rgbHexTo565('#ff0000'), 0xf800);
  assert.equal(rgbHexTo565('#00ff00'), 0x07e0);
  assert.equal(rgbHexTo565('#0000ff'), 0x001f);
});

test('colorFrom565 recovers channel ratios', () => {
  const { r, g, b } = colorFrom565(0xffff);
  assert.equal(r, 255);
  assert.equal(g, 255);
  assert.equal(b, 255);
  assert.equal(colorFrom565(0x0000).r, 0);
});

test('paletteBits maps palette size to bit depth', () => {
  assert.equal(paletteBits(2), 1);
  assert.equal(paletteBits(4), 2);
  assert.equal(paletteBits(16), 4);
  assert.equal(paletteBits(3), 0);
  assert.equal(paletteBits(0), 0);
});

test('default palette has 16 unique colors usable for 4-bit frames', () => {
  assert.equal(DEFAULT_PALETTE_COLORS.length, 16);
  assert.equal(new Set(DEFAULT_PALETTE_COLORS).size, 16);
  assert.equal(paletteBits(DEFAULT_PALETTE_COLORS.length), 4);
});

test('validateFrameSpec accepts square sizes with 2/4/16 color palettes', () => {
  const palette = DEFAULT_PALETTE_COLORS.map(rgbHexTo565);
  for (const size of FRAME_SIZES) {
    const result = validateFrameSpec({ mode: 'canvas', palette, width: size, height: size, capabilities: null });
    assert.equal('error' in result, false);
    assert.equal(result.byteLength, size * size * 4 / 8);
  }
  const twoColor = validateFrameSpec({ mode: 'canvas', palette: palette.slice(0, 2), width: 128, height: 128, capabilities: null });
  assert.equal(twoColor.bits, 1);
  assert.equal(twoColor.byteLength, 128 * 128 / 8);
});

test('validateFrameSpec rejects invalid dimensions and palettes', () => {
  const palette = DEFAULT_PALETTE_COLORS.map(rgbHexTo565);
  const rect = validateFrameSpec({ mode: 'canvas', palette, width: 32, height: 64, capabilities: null });
  assert.match(rect.error, /宽高必须相同/);
  const oddPalette = validateFrameSpec({ mode: 'canvas', palette: palette.slice(0, 3), width: 32, height: 32, capabilities: null });
  assert.match(oddPalette.error, /调色板必须包含/);
  const badValue = validateFrameSpec({ mode: 'canvas', palette: [0, 70000, 1, 2], width: 32, height: 32, capabilities: null });
  assert.match(badValue.error, /0～65535/);
  const tooLarge = validateFrameSpec({ mode: 'canvas', palette, width: 128, height: 128, capabilities: { maxBytes: FRAME_PLATFORM_MAX_BYTES - 1 } });
  assert.match(tooLarge.error, /超过设备上限/);
});

test('validateFrameSpec enforces device capability declarations', () => {
  const palette = DEFAULT_PALETTE_COLORS.map(rgbHexTo565);
  const noViewMode = validateFrameSpec({ mode: 'canvas', palette, width: 32, height: 32, capabilities: { viewModes: ['image'] } });
  assert.match(noViewMode.error, /未声明支持 Canvas/);
  const noResolution = validateFrameSpec({ mode: 'image', palette, width: 64, height: 64, capabilities: { resolutions: [16, 32] } });
  assert.match(noResolution.error, /分辨率/);
  const badDepth = validateFrameSpec({ mode: 'canvas', palette, width: 32, height: 32, capabilities: { colorBits: [1, 2] } });
  assert.match(badDepth.error, /色深/);
  const tooManyColors = validateFrameSpec({ mode: 'canvas', palette, width: 32, height: 32, capabilities: { maxPaletteColors: 4 } });
  assert.match(tooManyColors.error, /调色板颜色/);
});

test('packPixelIndexes packs 1-bit and 4-bit frames in drawing order', async () => {
  const oneBit = packPixelIndexes(Uint8Array.from([0, 1, 0, 0, 1, 1, 0, 0, 1]), 1);
  assert.equal(oneBit.size, 2);
  assert.deepEqual([...new Uint8Array(await oneBit.arrayBuffer())], [0b01001100, 0b10000000]);
  const fourBit = packPixelIndexes(Uint8Array.from([0x0f, 0x01, 0x0a, 0x03]), 4);
  assert.deepEqual([...new Uint8Array(await fourBit.arrayBuffer())], [0xf1, 0xa3]);
});

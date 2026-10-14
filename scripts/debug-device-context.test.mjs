import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/sdui/debugDeviceContext.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { parseDebugDeviceCapabilities } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('device context normalizes section, image, and canvas capability declarations', () => {
  const schema = {
    surface: {
      ui: { sectionTypes: ['text_section', 2, 'chart_section'], viewModes: ['image', null, 'canvas'] },
      image: { maxBytes: 4096, maxPaletteColors: 16 },
      canvas: { resolutions: ['128x128', '32x32', '256x256'], colorBits: [1, '2', 8], maxFps: 12 }
    }
  };
  assert.deepEqual(parseDebugDeviceCapabilities(schema, [16, 32, 64, 128]), {
    sectionTypes: ['text_section', 'chart_section'],
    frame: {
      viewModes: ['image', 'canvas'], resolutions: [32, 128], maxBytes: 4096,
      maxPaletteColors: 16, colorBits: [1, 2], maxFps: 12
    }
  });
});

test('missing or malformed capability branches stay optional without inventing support', () => {
  assert.deepEqual(parseDebugDeviceCapabilities({ surface: {}}, [16, 32]), {
    sectionTypes: [],
    frame: { viewModes: null, resolutions: null, maxBytes: null, maxPaletteColors: null, colorBits: null, maxFps: null }
  });
  assert.deepEqual(parseDebugDeviceCapabilities(null, [16, 32]).sectionTypes, []);
});

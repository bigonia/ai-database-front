import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import ts from 'typescript';

const source = (await readFile(new URL('../src/api/terminal-scenes.ts', import.meta.url), 'utf8'))
  .replace("import request from '@/utils/request';", '');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const scenes = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const status = {
  enabled: true, agentName: 'Agent', navigationTrigger: null, order: ['business-1'],
  scenes: [{ id: 'business-1', type: 'business', name: '业务' }], primaryScene: 'business-1',
  currentScene: null, entryMode: null, controlSessionActive: false, confirmed: true,
  error: null, interactionId: null, navigationTriggers: [], resource: 'runtime'
};

test('scene runtime parser accepts a complete response and rejects malformed fields', () => {
  assert.deepEqual(scenes.parseSceneRuntimeStatus(status), status);
  assert.throws(() => scenes.parseSceneRuntimeStatus({ ...status, order: ['business-1', 2] }));
  assert.throws(() => scenes.parseSceneRuntimeStatus({ ...status, scenes: [{ id: 'x', type: 'unknown', name: 'x' }] }));
});

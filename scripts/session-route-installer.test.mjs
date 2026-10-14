import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/router/sessionRouteInstaller.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createSessionRouteInstaller } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('concurrent navigation shares route installation for one session', async () => {
  const added = [];
  let resolveRoutes;
  let generated = 0;
  const install = createSessionRouteInstaller({
    generateRoutes: () => { generated++; return new Promise(resolve => { resolveRoutes = resolve; }); },
    addRoute: route => added.push(route),
    isCurrent: (token, generation) => token === 'token-a' && generation === 1
  });
  const first = install(['admin'], 'token-a', 1);
  const second = install(['admin'], 'token-a', 1);
  assert.equal(generated, 1);
  resolveRoutes(['route-a', 'route-b']);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(added, ['route-a', 'route-b']);
  assert.equal(await install(['admin'], 'token-a', 1), false);
});

test('route results from an outdated session are discarded', async () => {
  let current = true;
  const added = [];
  const install = createSessionRouteInstaller({
    generateRoutes: async () => ['old-route'],
    addRoute: route => added.push(route),
    isCurrent: () => current
  });
  current = false;
  assert.equal(await install(['admin'], 'token-a', 1), false);
  assert.deepEqual(added, []);
});

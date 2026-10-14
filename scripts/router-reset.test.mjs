import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { createMemoryHistory, createRouter } from 'vue-router';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/router/routeReset.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createRouteResetter } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('reset removes dynamically added routes from a real memory router', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/stable', name: 'stable', component: {}}]
  });
  const resetter = createRouteResetter(router);

  resetter.add({ path: '/session', name: 'session', component: {}});
  assert.equal(router.hasRoute('session'), true);

  resetter.reset();

  assert.equal(router.hasRoute('session'), false);
  assert.equal(router.resolve('/stable').matched.at(-1)?.name, 'stable');
});

test('individual route removal remains effective after registration', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [] });
  const resetter = createRouteResetter(router);
  const remove = resetter.add({ path: '/session', name: 'session', component: {}});

  remove();
  resetter.reset();

  assert.equal(router.hasRoute('session'), false);
});

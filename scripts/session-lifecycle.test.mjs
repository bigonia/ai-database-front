import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/store/sessionLifecycle.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { clearUserSession, isUserSessionCurrent, readUserInfoForSession } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function session() {
  return { token: 'token-a', userId: 'user-a', name: 'A', avatar: 'a.png', introduction: 'A', roles: ['admin'], sessionGeneration: 4 };
}

test('clearing a session resets identity, permissions, cache, routes, and invalidates pending reads', () => {
  const state = session();
  const calls = [];
  const generation = clearUserSession(state, {
    removeToken: () => calls.push('token'),
    resetRouter: () => calls.push('router'),
    clearPermissionRoutes: () => calls.push('permissions'),
    clearCachedViews: () => calls.push('cache')
  });
  assert.equal(generation, 5);
  assert.deepEqual(state, { token: '', userId: '', name: '', avatar: '', introduction: '', roles: [], sessionGeneration: 5 });
  assert.deepEqual(calls, ['token', 'router', 'permissions', 'cache']);
  assert.equal(isUserSessionCurrent(state, 'token-a', 4), false);
});

test('late account info is discarded and cannot apply roles to a new session', async () => {
  const state = session();
  let resolve;
  let applied = false;
  const pending = readUserInfoForSession({
    state, token: 'token-a', generation: 4,
    read: () => new Promise(done => { resolve = done; }),
    apply: () => { applied = true; }
  });
  clearUserSession(state, {
    removeToken: () => {}, resetRouter: () => {}, clearPermissionRoutes: () => {}, clearCachedViews: () => {}
  });
  state.token = 'token-b';
  resolve({ roles: ['guest'] });
  assert.deepEqual(await pending, { kind: 'stale' });
  assert.equal(applied, false);
  assert.deepEqual(state.roles, []);
});

test('current account info applies once and preserves the accepted response value', async () => {
  const state = session();
  const result = await readUserInfoForSession({
    state, token: 'token-a', generation: 4,
    read: async () => ({ roles: ['admin'] }),
    apply: value => value.roles[0]
  });
  assert.deepEqual(result, { kind: 'success', value: 'admin' });
});

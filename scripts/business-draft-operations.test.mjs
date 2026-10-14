import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}

const draftUrl = await moduleUrl('../src/sdui/businessDraft.ts');
const operationsSource = (await readFile(new URL('../src/sdui/businessDraftOperations.ts', import.meta.url), 'utf8'))
  .replace("'@/sdui/businessDraft'", `'${draftUrl}'`);
const operationsCode = ts.transpileModule(operationsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { saveBusinessDraft, validateBusinessDraft } = await import(
  `data:text/javascript;base64,${Buffer.from(operationsCode).toString('base64')}`
);

function definition() {
  return {
    id: 'business-1', name: 'Draft', description: '', devices: { local: {}}, mirror: false,
    uis: [{ key: 'home', owner: 'local', template: 'text', fields: { title: 'before' }}], flows: []
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('save submits an isolated snapshot and reports an unchanged accepted draft', async () => {
  const draft = definition();
  let submitted;
  const result = await saveBusinessDraft({
    businessId: 'business-1', generation: 3, isCurrent: () => true,
    definition: draft, revision: 4, getEditRevision: () => 8,
    save: async (id, revision, snapshot) => {
      submitted = { id, revision, snapshot };
      return { revision: 5, definition: snapshot };
    }
  });
  assert.equal(submitted.id, 'business-1');
  assert.equal(submitted.revision, 4);
  assert.notEqual(submitted.snapshot, draft);
  assert.deepEqual(result, { kind: 'saved', result: { revision: 5, definition: submitted.snapshot }, unchangedSinceSubmit: true });
});

test('save preserves edits made in flight and ignores a response for a changed route', async () => {
  const gate = deferred();
  let editRevision = 2;
  const saving = saveBusinessDraft({
    businessId: 'business-1', generation: 3, isCurrent: () => true,
    definition: definition(), revision: 4, getEditRevision: () => editRevision,
    save: async (_id, _revision, snapshot) => gate.promise.then(() => ({ revision: 5, definition: snapshot }))
  });
  editRevision++;
  gate.resolve();
  const editedWhileSaving = await saving;
  assert.equal(editedWhileSaving.kind, 'saved');
  if (editedWhileSaving.kind === 'saved') assert.equal(editedWhileSaving.unchangedSinceSubmit, false);
  const changedDraftResult = await saveBusinessDraft({
    businessId: 'business-1', generation: 3, isCurrent: () => false,
    definition: definition(), revision: 4, getEditRevision: () => 2,
    save: async (_id, _revision, snapshot) => ({ revision: 5, definition: snapshot })
  });
  assert.deepEqual(changedDraftResult, { kind: 'stale' });
});

test('validation accepts only the revision and route that initiated its request', async () => {
  const gate = deferred();
  let editRevision = 7;
  const validating = validateBusinessDraft({
    businessId: 'business-1', generation: 3, isCurrent: () => true,
    definition: definition(), getEditRevision: () => editRevision,
    validate: async () => gate.promise
  });
  editRevision++;
  gate.resolve({ ok: true, errorCount: 0, warningCount: 0, problems: [] });
  assert.deepEqual(await validating, { kind: 'changed' });
  const stale = await validateBusinessDraft({
    businessId: 'business-1', generation: 3, isCurrent: () => false,
    definition: definition(), getEditRevision: () => 7,
    validate: async () => ({ ok: true, errorCount: 0, warningCount: 0, problems: [] })
  });
  assert.deepEqual(stale, { kind: 'stale' });
});

test('save and validation failures retain their readable error message', async () => {
  const rejected = async () => { throw new Error('network unavailable'); };
  const common = { businessId: 'business-1', generation: 3, isCurrent: () => true };
  const saveResult = await saveBusinessDraft({
    ...common, definition: definition(), revision: 4, getEditRevision: () => 1, save: rejected
  });
  const validationResult = await validateBusinessDraft({
    ...common, definition: definition(), getEditRevision: () => 1, validate: rejected
  });
  assert.deepEqual(saveResult, { kind: 'failure', message: 'network unavailable' });
  assert.deepEqual(validationResult, { kind: 'failure', message: 'network unavailable' });
});

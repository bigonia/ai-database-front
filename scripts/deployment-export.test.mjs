import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';

const vue = await readFile(new URL('../src/views/sdui/business/DeploymentDetail.vue', import.meta.url), 'utf8');
const { descriptor } = parse(vue);
const ast = ts.createSourceFile('deployment.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = ['exportIntegration', 'load', 'refreshMonitoring', 'dataOf'].map(name =>
  ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast)).join('\n');
const code = `export function harness({failure, confirmFailure, holdConfirmation} = {}) {
  const ref = value => ({value});
  const deploymentId = ref('dep'), status = ref({deploymentId:'dep', businessId:'biz', status:'active', slotBindings:{local:'device'}});
  const exportLoading=ref(false), exportError=ref(''), credential=ref(null), businessExport=ref(null), credentialVisible=ref(false);
  const loading=ref(false), operationLoading=ref(false);
  let deploymentLoadGeneration=1, exportRequestId=0;
  const calls=[];
  let releaseConfirmation;
  const confirmation=new Promise(resolve=>{releaseConfirmation=resolve;});
  const ElMessageBox={confirm:async()=>{if(confirmFailure) throw confirmFailure;if(holdConfirmation) await confirmation;}}, ElMessage={success:()=>{}};
  const template={businessId:'biz',tenantId:'tenant',instructions:'usage',instances:[{deviceId:'device',credential:''}]};
  const exported={deploymentId:'dep',businessId:'biz',deviceId:'device',tenantId:'tenant',credential:'xc_new',triggers:['generate'],endpoint:'/api/v1/sdui/businesses/biz/triggers/{triggerName}'};
  const getDeploymentExport=async(id)=>{if(id!=='dep') throw new Error('wrong deployment');calls.push('template');if(failure) throw failure;return {data:template};};
  const exportDeploymentCredential=async()=>{calls.push('rotate');return {data:exported};};
  const loadRecords=async()=>{}, getDeployment=async()=>{calls.push('poll');};
  ${functions}
  return {exportIntegration,load,refreshMonitoring,releaseConfirmation,calls,exportLoading,exportError,credentialVisible,businessExport};
}`;
const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {harness}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('failed generation exposes the server error and allows a retry without rotating credentials', async()=>{
  const h=harness({failure:new Error('此部署没有外部触发器')});
  await h.exportIntegration();
  assert.equal(h.exportError.value,'此部署没有外部触发器');
  assert.equal(h.exportLoading.value,false);
  assert.equal(h.credentialVisible.value,false);
  assert.deepEqual(h.calls,['template']);
  await h.exportIntegration();
  assert.deepEqual(h.calls,['template','template']);
});

test('generation errors render beside the button even when the result dialog is closed',()=>{
  const template=baseParse(descriptor.template.content);
  const ancestors=[];
  let found=false;
  function visit(node) {
    if(node.type===1) {
      if(node.tag==='el-alert' && node.props.some(prop=>prop.type===7 && prop.name==='if' && prop.exp?.content==='exportError')) {
        assert.ok(ancestors.includes('el-collapse-item'));
        assert.ok(!ancestors.includes('el-dialog'));
        found=true;
      }
      ancestors.push(node.tag);
    }
    for(const child of node.children || []) visit(child);
    if(node.type===1) ancestors.pop();
  }
  visit(template);
  assert.ok(found);
});

test('successful generation opens the dialog with the new credential in the template',async()=>{
  const h=harness();
  await h.exportIntegration();
  assert.deepEqual(h.calls,['template','rotate']);
  assert.equal(h.credentialVisible.value,true);
  assert.equal(h.businessExport.value.instances[0].credential,'xc_new');
  assert.equal(h.exportLoading.value,false);
});

test('pending confirmation prevents duplicate generation and refresh from discarding the export',async()=>{
  const h=harness({holdConfirmation:true});
  const pending=h.exportIntegration();
  assert.equal(h.exportLoading.value,true);
  await h.exportIntegration();
  await h.load();
  await h.refreshMonitoring();
  h.releaseConfirmation();
  await pending;
  assert.deepEqual(h.calls,['template','rotate']);
  assert.equal(h.credentialVisible.value,true);
});

test('canceling confirmation releases the button without making export requests',async()=>{
  const h=harness({confirmFailure:'cancel'});
  await h.exportIntegration();
  assert.deepEqual(h.calls,[]);
  assert.equal(h.exportLoading.value,false);
  assert.equal(h.exportError.value,'');
});

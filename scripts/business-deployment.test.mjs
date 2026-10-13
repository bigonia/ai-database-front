import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const vue = await readFile(new URL('../src/views/sdui/business/BusinessEditor.vue', import.meta.url), 'utf8');
const source = vue.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('editor.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = ['deployCurrent', 'isRecord', 'isDeploymentFrozen', 'isInstallResult', 'frozenDeviceRoles', 'dataOf']
 .map(name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast)).join('\n');
const code = `export function harness(response, failure) {
 const ref = value => ({value});
 const definition=ref({}), deploymentLoading=ref(false), deploymentId=ref(''), freezeOutcomeUnknown=ref(false);
 const businessId=ref('biz'), hasTarget=ref(true), deploymentBindings=ref({localDeviceId:'A',targetDeviceId:'B'});
 const dirty=ref(false), validation=ref({ok:true}), version=ref(2), freezeResult=ref(null), installResult=ref(null), deploymentNotice=ref(null);
 let businessRouteGeneration=1, calls=[];
 const ElMessage={warning:()=>{}}, validate=async()=>true, writeFreezeOutcomeUnknown=()=>{};
 const deployBusiness=async(business,bindings)=>{calls.push({business,bindings});if(failure)throw failure;return {data:response};};
 ${functions}
 return {deployCurrent,calls,deploymentId,installResult,freezeOutcomeUnknown,deploymentNotice};
}`;
const compiled = ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {harness}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const result = offline => ({deployment:{deploymentId:'dep',businessId:'biz',businessVersion:2,localDeviceId:'A',targetDeviceIds:['B'],triggers:[],initialRunDuplicate:false},
 installation:{deploymentId:'dep',online:offline?1:2,offline:offline?1:0,succeeded:offline?1:2,failed:0,devices:[{deviceId:'A',role:'local',status:'ok',error:null},{deviceId:'B',role:'target',status:offline?'skipped':'ok',error:offline?'device_offline':null}]}});
test('one deployment action installs both bound devices without another confirmation or request',async()=>{
 const h=harness(result(false));await h.deployCurrent();await h.deployCurrent();
 assert.equal(h.calls.length,1);assert.equal(h.deploymentId.value,'dep');assert.equal(h.installResult.value.succeeded,2);
});
test('offline target keeps the deployment and displays waiting for online',async()=>{
 const h=harness(result(true));await h.deployCurrent();
 assert.equal(h.deploymentId.value,'dep');assert.equal(h.installResult.value.offline,1);assert.match(h.deploymentNotice.value.message,/等待上线 1/);
});
test('an uncertain network response prevents silently creating a second deployment',async()=>{
 const h=harness(null,new Error('network'));await h.deployCurrent();await h.deployCurrent();
 assert.equal(h.calls.length,1);assert.equal(h.freezeOutcomeUnknown.value,true);
});

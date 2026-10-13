<template>
  <section class="page-controls" v-loading="busy">
    <el-alert v-if="error" type="warning" :closable="false" class="notice">
      {{ error }} <el-button link type="primary" :disabled="busy" @click="load">重试</el-button>
    </el-alert>
    <template v-if="state">
      <el-alert v-if="state.error" :title="state.error" type="warning" :closable="false" class="notice" />
      <div class="order-heading">
        <div><strong>页面运行顺序</strong><span class="hint">第一项为主页面；终端选择会同步调整顺序</span><el-tag v-if="dirty" size="small" type="warning">待应用</el-tag></div>
        <el-button type="primary" size="small" :disabled="!online || !dirty || busy" @click="save">保存并应用</el-button>
      </div>
      <div v-for="(id, index) in form.order" :key="id" class="page-row">
        <div class="page-name">
          <span class="position">{{ index + 1 }}.</span><span>{{ label(id) }}</span>
          <el-tag v-if="id === 'agent'" size="small" type="info">{{ state.controlSessionActive ? '控制会话有效' : '未接入' }}</el-tag>
          <el-tag v-if="index === 0" size="small" :type="dirty ? 'warning' : 'success'">{{ dirty ? '拟设主页面' : '主页面' }}</el-tag>
        </div>
        <div class="row-actions">
          <el-button link :disabled="busy || !online || index === 0" @click="move(index, -1)">上移</el-button>
          <el-button link :disabled="busy || !online || index === form.order.length - 1" @click="move(index, 1)">下移</el-button>
          <el-button link type="primary" :disabled="busy || !online || !state.enabled || dirty || (id === 'agent' && !state.controlSessionActive)" @click="enter(id)">立即展示</el-button>
        </div>
      </div>
      <p class="hint">未设置主页面时，终端展示页面选择页。选择后保存为主页面，重连自动恢复；临时页面结束后恢复主页面。Agent 无有效内容时使用可用业务页面。</p>
      <el-collapse class="page-options">
        <el-collapse-item title="页面设置" name="settings">
          <el-form label-width="100px" :disabled="busy || !online">
            <el-form-item label="Agent 名称"><el-input v-model="form.agentName" maxlength="48" /></el-form-item>
            <el-form-item label="返回选择页">
              <el-select v-model="form.navigationTrigger" clearable placeholder="可选，选择设备按钮手势" @clear="form.navigationTrigger = null">
                <el-option v-for="trigger in state.navigationTriggers" :key="trigger" :value="trigger" :label="gestureLabel(trigger)" />
              </el-select>
              <span class="field-hint">通过该手势返回页面选择页，终端选择会保存为主页面。已被业务使用的手势不可重复配置；清空后只能从管理端打开选择页。</span>
            </el-form-item>
          </el-form>
          <el-button size="small" :disabled="busy || !online || !state.enabled || formChanged" @click="enter('home')">打开页面选择页</el-button>
        </el-collapse-item>
      </el-collapse>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { configureSceneRuntime, enterTerminalScene, getSceneRuntime } from '@/api/terminal-scenes';
import type { SceneConfiguration, SceneRuntimeStatus } from '@/api/terminal-scenes';
import type { TerminalBusiness } from '@/api/terminal-runtime';

const props = defineProps<{ deviceId: string; online: boolean; observedAt: string; businesses: TerminalBusiness[] }>();
const emit = defineEmits<{ state: [value: SceneRuntimeStatus | null]; changed: [] }>();
const state = ref<SceneRuntimeStatus | null>(null);
const busy = ref(false);
const error = ref('');
const form = reactive<SceneConfiguration>({ enabled: true, agentName: 'Agent 助手', navigationTrigger: null, order: [] });
let sequence = 0;
const saved = ref('');
const formChanged = computed(() => JSON.stringify(form) !== saved.value);
const dirty = computed(() => state.value !== null && (!state.value.enabled || !state.value.primaryScene || formChanged.value));
function apply(value: SceneRuntimeStatus) {
  if (!value || !Array.isArray(value.scenes) || !Array.isArray(value.order) || !Array.isArray(value.navigationTriggers)) throw new Error('页面状态响应无效');
  const order = value.enabled ? [...value.order] : props.businesses.map(business => business.deploymentId);
  if (!order.includes('agent')) order.push('agent');
  state.value = value;
  Object.assign(form, { enabled: true, agentName: value.agentName, navigationTrigger: value.navigationTrigger || null, order });
  saved.value = JSON.stringify(form);
  emit('state', value);
}
function label(id: string | null) {
  if (id === 'home') return '页面选择页';
  if (id === 'agent') return form.agentName || 'Agent';
  const business = props.businesses.find(value => value.deploymentId === id);
  if (business) return `${business.businessName} · #${business.deploymentSerial}`;
  return state.value?.scenes.find(scene => scene.id === id)?.name || '未命名业务';
}
function gestureLabel(trigger: string) {
  return trigger.replace('button.', '').replace('plus', '加号键').replace('pwr', '电源键').replace('boot', 'Boot 键').replace('.short_press', '短按').replace('.long_press', '长按');
}
function move(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= form.order.length) return;
  const next = [...form.order];
  [next[index], next[target]] = [next[target], next[index]];
  form.order = next;
}
async function perform(action: () => Promise<any>, message?: string) {
  if (busy.value) return;
  const id = props.deviceId;
  const current = ++sequence;
  busy.value = true;
  error.value = '';
  try {
    const response = await action();
    if (id !== props.deviceId || current !== sequence) return;
    apply(response.data);
    if (message) { ElMessage.success(message); emit('changed'); }
  } catch (failure: any) {
    if (id === props.deviceId && current === sequence) error.value = failure.response?.data?.reason || failure.message || '页面操作失败';
  } finally { if (current === sequence) busy.value = false; }
}
function load() { return perform(() => getSceneRuntime(props.deviceId)); }
function save() { return perform(() => configureSceneRuntime(props.deviceId, { ...form, navigationTrigger: form.navigationTrigger || null, order: [...form.order] }), '页面配置已应用'); }
function enter(id: string) { return perform(() => enterTerminalScene(props.deviceId, id), '页面已展示'); }
watch(() => props.deviceId, () => { sequence++; busy.value = false; state.value = null; emit('state', null); load(); }, { immediate: true });
watch(() => props.observedAt, () => { if (state.value && !formChanged.value) load(); });
</script>

<style scoped>
.page-controls { border-top: 1px solid #ebeef5; padding-top: 16px; min-height: 60px; }
.order-heading, .page-row, .page-name, .order-heading > div { display: flex; align-items: center; gap: 10px; }
.order-heading, .page-row { justify-content: space-between; }
.order-heading > div, .page-name { flex-wrap: wrap; }
.page-row { padding: 12px 0; border-bottom: 1px solid #ebeef5; }
.row-actions { flex-shrink: 0; }
.position, .hint, .field-hint { color: #7b8494; font-size: 12px; line-height: 1.7; }
.field-hint { display: block; width: 100%; margin-top: 4px; }
.page-options { margin-top: 16px; border-bottom: none; }
.notice { margin-bottom: 12px; }
@media (max-width: 600px) { .page-row { align-items: flex-start; flex-direction: column; } .order-heading .hint { display: none; } }
</style>

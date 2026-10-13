<template>
  <el-card shadow="never" class="runtime-status-panel">
    <template #header>
      <div class="panel-header">
        <strong>页面管理</strong>
        <div class="header-actions">
          <el-tag v-if="status" :type="status.online ? 'success' : 'info'" size="small">{{ status.online ? '在线' : '离线' }}</el-tag>
          <el-button size="small" :loading="loading" @click="emit('refresh')">刷新</el-button>
        </div>
      </div>
    </template>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" show-icon class="status-error" />
    <template v-if="status">
      <div class="status-summary">
        <div><span class="label">主页面</span><strong>{{ primaryLabel }}</strong></div>
        <div><span class="label">已部署</span><span>{{ status.businesses.length }} 个业务</span></div>
        <div><span class="label">配置下发</span><el-tooltip content="成功表示终端已接受业务规则，不表示业务动作已执行。离线时展示平台保留的确认记录。"><span>{{ confirmationLabel }}</span></el-tooltip></div>
        <div><span class="label">当前视图</span><span>{{ viewLabel }}</span><el-button v-if="status.view.snapshotAvailable" link type="primary" :loading="snapshotLoading" @click="showSnapshot">查看快照</el-button></div>
      </div>
      <SceneRuntimePanel :device-id="status.deviceId" :online="status.online" :observed-at="status.observedAt"
        :businesses="status.businesses" @state="pageState = $event" @changed="emit('refresh')" />
      <p class="status-note">{{ status.online ? '' : '终端离线，页面配置需在线后才能应用。' }}当前视图为平台保存的最近下发记录。</p>
    </template>
    <el-empty v-else :description="loading ? '正在读取运行状态' : '暂无运行状态'" :image-size="44" />
    <el-dialog v-model="snapshotVisible" title="平台视图快照" width="560px" append-to-body>
      <el-alert v-if="snapshotError" :title="snapshotError" type="warning" :closable="false" />
      <template v-if="snapshot"><div class="snapshot-type">{{ snapshot.sectionType }}</div><pre class="snapshot-content">{{ JSON.stringify(snapshot.fields, null, 2) }}</pre></template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SceneRuntimeStatus } from '@/api/terminal-scenes';
import { getDebugViewState } from '@/api/sdui';
import type { TerminalBusiness, TerminalRuntimeStatus } from '@/api/terminal-runtime';
import SceneRuntimePanel from './SceneRuntimePanel.vue';

const pageState = ref<SceneRuntimeStatus | null>(null);

const props = defineProps<{
  status: TerminalRuntimeStatus | null
  loading: boolean
  error: string
}>();
const emit = defineEmits<{ refresh: [] }>();
const confirmationLabel = computed(() => ({ confirmed: '成功', unconfirmed: '尚未确认', none: '无业务配置', unknown: '未知' })[props.status?.configuration.confirmation || 'unknown']);
function businessLabel(business: TerminalBusiness | undefined): string {
  return business ? `${business.businessName} · #${business.deploymentSerial}` : '无';
}
const primaryLabel = computed(() => {
  if (!pageState.value?.enabled) return businessLabel(props.status?.businesses[0]);
  const id = pageState.value.primaryScene;
  if (!id) return '未设置（终端选择页面）';
  if (id === 'agent') return pageState.value.agentName;
  if (id === 'home') return '页面选择页';
  return businessLabel(props.status?.businesses.find(business => business.deploymentId === id));
});
const viewLabel = computed(() => {
  const view = props.status?.view;
  if (!view) return '未知';
  if (view.kind === 'none') return '无视图记录';
  if (view.kind === 'unknown') return '未知';
  const business = props.status?.businesses.find(item => item.deploymentId === view.deploymentId);
  const type = view.kind === 'image' ? '图片' : view.kind === 'canvas' ? 'Canvas' :
    ({ menu: '菜单', text: '文本', clock: '时钟' } as Record<string, string>)[view.sectionType || ''] || '界面';
  const name = business?.businessName || (view.sceneId === 'nexus-agent' ? pageState.value?.agentName || 'Agent'
    : view.sceneId === 'nexus-home' ? '页面选择页' : '未关联业务');
  return `${name} / ${type}`;
});
const snapshotVisible = ref(false);
const snapshotLoading = ref(false);
const snapshotError = ref('');
const snapshot = ref<Record<string, unknown> | null>(null);
let snapshotRequest = 0;
watch(() => props.status, () => {
  snapshotRequest++;
  snapshotVisible.value = false;
  snapshotLoading.value = false;
  snapshot.value = null;
});
async function showSnapshot() {
  if (!props.status || snapshotLoading.value) return;
  const status = props.status;
  const request = ++snapshotRequest;
  snapshotLoading.value = true;
  snapshotError.value = '';
  snapshot.value = null;
  try {
    const response = await getDebugViewState(status.deviceId);
    if (request !== snapshotRequest) return;
    const value = response?.data;
    if (value?.deviceId !== status.deviceId || value?.primaryView?.sceneId !== status.view.sceneId
      || !value?.primaryView?.section || typeof value.primaryView.section !== 'object') {
      throw new Error('视图已变化或快照不可用，请刷新运行状态');
    }
    snapshot.value = value.primaryView.section;
  } catch (error: any) {
    if (request !== snapshotRequest) return;
    snapshotError.value = error.message || '快照读取失败';
  } finally {
    if (request === snapshotRequest) {
      snapshotLoading.value = false;
      snapshotVisible.value = true;
    }
  }
}
</script>

<style scoped>
.runtime-status-panel { margin-bottom: 12px; }
.panel-header, .header-actions { display: flex; align-items: center; gap: 10px; }
.panel-header { justify-content: space-between; }
.status-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; margin-bottom: 20px; }
.status-summary > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.label { color: #7b8494; min-width: 64px; }
.status-note { color: #7b8494; font-size: 12px; }
.status-note { line-height: 1.6; margin-bottom: 0; }
.status-error { margin-bottom: 12px; }
.snapshot-content { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow: auto; background: #f8fafc; padding: 12px; }
@media (max-width: 600px) { .status-summary { grid-template-columns: 1fr; } }
</style>

<template>
  <main class="app-container deployment-library">
    <header class="page-heading">
      <div class="page-title"><h1>部署</h1><span class="record-count">{{ total }} 项</span></div>
      <div class="heading-actions">
        <el-tag v-if="businessId" type="info" effect="plain" class="business-filter">
          业务 <code>{{ businessId }}</code>
          <el-button link @click="clearBusinessFilter">清除筛选</el-button>
        </el-tag>
        <el-button :icon="Refresh" :loading="loading" @click="load(page)">刷新</el-button>
      </div>
    </header>
    <el-alert v-if="error" :type="items.length ? 'warning' : 'error'" :closable="false" :title="error" />
    <el-table v-loading="loading" :data="items" row-key="deploymentId" class="deployment-table">
      <el-table-column type="expand" width="44">
        <template #default="{ row }">
          <div class="device-results">
            <div v-for="deviceId in row.deviceIds" :key="deviceId" class="device-result">
              <div class="device-identity">
                <code>{{ deviceId }}</code>
                <el-tag size="small" effect="plain">{{ deviceRole(row, deviceId) }}</el-tag>
              </div>
              <el-tag v-if="row.deviceStatuses[deviceId]" size="small" :type="deploymentDeviceStatusType(row.deviceStatuses[deviceId].status)">
                {{ deploymentDeviceStatusLabel(row.deviceStatuses[deviceId].status) }}
              </el-tag>
              <el-tag v-else size="small" type="warning">无结果</el-tag>
              <span v-if="row.deviceStatuses[deviceId]?.error" class="device-error">
                {{ row.deviceStatuses[deviceId].error }}
              </span>
              <span v-else-if="!row.deviceStatuses[deviceId]" class="device-error">设备未返回结果</span>
            </div>
            <p v-if="!row.deviceIds.length" class="no-device-results">此部署没有绑定设备</p>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="业务 / 部署" min-width="250">
        <template #default="{ row }">
          <div class="deployment-identity">
            <el-button link class="business-link" @click="openDetail(row.deploymentId)">
              {{ row.businessName || '未命名业务' }}
            </el-button>
            <span>部署 #{{ row.deploymentSerial }}</span>
            <code>{{ row.businessId }}</code>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="部署状态 / 安装结果" min-width="230">
        <template #default="{ row }">
          <div class="deployment-status">
            <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '活动部署' : '已停止' }}
            </el-tag>
            <div class="result-summary">
              <el-tag v-for="part in resultSummary(row)" :key="part.label" size="small" effect="plain" :type="part.type">
                {{ part.label }}
              </el-tag>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="设备" width="100" align="center">
        <template #default="{ row }">{{ row.deviceIds.length }} 台</template>
      </el-table-column>
      <el-table-column label="部署时间" min-width="170">
        <template #default="{ row }">{{ formatDeploymentTime(row.deployedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" align="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button link type="primary" @click="openDetail(row.deploymentId)">详情</el-button>
            <el-dropdown v-if="canDelete(row)" trigger="click" @command="removeDeployment(row)">
              <el-button class="more-button" text circle :icon="MoreFilled" :aria-label="`更多部署操作：${row.businessName} #${row.deploymentSerial}`" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" :disabled="deletingId === row.deploymentId">删除部署记录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty v-if="!error" :description="businessId ? '该业务还没有部署记录' : '当前租户还没有部署记录'" />
      </template>
    </el-table>
    <div v-if="total > 0" class="pagination"><el-pagination background layout="total, prev, pager, next" :current-page="page + 1" :page-size="size" :total="total" @current-change="changePage" /></div>
  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useRoute } from 'vue-router';
import { MoreFilled, Refresh } from '@element-plus/icons-vue';
import { listDeployments, deleteDeployment } from '@/api/sdui-deployments';
import type { DeploymentPage } from '@/types/sdui-deployment';
import { deploymentDeviceStatusLabel, deploymentDeviceStatusType, deploymentResultSummary } from '@/sdui/businessStatus';
import { errorDetails, isMessageBoxCancellation } from '@/utils/errorDetails';

const router = useRouter();
const route = useRoute();
const businessId = computed(() => typeof route.query.businessId === 'string' ? route.query.businessId : '');
const page = ref(0);
const size = 20;
const total = ref(0);
const items = ref<DeploymentPage['items']>([]);
const loading = ref(false);
const error = ref('');
const deletingId = ref('');
let requestId = 0;
let pageActive = true;

function dataOf(response: unknown): unknown {
  return response !== null && typeof response === 'object' && !Array.isArray(response)
    ? (response as Record<string, unknown>).data
    : undefined;
}

function isDeploymentStatus(value: unknown): value is DeploymentPage['items'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!(typeof item.deploymentId === 'string' &&
    typeof item.businessId === 'string' &&
    typeof item.businessName === 'string' &&
    Number.isInteger(item.deploymentSerial) && (item.deploymentSerial as number) > 0 &&
    ['active', 'stopped'].includes(String(item.status)) &&
    Array.isArray(item.deviceIds) &&
    item.deviceIds.every((deviceId) => typeof deviceId === 'string') &&
    new Set(item.deviceIds).size === item.deviceIds.length &&
    Boolean(item.slotBindings) && typeof item.slotBindings === 'object' && !Array.isArray(item.slotBindings) &&
    typeof (item.slotBindings as Record<string, unknown>).local === 'string' &&
    ((item.slotBindings as Record<string, unknown>).target == null || typeof (item.slotBindings as Record<string, unknown>).target === 'string') &&
    item.deviceIds.includes((item.slotBindings as Record<string, unknown>).local as string) &&
    ((item.slotBindings as Record<string, unknown>).target == null || item.deviceIds.includes((item.slotBindings as Record<string, unknown>).target as string)) &&
    (item.deployedAt == null || typeof item.deployedAt === 'string') &&
    (item.stoppedAt == null || typeof item.stoppedAt === 'string') &&
    Boolean(item.deviceStatuses) &&
    typeof item.deviceStatuses === 'object' &&
    !Array.isArray(item.deviceStatuses))) return false;
  const knownStates = new Set(['ok', 'failed', 'skipped', 'installing', 'uninstall_pending', 'uninstalled', 'uninstall_failed', 'uninstall_skipped']);
  const deviceIds = item.deviceIds as string[];
  return Object.entries(item.deviceStatuses as Record<string, unknown>).every(([deviceId, value]) => {
    if (!deviceIds.includes(deviceId) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
    const state = value as Record<string, unknown>;
    return typeof state.status === 'string' && knownStates.has(state.status) &&
      (state.error == null || typeof state.error === 'string');
  });
}

async function load(targetPage = page.value) {
  const id = ++requestId;
  const requestedBusinessId = businessId.value;
  loading.value = true;
  error.value = '';
  try {
    const result = dataOf(await listDeployments(targetPage, size, requestedBusinessId || undefined)) as Partial<DeploymentPage> | undefined;
    if (id !== requestId || requestedBusinessId !== businessId.value) return;
    if (!result || !Array.isArray(result.items) || !result.items.every(isDeploymentStatus) ||
      result.items.length > size ||
      !Number.isInteger(result.page) || result.page !== targetPage ||
      !Number.isInteger(result.size) || result.size !== size ||
      (requestedBusinessId && result.items.some((item) => item.businessId !== requestedBusinessId)) ||
      !Number.isInteger(result.totalElements) || result.totalElements! < 0) {
      throw new Error('部署列表接口响应格式无效');
    }
    const lastPage = result.totalElements === 0 ? 0 : Math.ceil(result.totalElements! / size) - 1;
    if (targetPage > lastPage) {
      page.value = lastPage;
      await load(lastPage);
      return;
    }
    page.value = Number.isInteger(result.page) ? result.page! : targetPage;
    total.value = result.totalElements!;
    items.value = result.items;
  } catch (cause: unknown) {
    if (id === requestId && requestedBusinessId === businessId.value) {
      const reason = errorDetails(cause).message || '部署列表读取失败';
      const retainedPage = page.value + 1;
      const requestedPage = targetPage + 1;
      const pageContext = targetPage !== page.value
        ? `第 ${requestedPage} 页读取失败，当前仍显示第 ${retainedPage} 页的上次成功记录：`
        : '刷新失败，以下保留上次成功读取的部署记录：';
      error.value = items.value.length ? `${pageContext}${reason}` : reason;
    }
  } finally {
    if (id === requestId && requestedBusinessId === businessId.value) loading.value = false;
  }
}

function changePage(value: number) { void load(value - 1); }
function canDelete(row: DeploymentPage['items'][number]) {
  return row.status === 'stopped' &&
    row.deviceIds.every(id => row.deviceStatuses[id]?.status === 'uninstalled');
}
async function removeDeployment(row: DeploymentPage['items'][number]) {
  try {
    await ElMessageBox.confirm(`删除部署记录 ${row.deploymentId}？此操作不可撤销。`, '删除部署记录', { type: 'warning' });
    deletingId.value = row.deploymentId;
    await deleteDeployment(row.deploymentId);
    ElMessage.success('部署记录已删除');
    await load(page.value);
  } catch (cause: unknown) {
    if (!isMessageBoxCancellation(cause)) ElMessage.error(errorDetails(cause).message || '删除部署记录失败');
  } finally { deletingId.value = ''; }
}
function openDetail(deploymentId: string) {
  void router.push({
    name: 'SduiDeploymentDetail',
    params: { deploymentId },
    query: businessId.value ? { businessId: businessId.value } : undefined
  });
}
function clearBusinessFilter() {
  const query = { ...route.query };
  delete query.businessId;
  void router.replace({ query });
}
function deviceRole(row: DeploymentPage['items'][number], deviceId: string) {
  if (row.slotBindings.local === deviceId) return '本地设备';
  if (row.slotBindings.target === deviceId) return '目标设备';
  return '绑定设备';
}
function resultSummary(row: DeploymentPage['items'][number]) {
  return deploymentResultSummary(Object.values(row.deviceStatuses).map(value => value.status));
}
function formatDeploymentTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date).replace(/\//g, '-');
}
watch(businessId, () => {
  if (!pageActive) return;
  page.value = 0;
  total.value = 0;
  items.value = [];
  void load(0);
});
onMounted(() => { void load(page.value); });
onDeactivated(() => { pageActive = false; requestId++; loading.value = false; });
onActivated(() => { pageActive = true; if (!loading.value) void load(page.value); });
</script>

<style scoped>
.deployment-library { --el-color-primary: var(--app-primary); --el-color-primary-light-9: var(--app-primary-soft); --el-text-color-primary: var(--app-text); --el-text-color-regular: var(--app-text-secondary); --el-border-color: var(--app-border); padding:24px; color:var(--app-text); }
.page-heading,.page-title,.heading-actions,.row-actions { display:flex; align-items:center; }
.page-heading { justify-content:space-between; gap:16px; margin-bottom:20px; }
.page-title { gap:10px; }
.page-title h1 { margin:0; font-size:22px; line-height:30px; font-weight:600; }
.record-count { color:var(--app-text-muted); font-size:14px; }
.heading-actions { gap:12px; }
.business-filter { gap:8px; }
.business-filter code,.deployment-identity code,.device-identity code { color:var(--app-text-muted); font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.deployment-identity { display:grid; justify-items:start; gap:4px; }
.business-link { height:auto; padding:0; color:var(--app-text); font-weight:600; white-space:normal; text-align:left; }
.business-link:hover { color:var(--app-primary); }
.deployment-identity > span { color:var(--app-text-secondary); font-size:13px; }
.deployment-status { display:grid; justify-items:start; gap:6px; }
.result-summary { display:flex; flex-wrap:wrap; gap:4px; }
.row-actions { justify-content:flex-end; gap:8px; }
.more-button { color:var(--app-text-secondary); }
.deployment-table { width:100%; }
.deployment-table :deep(.el-table__header th) { background:var(--app-surface-muted); color:var(--app-text-secondary); font-weight:600; }
.device-results { display:grid; gap:8px; padding:8px 20px; }
.device-result { display:grid; grid-template-columns:minmax(180px,1fr) auto minmax(160px,2fr); align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--app-border); }
.device-identity { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
.device-identity code { overflow-wrap:anywhere; }
.device-error { color:var(--app-danger); font-size:13px; overflow-wrap:anywhere; }
.no-device-results { margin:0; color:var(--app-text-muted); }
.pagination { display:flex; justify-content:flex-end; margin-top:16px; }
@media (max-width:700px) {
  .deployment-library { padding:16px; }
  .page-heading { align-items:flex-start; flex-direction:column; }
  .heading-actions { flex-wrap:wrap; width:100%; }
  .device-result { grid-template-columns:minmax(0,1fr) auto; }
  .device-error { grid-column:1 / -1; }
}
</style>

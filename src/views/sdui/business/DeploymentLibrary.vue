<template>
  <div class="app-container deployment-library">
    <header class="page-heading">
      <div><span class="eyebrow">SDUI / RELEASES</span><h1>部署</h1><p>按时间查看业务部署记录和逐设备状态。</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="load(page)">刷新</el-button>
    </header>
    <el-alert v-if="error" :type="items.length ? 'warning' : 'error'" :closable="false" :title="error" />
    <el-table v-loading="loading" :data="items" row-key="deploymentId" stripe>
      <el-table-column label="部署 / 业务" min-width="260">
        <template #default="{ row }"><div class="primary-cell"><strong>{{ row.businessName }} · #{{ row.deploymentSerial }}</strong><span>部署于 {{ row.deployedAt || '时间未知' }}</span></div></template>
      </el-table-column>
      <el-table-column label="设备" min-width="200"><template #default="{ row }">{{ row.deviceIds?.join('、') || '无绑定设备' }}</template></el-table-column>
      <el-table-column label="逐设备结果" min-width="220">
        <template #default="{ row }">
          <el-tag v-for="(value, deviceId) in row.deviceStatuses" :key="deviceId" size="small" class="device-status" :type="deviceStatusType(value.status)">
            {{ deviceId }} · {{ deviceStatusLabel(value.status) }}
          </el-tag>
          <span v-if="!Object.keys(row.deviceStatuses || {}).length" class="muted">尚未安装</span>
        </template>
      </el-table-column>
      <el-table-column label="部署状态" width="120"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '活动' : '已停止' }}</el-tag></template></el-table-column>
      <el-table-column prop="deployedAt" label="冻结时间" min-width="170" />
      <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openDetail(row.deploymentId)">详情</el-button><el-button v-if="canDelete(row)" link type="danger" :loading="deletingId === row.deploymentId" @click="removeDeployment(row)">删除</el-button></template></el-table-column>
    </el-table>
    <el-empty v-if="!loading && !error && !items.length" description="当前租户还没有部署记录" />
    <div class="pagination"><el-pagination background layout="total, prev, pager, next" :current-page="page + 1" :page-size="size" :total="total" @current-change="changePage" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useRoute } from 'vue-router';
import { Refresh } from '@element-plus/icons-vue';
import { listDeployments, deleteDeployment, type DeploymentPage } from '@/api/business';

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

function dataOf(response: any): unknown { return response?.data; }

function isDeploymentStatus(value: unknown): value is DeploymentPage['items'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!(typeof item.deploymentId === 'string'
    && typeof item.businessId === 'string'
    && typeof item.businessName === 'string'
    && Number.isInteger(item.deploymentSerial) && (item.deploymentSerial as number) > 0
    && ['active', 'stopped'].includes(String(item.status))
    && Array.isArray(item.deviceIds)
    && item.deviceIds.every((deviceId) => typeof deviceId === 'string')
    && new Set(item.deviceIds).size === item.deviceIds.length
    && Boolean(item.slotBindings) && typeof item.slotBindings === 'object' && !Array.isArray(item.slotBindings)
    && typeof (item.slotBindings as Record<string, unknown>).local === 'string'
    && ((item.slotBindings as Record<string, unknown>).target == null || typeof (item.slotBindings as Record<string, unknown>).target === 'string')
    && item.deviceIds.includes((item.slotBindings as Record<string, unknown>).local as string)
    && ((item.slotBindings as Record<string, unknown>).target == null || item.deviceIds.includes((item.slotBindings as Record<string, unknown>).target as string))
    && (item.deployedAt == null || typeof item.deployedAt === 'string')
    && (item.stoppedAt == null || typeof item.stoppedAt === 'string')
    && Boolean(item.deviceStatuses)
    && typeof item.deviceStatuses === 'object'
    && !Array.isArray(item.deviceStatuses))) return false;
  const knownStates = new Set(['ok', 'failed', 'skipped', 'installing', 'uninstall_pending', 'uninstalled', 'uninstall_failed', 'uninstall_skipped']);
  return Object.entries(item.deviceStatuses as Record<string, unknown>).every(([deviceId, value]) => {
    if (!item.deviceIds.includes(deviceId) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
    const state = value as Record<string, unknown>;
    return typeof state.status === 'string' && knownStates.has(state.status)
      && (state.error == null || typeof state.error === 'string');
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
    if (!result || !Array.isArray(result.items) || !result.items.every(isDeploymentStatus)
      || result.items.length > size
      || !Number.isInteger(result.page) || result.page !== targetPage
      || !Number.isInteger(result.size) || result.size !== size
      || (requestedBusinessId && result.items.some((item) => item.businessId !== requestedBusinessId))
      || !Number.isInteger(result.totalElements) || result.totalElements! < 0) {
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
  } catch (cause: any) {
    if (id === requestId && requestedBusinessId === businessId.value) {
      const reason = cause.message || '部署列表读取失败';
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
  return row.status === 'stopped'
    && row.deviceIds.every(id => row.deviceStatuses[id]?.status === 'uninstalled');
}
async function removeDeployment(row: DeploymentPage['items'][number]) {
  try {
    await ElMessageBox.confirm(`删除部署记录 ${row.deploymentId}？此操作不可撤销。`, '删除部署记录', { type: 'warning' });
    deletingId.value = row.deploymentId;
    await deleteDeployment(row.deploymentId);
    ElMessage.success('部署记录已删除');
    await load(page.value);
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause.message || '删除部署记录失败');
  } finally { deletingId.value = ''; }
}
function openDetail(deploymentId: string) {
  void router.push({
    name: 'SduiDeploymentDetail',
    params: { deploymentId },
    query: businessId.value ? { businessId: businessId.value } : undefined
  });
}
function deviceStatusLabel(status: string) {
  return ({ ok: '已安装', failed: '失败', skipped: '离线跳过', installing: '安装中', uninstall_pending: '卸载中', uninstalled: '已卸载', uninstall_failed: '卸载失败', uninstall_skipped: '卸载跳过' } as Record<string, string>)[status] || status || '未知';
}
function deviceStatusType(status: string) {
  if (status === 'ok' || status === 'uninstalled') return 'success';
  if (status === 'failed' || status === 'uninstall_failed') return 'danger';
  if (status === 'skipped' || status === 'uninstall_skipped') return 'warning';
  return 'info';
}

watch(businessId, () => {
  page.value = 0;
  total.value = 0;
  items.value = [];
  void load(0);
});
onMounted(() => { void load(page.value); });
onActivated(() => { if (!loading.value) void load(page.value); });
</script>

<style scoped>
.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.page-heading h1{margin:5px 0 8px;font-size:26px;color:#182230}.page-heading p{margin:0;color:#667085}.eyebrow{font-size:11px;letter-spacing:.12em;color:#667085}.primary-cell{display:flex;flex-direction:column;gap:5px}.primary-cell code{font-size:12px;color:#98a2b3}.device-status{margin:2px 5px 2px 0}.muted{color:#98a2b3}.pagination{display:flex;justify-content:flex-end;margin-top:18px}
</style>

<template>
  <main class="app-container business-library">
    <header class="page-heading">
      <div class="page-title">
        <h1>业务</h1>
        <span class="business-count">{{ businesses.length }} 项</span>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" :loading="creating" @click="createBusiness">新建业务</el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      :type="businesses.length ? 'warning' : 'error'"
      :closable="false"
      :title="error"
      class="list-error"
    />

    <el-table v-loading="loading" :data="businesses" row-key="businessId" class="business-table">
      <el-table-column label="业务" min-width="320">
        <template #default="{ row }">
          <div class="business-cell">
            <el-button class="business-link" link @click="openEditor(row.businessId)">
              {{ row.name || '未命名业务' }}
            </el-button>
            <span v-if="row.description" class="business-description">{{ row.description }}</span>
            <code class="business-id">{{ row.businessId }}</code>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="规模" min-width="190">
        <template #default="{ row }">
          <div class="business-size">
            <span><strong>{{ row.uis }}</strong> 个界面</span>
            <span><strong>{{ row.flows?.length || 0 }}</strong> 个环节</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="224" fixed="right" align="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button type="primary" link @click="openEditor(row.businessId)">编辑</el-button>
            <el-button type="primary" link @click="deploy(row.businessId)">部署</el-button>
            <el-dropdown trigger="click" @command="handleRowCommand($event, row)">
              <el-button class="more-button" text circle :icon="MoreFilled" :aria-label="`更多业务操作：${row.name || row.businessId}`" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="deployments">部署记录</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty v-if="!error" description="还没有业务定义">
          <el-button type="primary" @click="createBusiness">新建业务</el-button>
        </el-empty>
      </template>
    </el-table>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MoreFilled, Plus, Refresh } from '@element-plus/icons-vue';
import { deleteBusiness, listBusinesses, saveBusiness } from '@/api/business';
import type { BusinessSummary } from '@/types/sdui-business';
import { errorDetails, isMessageBoxCancellation } from '@/utils/errorDetails';

const router = useRouter();
const loading = ref(false);
const creating = ref(false);
const error = ref('');
const businesses = ref<BusinessSummary[]>([]);
let listRequestId = 0;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function responseData<T>(response: unknown): T {
  return (isRecord(response) ? response.data : undefined) as T;
}

async function load() {
  const requestId = ++listRequestId;
  loading.value = true; error.value = '';
  try {
    const result = responseData<BusinessSummary[]>(await listBusinesses());
    if (requestId !== listRequestId) return;
    if (!Array.isArray(result)) throw new Error('业务列表接口响应格式无效');
    businesses.value = result;
  } catch (cause: unknown) {
    if (requestId === listRequestId) error.value = errorDetails(cause).message || '业务列表读取失败';
  } finally { if (requestId === listRequestId) loading.value = false; }
}
function openEditor(businessId: string) { router.push({ name: 'SduiBusinessEditor', params: { businessId }}); }
function deploy(businessId: string) { router.push({ name: 'SduiBusinessEditor', params: { businessId }, query: { deploy: '1' }}); }
function openDeployments(businessId: string) { router.push({ name: 'SduiDeployments', query: { businessId }}); }
function handleRowCommand(command: string, row: BusinessSummary) {
  if (command === 'deployments') openDeployments(row.businessId);
  if (command === 'delete') void removeBusiness(row);
}

async function removeBusiness(row: BusinessSummary) {
  try {
    await ElMessageBox.confirm(`确定删除业务“${row.name}”吗？`, '删除业务', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
    const response = responseData<Record<string, unknown>>(await deleteBusiness(row.businessId));
    if (response.code !== 20000) throw new Error(typeof response.message === 'string' ? response.message : '业务删除失败');
    ElMessage.success('业务已删除');
    await load();
  } catch (cause: unknown) {
    if (!isMessageBoxCancellation(cause)) ElMessage.error(errorDetails(cause).message || '业务删除失败');
  }
}

async function createBusiness() {
  if (creating.value) return;
  creating.value = true;
  try {
    const result = await ElMessageBox.prompt('输入业务名称', '新建业务', { confirmButtonText: '创建', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '业务名称不能为空' });
    const name = typeof result === 'object' && 'value' in result ? result.value : '';
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const businessId = `${slug || 'business'}_${Date.now().toString(36)}`;
    const definition = { id: businessId, name: name.trim(), description: '', devices: { local: {}}, uis: [], flows: [], mirror: false };
    const response = responseData<Record<string, unknown>>(await saveBusiness(businessId, 0, definition));
    if (response.code !== 20000) throw new Error(typeof response.message === 'string' ? response.message : '业务创建失败');
    ElMessage.success('业务已创建'); await load(); openEditor(businessId);
  } catch (cause: unknown) {
    if (!isMessageBoxCancellation(cause)) ElMessage.error(errorDetails(cause).message || '业务创建失败');
  } finally { creating.value = false; }
}
onMounted(load);
</script>

<style scoped lang="scss">
.business-library {
  --el-color-primary: var(--app-primary);
  --el-color-primary-light-9: var(--app-primary-soft);
  --el-text-color-primary: var(--app-text);
  --el-text-color-regular: var(--app-text-secondary);
  --el-border-color: var(--app-border);
  padding: 24px;
  color: var(--app-text);
}
.page-heading,.page-title,.heading-actions,.business-size,.row-actions { display:flex; align-items:center; }
.page-heading { justify-content:space-between; gap:16px; margin-bottom:20px; }
.page-title { gap:10px; }
.page-title h1 { margin:0; font-size:22px; line-height:30px; font-weight:600; }
.business-count { color:var(--app-text-muted); font-size:14px; }
.heading-actions,.business-size { gap:8px; }
.business-cell { display:grid; justify-items:start; gap:4px; min-width:0; }
.business-link { padding:0; height:auto; max-width:100%; color:var(--app-text); font-size:14px; font-weight:600; white-space:normal; text-align:left; }
.business-link:hover { color:var(--app-primary); }
.business-description { max-width:100%; color:var(--app-text-secondary); line-height:22px; white-space:normal; overflow-wrap:anywhere; }
.business-id { color:var(--app-text-muted); font-size:12px; line-height:18px; }
.business-size { flex-wrap:wrap; gap:8px 16px; color:var(--app-text-secondary); }
.business-size strong { color:var(--app-text); font-variant-numeric:tabular-nums; }
.row-actions { justify-content:flex-end; gap:8px; }
.more-button { color:var(--app-text-secondary); }
.list-error { margin-bottom:16px; }
.business-table { width:100%; }
.business-table :deep(.el-table__header th) { background:var(--app-surface-muted); color:var(--app-text-secondary); font-weight:600; }
.business-table :deep(.el-table__row td) { height:64px; }
.business-table :deep(.el-table__empty-block) { min-height:220px; }
@media (max-width:700px) {
  .business-library { padding:16px; }
  .page-heading { align-items:flex-start; flex-direction:column; }
  .heading-actions { width:100%; }
  .heading-actions .el-button { flex:1; }
}
</style>

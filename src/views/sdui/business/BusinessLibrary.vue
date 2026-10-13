<template>
  <div class="app-container business-library">
    <header class="page-heading">
      <div><span class="eyebrow">SDUI / BUSINESS</span><h1>业务</h1><p>管理业务定义并直接部署到终端。</p></div>
      <div class="heading-actions"><el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button><el-button type="primary" :icon="Plus" :loading="creating" @click="createBusiness">新建业务</el-button></div>
    </header>
    <el-alert v-if="error" :type="businesses.length ? 'warning' : 'error'" :closable="false" :title="error" />
    <el-table v-loading="loading" :data="businesses" row-key="businessId" stripe>
      <el-table-column label="业务" min-width="240"><template #default="{ row }"><div class="business-name"><strong>{{ row.name || '未命名业务' }}</strong><code>{{ row.businessId }}</code></div></template></el-table-column>
      <el-table-column prop="description" label="用途" min-width="200" show-overflow-tooltip />
      <el-table-column label="界面 / 环节概览" min-width="220"><template #default="{ row }"><div class="flow-overview"><span>{{ row.uis }} 个界面 · {{ row.flows?.length || 0 }} 个环节</span><el-tag v-for="flow in (row.flows || []).slice(0, 2)" :key="flow" size="small" effect="plain">{{ flow }}</el-tag><el-tooltip v-if="row.flows?.length > 2" :content="row.flows.slice(2).join(' · ')"><el-tag size="small" effect="plain">+{{ row.flows.length - 2 }}</el-tag></el-tooltip><span v-if="!row.flows?.length" class="no-flows">尚未配置环节</span></div></template></el-table-column>
      <el-table-column label="操作" width="240" fixed="right"><template #default="{ row }"><el-button type="primary" link @click="openEditor(row.businessId)">编辑</el-button><el-button type="success" link @click="deploy(row.businessId)">部署</el-button><el-button link @click="openDeployments(row.businessId)">部署记录</el-button><el-button type="danger" link @click="removeBusiness(row)">删除</el-button></template></el-table-column>
    </el-table>
    <el-empty v-if="!loading && !error && !businesses.length" description="还没有业务定义" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { deleteBusiness, listBusinesses, saveBusiness, type BusinessSummary } from '@/api/business';

const router = useRouter();
const loading = ref(false);
const creating = ref(false);
const error = ref('');
const businesses = ref<BusinessSummary[]>([]);
let listRequestId = 0;
function responseData<T>(response: any): T { return response?.data as T; }

async function load() {
  const requestId = ++listRequestId;
  loading.value = true; error.value = '';
  try {
    const result = responseData<BusinessSummary[]>(await listBusinesses());
    if (requestId !== listRequestId) return;
    if (!Array.isArray(result)) throw new Error('业务列表接口响应格式无效');
    businesses.value = result;
  } catch (cause: any) {
    if (requestId === listRequestId) error.value = cause.message || '业务列表读取失败';
  } finally { if (requestId === listRequestId) loading.value = false; }
}
function openEditor(businessId: string) { router.push({ name: 'SduiBusinessEditor', params: { businessId } }); }
function deploy(businessId: string) { router.push({ name: 'SduiBusinessEditor', params: { businessId }, query: { deploy: '1' } }); }
function openDeployments(businessId: string) { router.push({ name: 'SduiDeployments', query: { businessId } }); }

async function removeBusiness(row: BusinessSummary) {
  try {
    await ElMessageBox.confirm(`确定删除业务“${row.name}”吗？`, '删除业务', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
    const response: any = await deleteBusiness(row.businessId);
    if (response?.code !== 20000) throw new Error(response?.message || '业务删除失败');
    ElMessage.success('业务已删除');
    await load();
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause.message || '业务删除失败');
  }
}

async function createBusiness() {
  if (creating.value) return;
  creating.value = true;
  try {
    const { value: name } = await ElMessageBox.prompt('输入业务名称', '新建业务', { confirmButtonText: '创建', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '业务名称不能为空' });
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const businessId = `${slug || 'business'}_${Date.now().toString(36)}`;
    const definition = { id: businessId, name: name.trim(), description: '', devices: { local: {} }, uis: [], flows: [], mirror: false };
    const response: any = await saveBusiness(businessId, 0, definition);
    if (response?.code !== 20000) throw new Error(response?.message || '业务创建失败');
    ElMessage.success('业务已创建'); await load(); openEditor(businessId);
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause.message || '业务创建失败');
  } finally { creating.value = false; }
}
onMounted(load);
</script>

<style scoped lang="scss">
.page-heading { display:flex; justify-content:space-between; align-items:center; gap:24px; margin-bottom:24px; }
.page-heading h1 { margin:5px 0 8px; font-size:26px; color:#182230; }
.page-heading p { margin:0; color:#667085; }
.eyebrow { color:#667085; font-size:11px; letter-spacing:.12em; }
.heading-actions { display:flex; gap:8px; }
.business-name { display:flex; flex-direction:column; gap:5px; }
.business-name code { color:#98a2b3; font-size:12px; }
.flow-overview { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.flow-overview > span:first-child { color:#667085; white-space:nowrap; }
.flow-overview .no-flows { color:#98a2b3; }
@media (max-width:700px) { .page-heading { align-items:flex-start; flex-direction:column; } }
</style>

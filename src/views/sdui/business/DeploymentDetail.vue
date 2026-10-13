<template>
  <div class="app-container deployment-console">
    <header class="console-heading">
      <div><el-breadcrumb separator="/"><el-breadcrumb-item :to="deploymentListLocation">部署</el-breadcrumb-item><el-breadcrumb-item>部署维护</el-breadcrumb-item></el-breadcrumb><h1>{{ status ? deploymentLabel(status) : '部署维护' }} <el-tag :type="status?.status === 'active' ? 'success' : 'info'">{{ deploymentStatusLabel(status?.status) }}</el-tag></h1><p>{{ status?.deployedAt }}</p></div>
      <div class="page-actions"><el-switch v-model="autoRefresh" active-text="自动刷新"/><el-button :loading="loading" :disabled="operationLoading" @click="load">刷新</el-button><el-button v-if="canInstall" type="primary" :loading="operationLoading" @click="retryInstall">全部重新下发</el-button><el-button v-if="canUninstall" :disabled="uninstallBlocked" :loading="operationLoading" type="danger" plain @click="uninstall">{{ status?.status === 'stopped' ? '重试卸载' : '卸载部署' }}</el-button><el-button v-if="canDelete" type="danger" plain :loading="operationLoading" @click="deleteCurrentDeployment">删除记录</el-button></div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error"/>
    <el-card shadow="never" class="console-card"><template #header><div class="operation-heading"><div><strong>已部署业务快照</strong><el-tag v-if="snapshot?.available && snapshot.sourceAvailable" class="snapshot-diff-tag" :type="snapshot.differsFromSource ? 'warning' : 'success'">{{ snapshot.differsFromSource ? '源业务有未部署修改' : '与当前源业务一致' }}</el-tag><el-tag v-else-if="snapshot?.available && !snapshot.sourceAvailable" class="snapshot-diff-tag" type="info">源业务已不存在</el-tag></div><el-space><el-button link type="primary" :disabled="!snapshot?.available" @click="snapshotVisible = true">查看只读快照</el-button><el-button link :disabled="!status?.businessId || !snapshot?.sourceAvailable" @click="editSourceBusiness">编辑源业务</el-button></el-space></div></template><p class="muted">运行以部署时保存的快照为准；编辑源业务不会改变当前部署。重新部署后才会应用源业务的新内容。</p><el-alert v-if="snapshotError" type="warning" :closable="false" :title="snapshotError"/><el-alert v-else-if="snapshot && !snapshot.available" type="info" :closable="false" title="此部署没有可查看的业务定义快照。"/></el-card>
    <div class="metric-grid"><el-card shadow="never"><small>绑定设备</small><strong>{{ deviceRows.length }}</strong></el-card><el-card shadow="never"><small>已确认安装</small><strong>{{ deviceRows.filter(row => row.status === 'ok').length }}</strong></el-card><el-card shadow="never"><small>业务执行记录</small><strong>{{ recordTotal }}</strong></el-card><el-card shadow="never"><small>失败 / 未完成（本页）</small><strong>{{ executionRecords.filter(row => row.status !== 'passed').length }}</strong></el-card></div>
    <el-card shadow="never" class="console-card"><template #header><div class="operation-heading"><strong>业务部署状态</strong><span class="muted">每个业务部署作为一条记录；此处汇总本次部署涉及的设备状态</span></div></template>
      <el-alert v-if="preflightError" type="warning" :closable="false" :title="preflightError"/><el-alert v-if="uninstallBlocked" type="warning" :closable="false" :title="uninstallBlockReason"/>
      <el-table :data="deviceRows" v-loading="loading"><el-table-column prop="deviceId" label="设备" min-width="190"/><el-table-column prop="role" label="角色" width="80"/><el-table-column label="在线状态" width="100"><template #default="{row}"><el-tag :type="devicePreflight(row.deviceId)?.online ? 'success' : 'info'">{{ devicePreflight(row.deviceId) ? (devicePreflight(row.deviceId)?.online ? '在线' : '离线') : '未查询' }}</el-tag></template></el-table-column><el-table-column label="安装状态" width="120"><template #default="{row}"><el-tag :type="tagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column><el-table-column label="最近执行上报" min-width="170"><template #default="{row}">{{ latestExecution(row.deviceId)?.startedAt || '尚未收到' }}</template></el-table-column><el-table-column label="异常 / 阻塞原因" min-width="180"><template #default="{row}">{{ row.error || devicePreflight(row.deviceId)?.blockingReason || '—' }}</template></el-table-column><el-table-column label="维护" width="330"><template #default="{row}"><el-button v-if="status?.status === 'active' && row.status === 'ok'" link type="primary" :disabled="operationLoading" @click="editDeviceOrder(row.deviceId)">配置主业务顺序</el-button><el-button v-if="status?.status === 'active'" link type="primary" :disabled="operationLoading" @click="installOneDevice(row.deviceId)">重新下发此设备</el-button><el-button v-if="status?.status === 'active' && row.status === 'ok'" link type="danger" :disabled="operationLoading" @click="uninstallOneDevice(row.deviceId)">卸载此设备</el-button></template></el-table-column></el-table>
    </el-card>
    <el-card shadow="never" class="console-card"><template #header><div class="operation-heading"><strong>业务执行记录</strong><el-button link :loading="recordsLoading" @click="loadRecords">刷新记录</el-button></div></template>
      <el-alert v-if="recordsError" type="warning" :closable="false" :title="recordsError"/>
      <div class="record-filters"><el-select v-model="recordDevice" clearable placeholder="全部设备"><el-option v-for="row in deviceRows" :key="row.deviceId" :label="row.deviceId" :value="row.deviceId"/></el-select><el-select v-model="recordStatus" clearable placeholder="全部结果"><el-option label="成功" value="passed"/><el-option label="失败" value="failed"/><el-option label="未完成" value="running"/></el-select></div>
      <el-table :data="visibleRecords" row-key="runId" empty-text="暂无业务执行记录">
        <el-table-column type="expand"><template #default="{row}"><div class="run-details"><p>记录 {{ row.runId }} · {{ row.completedAt ? `完成时间 ${row.completedAt}` : '尚未收到完成结果' }}</p><el-alert v-if="row.error" type="error" :closable="false" :title="row.error"/><el-alert v-if="row.status === 'running' && row.triggerSource.startsWith('local:')" type="warning" :closable="false" title="终端已上报触发，尚未收到本地序列完成上报。可能仍在执行、动作失败或上报丢失，不能判定成功。"/><el-table :data="row.stepSummaries" size="small" empty-text="已收到触发，尚无动作完成信息"><el-table-column label="步骤" width="70"><template #default="{row:step}">{{ step.index + 1 }}</template></el-table-column><el-table-column prop="action" label="动作" min-width="170"/><el-table-column prop="target" label="执行设备" min-width="170"/><el-table-column label="结果" width="90"><template #default="{row:step}"><el-tag :type="step.status === 'ok' ? 'success' : 'danger'">{{ step.status === 'ok' ? '成功' : '失败' }}</el-tag></template></el-table-column><el-table-column label="结果依据 / 错误" min-width="240"><template #default="{row:step}">{{ step.error || (step.detail?.execution === 'terminal' ? '终端序列完成上报' : step.action.startsWith('deployment.') ? '维护操作结果' : '平台请求执行结果') }}<pre v-if="Object.keys(step.detail || {}).length">{{ JSON.stringify(step.detail, null, 2) }}</pre></template></el-table-column></el-table></div></template></el-table-column>
        <el-table-column prop="startedAt" label="收到时间" min-width="180"/><el-table-column prop="deviceId" label="设备" min-width="170"/><el-table-column prop="flowKey" label="业务环节" min-width="150"/><el-table-column label="来源" min-width="190"><template #default="{row}">{{ row.triggerSource.replace('local:', '') }}<small class="source-hint">{{ row.triggerSource.startsWith('local:') ? '终端本地执行' : '业务执行' }}</small></template></el-table-column><el-table-column label="结果" width="160"><template #default="{row}"><el-tag :type="row.status === 'passed' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">{{ row.status === 'passed' ? '已完成' : row.status === 'failed' ? '失败' : row.triggerSource.startsWith('local:') ? '未收到完成上报' : '执行中 / 未完成' }}</el-tag></template></el-table-column><el-table-column prop="error" label="错误" min-width="170"/>
      </el-table><div class="pagination"><el-pagination background layout="total, prev, pager, next" :current-page="recordPage + 1" :page-size="recordPageSize" :total="recordTotal" @current-change="changeRecordPage" /></div><p class="muted">每条记录对应一次业务触发；展开后可查看该次执行的各个环节。部署安装结果汇总在上方设备状态中。</p>
    </el-card>
    <el-collapse class="console-card"><el-collapse-item title="部署信息与外部调用" name="metadata"><el-descriptions v-if="status" :column="2" border><el-descriptions-item label="业务部署">{{ deploymentLabel(status) }}</el-descriptions-item><el-descriptions-item label="停止时间">{{ status.stoppedAt || '—' }}</el-descriptions-item></el-descriptions><p class="muted">每次导出都会生成新密钥并立即撤销此部署之前的外部调用密钥；请同步更新所有调用端。</p><el-button class="credential-button" type="primary" :loading="exportLoading" :disabled="status?.status !== 'active'" @click="exportIntegration">生成新密钥并导出模板</el-button><el-alert v-if="exportError" class="export-error" :title="exportError" type="error" :closable="false" show-icon/></el-collapse-item></el-collapse>
    <el-dialog v-model="credentialVisible" title="集成模板与新密钥" width="760px"><el-alert type="warning" :closable="false" title="本次导出已撤销此部署此前的外部调用密钥。请将新密钥安全保存并更新调用端。"/><p v-if="credential"><strong>本次密钥：</strong><code class="exported-credential">{{ credential.credential }}</code></p><el-space wrap><el-button :disabled="!businessExport" @click="copyBusinessExport">复制 REST 模板</el-button><el-button :disabled="!businessExport" @click="downloadMcpConfig">下载 MCP 客户端配置</el-button><el-button :disabled="!businessExport" @click="downloadSkill">下载 Agent Skill</el-button></el-space><pre v-if="businessExport">{{ JSON.stringify(businessExport, null, 2) }}</pre></el-dialog>
    <el-dialog v-model="snapshotVisible" title="部署业务快照（只读）" width="820px"><el-descriptions v-if="snapshot" :column="2" border><el-descriptions-item label="业务部署">{{ status ? deploymentLabel(status) : '—' }}</el-descriptions-item><el-descriptions-item label="业务名称">{{ snapshot.definition?.name || status?.businessName || '未命名业务' }}</el-descriptions-item></el-descriptions><el-alert v-if="snapshot && !snapshot.available" type="warning" :closable="false" title="此部署记录没有保存业务定义快照。"/><template v-else-if="snapshot"><el-alert v-if="!snapshot.sourceAvailable" type="info" :closable="false" title="源业务已删除；本部署仍按下方快照运行。"/><el-alert v-else-if="snapshot.differsFromSource" type="warning" :closable="false" title="源业务已有未部署修改；本部署仍按下方快照运行。"/><el-alert v-else type="success" :closable="false" title="源业务与本部署快照一致。"/><pre>{{ JSON.stringify(snapshot.definition, null, 2) }}</pre></template><template #footer><el-button @click="snapshotVisible = false">关闭</el-button><el-button type="primary" :disabled="!status?.businessId || !snapshot?.sourceAvailable" @click="editSourceBusiness">编辑源业务</el-button></template></el-dialog>
    <el-dialog v-model="orderVisible" title="主业务与穿透顺序" width="660px"><el-alert v-if="orderError" type="error" :closable="false" :title="orderError"/><p class="muted">列表第一项是主业务。按钮事件会按此顺序寻找第一个绑定该按钮的业务。</p><el-table v-loading="orderLoading" :data="editableInstanceOrder.map((id, index) => ({ id, index }))" row-key="id"><el-table-column label="顺序" width="100"><template #default="{row}">{{ row.index === 0 ? '主业务' : `第 ${row.index + 1} 位` }}</template></el-table-column><el-table-column label="业务部署" min-width="350"><template #default="{row}">{{ instanceLabel(row.id) }}</template></el-table-column><el-table-column label="调整" width="130"><template #default="{row}"><el-button link :disabled="row.index === 0 || orderSaving || orderLoading" @click="moveInstance(row.index, -1)">上移</el-button><el-button link :disabled="row.index === editableInstanceOrder.length - 1 || orderSaving || orderLoading" @click="moveInstance(row.index, 1)">下移</el-button></template></el-table-column></el-table><template #footer><el-button @click="orderVisible = false">取消</el-button><el-button type="primary" :loading="orderSaving" :disabled="orderLoading || editableInstanceOrder.length === 0" @click="saveDeviceOrder">保存并应用</el-button></template></el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, onActivated, onDeactivated, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getDeploymentRuns, installDeploymentDevice, uninstallDeploymentDevice, parseBusinessRun, getDeploymentExport, exportDeploymentCredential, getDeployment, getDeploymentSnapshot, installDeployment, uninstallDeployment, deleteDeployment, getDeviceBusinessOrder, setDeviceBusinessOrder } from '@/api/business';
import type { BusinessExportProjection, DeploymentBusinessSnapshot, DeploymentCredentialExport, DeploymentOperationResult, DeploymentPreflight, DeploymentStatus, BusinessRun } from '@/api/business';
// AppMain keys cached pages by fullPath; each instance must retain its own deployment identity.
const route = useRoute(); const router = useRouter(); const deploymentId = ref(String(route.params.deploymentId || ''));
const sourceBusinessId = typeof route.query.businessId === 'string' ? route.query.businessId : undefined;
const status = ref<DeploymentStatus | null>(null); const deploymentListLocation = computed(() => ({ name: 'SduiDeployments', query: { businessId: sourceBusinessId || status.value?.businessId } })); const loading = ref(false); const operationLoading = ref(false); const preflightLoading = ref(false); const error = ref(''); const preflightError = ref(''); const preflight = ref<DeploymentPreflight | null>(null); const credential = ref<DeploymentCredentialExport | null>(null); const credentialVisible = ref(false); const exportLoading = ref(false); const exportError = ref(''); const businessExport = ref<BusinessExportProjection | null>(null); const operationResult = ref<{ kind: 'install' | 'uninstall'; result: DeploymentOperationResult } | null>(null);
const records = ref<BusinessRun[]>([]);
const snapshot = ref<DeploymentBusinessSnapshot | null>(null);
const snapshotError = ref('');
const snapshotVisible = ref(false);
const orderVisible = ref(false);
const orderDeviceId = ref('');
const editableInstanceOrder = ref<string[]>([]);
const instanceLabels = ref<Record<string, { businessName: string; deploymentSerial: number }>>({});
const orderError = ref('');
const orderLoading = ref(false);
const orderSaving = ref(false);
const recordsLoading = ref(false);
const recordsError = ref('');
const recordPage = ref(0);
const recordPageSize = 20;
const recordTotal = ref(0);
const autoRefresh = ref(true);
const recordDevice = ref('');
const recordStatus = ref('');
let recordsRequest = 0;
const executionRecords = computed(() => records.value.filter(row => !row.triggerSource.startsWith('maintenance:')));
const visibleRecords = computed(() => executionRecords.value.filter(row =>
  (!recordDevice.value || row.deviceId === recordDevice.value) && (!recordStatus.value || row.status === recordStatus.value)));
function latestExecution(deviceId: string) { return executionRecords.value.find(row => row.deviceId === deviceId); }
function deploymentLabel(deployment: DeploymentStatus) { return `${deployment.businessName} · #${deployment.deploymentSerial}`; }
function instanceLabel(id: string) {
  const label = instanceLabels.value[id];
  return label ? `${label.businessName} · #${label.deploymentSerial}` : '业务信息不可用';
}
function devicePreflight(deviceId: string) { return preflight.value?.devices.find(row => row.deviceId === deviceId); }
async function loadRecords() {
  const id = ++recordsRequest;
  const deployment = deploymentId.value;
  recordsLoading.value = true;
  try {
    const data = dataOf(await getDeploymentRuns(deployment, recordPage.value, recordPageSize));
    if (id !== recordsRequest || deployment !== deploymentId.value) return;
    if (!data || data.deploymentId !== deployment || !Array.isArray(data.runs) || !Number.isInteger(data.totalElements)) throw new Error('执行记录格式无效');
    const result = data.runs.map(row => parseBusinessRun(row));
    if (result.some(row => row.deploymentId !== deployment)) throw new Error('执行记录不属于此部署');
    records.value = result;
    recordTotal.value = data.totalElements;
    recordsError.value = '';
  } catch (cause: any) { if (id === recordsRequest) recordsError.value = cause.message || '执行记录读取失败'; }
  finally { if (id === recordsRequest) recordsLoading.value = false; }
}
function changeRecordPage(page: number) { recordPage.value = page - 1; void loadRecords(); }
function editSourceBusiness() {
  const businessId = status.value?.businessId;
  if (!businessId) return;
  snapshotVisible.value = false;
  void router.push({ name: 'SduiBusinessEditor', params: { businessId } });
}
async function editDeviceOrder(deviceId: string) {
  orderDeviceId.value = deviceId;
  orderVisible.value = true;
  orderLoading.value = true;
  orderError.value = '';
  editableInstanceOrder.value = [];
  instanceLabels.value = {};
  try {
    const response = dataOf(await getDeviceBusinessOrder(deviceId));
    if (deviceId !== orderDeviceId.value) return;
    if (!response || response.deviceId !== deviceId || !Array.isArray(response.instanceOrder)
      || response.instanceOrder.some((id) => typeof id !== 'string')
      || new Set(response.instanceOrder).size !== response.instanceOrder.length
      || !response.instanceLabels || typeof response.instanceLabels !== 'object'
      || !response.instanceOrder.includes(deploymentId.value)) throw new Error('设备业务顺序响应格式无效');
    editableInstanceOrder.value = [...response.instanceOrder];
    instanceLabels.value = response.instanceLabels;
  } catch (cause: any) { orderError.value = cause.message || '读取设备业务顺序失败'; }
  finally { orderLoading.value = false; }
}
function moveInstance(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= editableInstanceOrder.value.length) return;
  const order = [...editableInstanceOrder.value];
  [order[index], order[target]] = [order[target], order[index]];
  editableInstanceOrder.value = order;
}
async function saveDeviceOrder() {
  const deviceId = orderDeviceId.value;
  if (!deviceId || orderSaving.value) return;
  orderSaving.value = true;
  orderError.value = '';
  try {
    const response = dataOf(await setDeviceBusinessOrder(deviceId, editableInstanceOrder.value));
    if (deviceId !== orderDeviceId.value) return;
    if (!response || response.deviceId !== deviceId || response.instanceOrder?.join('\0') !== editableInstanceOrder.value.join('\0')) throw new Error('设备未确认新的业务顺序');
    instanceLabels.value = response.instanceLabels || instanceLabels.value;
    ElMessage.success('主业务顺序已应用');
    orderVisible.value = false;
    await load();
  } catch (cause: any) { orderError.value = cause.message || '保存业务顺序失败'; }
  finally { orderSaving.value = false; }
}
async function installOneDevice(deviceId: string) {
  const deployment = deploymentId.value;
  if (!status.value || status.value.deploymentId !== deployment || operationLoading.value) return;
  const requestId = ++operationRequestId;
  operationLoading.value = true;
  try {
    const data = dataOf(await installDeploymentDevice(deployment, deviceId));
    if (deployment !== deploymentId.value) return;
    if (!data || data.deploymentId !== deployment || !Array.isArray(data.devices) || data.devices.length !== 1 || data.devices[0].deviceId !== deviceId) throw new Error('设备安装响应格式无效');
    if (data.failed || data.offline) ElMessage.warning('设备未完成安装，请查看维护记录');
    else ElMessage.success('设备已确认安装');
    await load();
  } catch (cause: any) { ElMessage.error(cause.message || '重新下发失败'); }
  finally { if (requestId === operationRequestId) operationLoading.value = false; }
}
async function uninstallOneDevice(deviceId: string) {
  const deployment = deploymentId.value;
  const requestId = ++operationRequestId;
  try {
    await ElMessageBox.confirm(`确认仅卸载设备 ${deviceId}？设备记录会保留，之后仍可重新下发。`, '卸载此设备', { type: 'warning' });
    if (requestId !== operationRequestId || deployment !== deploymentId.value) return;
    operationLoading.value = true;
    const data = dataOf(await uninstallDeploymentDevice(deployment, deviceId));
    if (!data || data.deploymentId !== deployment || !Array.isArray(data.devices) || data.devices.length !== 1 || data.devices[0].deviceId !== deviceId) throw new Error('设备卸载响应格式无效');
    if (data.failed || data.offline) ElMessage.warning('设备未完成卸载，请查看设备状态');
    else ElMessage.success('设备已卸载，记录已保留');
    await load();
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause.message || '设备卸载失败');
  } finally { if (requestId === operationRequestId) operationLoading.value = false; }
}
let monitorTimer: ReturnType<typeof setInterval> | undefined;
function startMonitoring() {
  if (monitorTimer) return;
  monitorTimer = setInterval(() => {
    if (autoRefresh.value && !operationLoading.value && !exportLoading.value && !loading.value && !recordsLoading.value) void refreshMonitoring();
  }, 5000);
}
async function refreshMonitoring() {
  const deployment = deploymentId.value;
  const generation = deploymentLoadGeneration;
  await loadRecords();
  if (operationLoading.value || exportLoading.value || loading.value || deployment !== deploymentId.value || generation !== deploymentLoadGeneration) return;
  try {
    const data = dataOf(await getDeployment(deployment));
    if (operationLoading.value || exportLoading.value || generation !== deploymentLoadGeneration || deployment !== deploymentId.value) return;
    if (!isDeploymentStatus(data, deployment)) throw new Error('部署状态格式无效');
    status.value = data;
    updateDeviceAvailability(data);
  } catch (cause: any) { if (deployment === deploymentId.value && generation === deploymentLoadGeneration) error.value = cause.message || '部署状态更新失败'; }
}
function stopMonitoring() { if (monitorTimer) clearInterval(monitorTimer); monitorTimer = undefined; }
onMounted(startMonitoring);
onActivated(startMonitoring);
onDeactivated(stopMonitoring);
onUnmounted(() => { stopMonitoring(); recordsRequest++; });

let deploymentLoadGeneration = 0;
let operationRequestId = 0;
let exportRequestId = 0;
function dataOf<T>(response: { data?: T } | null | undefined): T | undefined { return response?.data; }
const deviceRows = computed(() => {
  const deployment = status.value;
  if (!deployment) return [];
  const ids = new Set<string>([
    ...(deployment.deviceIds || []),
    deployment.slotBindings?.local,
    deployment.slotBindings?.target
  ].filter((id): id is string => typeof id === 'string' && id.length > 0));
  return [...ids].map(deviceId => {
    const value = deployment.deviceStatuses?.[deviceId];
    return { deviceId, role: deviceId === deployment.slotBindings?.local ? '本机' : '对端', status: value?.status || 'pending', error: value?.error || '' };
  });
});
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function isDeploymentStatus(value: unknown, expectedId: string): value is DeploymentStatus {
  if (!isRecord(value) || value.deploymentId !== expectedId
    || typeof value.businessId !== 'string'
    || typeof value.businessName !== 'string'
    || !Number.isInteger(value.deploymentSerial) || (value.deploymentSerial as number) < 1
    || !['active', 'stopped'].includes(String(value.status)) || !Array.isArray(value.deviceIds)
    || !value.deviceIds.every((id) => typeof id === 'string' && id.length > 0)
    || new Set(value.deviceIds).size !== value.deviceIds.length
    || !isRecord(value.deviceStatuses) || !isRecord(value.slotBindings)
    || !(value.slotBindings.local === null || typeof value.slotBindings.local === 'string')
    || !(value.slotBindings.target == null || typeof value.slotBindings.target === 'string')
    || typeof value.slotBindings.local !== 'string'
    || !value.deviceIds.includes(value.slotBindings.local)
    || (typeof value.slotBindings.target === 'string' && !value.deviceIds.includes(value.slotBindings.target))
    || !(value.deployedAt === null || typeof value.deployedAt === 'string')
    || !(value.stoppedAt === null || typeof value.stoppedAt === 'string')) return false;
  const allowedStates = new Set(['ok', 'failed', 'skipped', 'installing', 'uninstall_pending', 'uninstalled', 'uninstall_failed', 'uninstall_skipped']);
  const deviceIds = value.deviceIds as string[];
  return Object.entries(value.deviceStatuses).every(([deviceId, item]) => deviceIds.includes(deviceId)
    && isRecord(item) && typeof item.status === 'string' && allowedStates.has(item.status)
    && (item.error == null || typeof item.error === 'string'));
}
function isOperationResult(value: unknown, deployment: DeploymentStatus, kind: 'install' | 'uninstall'): value is DeploymentOperationResult {
  if (!isRecord(value) || value.deploymentId !== deployment.deploymentId
    || !['succeeded', 'offline', 'failed'].every((key) => typeof value[key] === 'number'
      && Number.isInteger(value[key]) && (value[key] as number) >= 0)
    || !Array.isArray(value.devices) || value.devices.length !== deployment.deviceIds.length) return false;
  if (kind === 'install' && (!Number.isInteger(value.online) || (value.online as number) < 0)) return false;
  const seen = new Set<string>();
  let succeeded = 0;
  let offline = 0;
  let failed = 0;
  for (const item of value.devices) {
    if (!isRecord(item) || typeof item.deviceId !== 'string' || !deployment.deviceIds.includes(item.deviceId)
      || seen.has(item.deviceId) || typeof item.role !== 'string' || typeof item.status !== 'string'
      || !(item.error == null || typeof item.error === 'string')) return false;
    const expectedRole = item.deviceId === deployment.slotBindings.local ? 'local' : 'target';
    if (item.role !== expectedRole) return false;
    seen.add(item.deviceId);
    if (kind === 'install') {
      if (!['ok', 'failed', 'skipped'].includes(item.status)) return false;
      if (item.status === 'ok') succeeded++;
      else if (item.status === 'failed') failed++;
      else offline++;
    } else {
      if (!['uninstalled', 'failed', 'skipped'].includes(item.status)) return false;
      if (item.status === 'uninstalled') succeeded++;
      else if (item.status === 'failed') failed++;
      else offline++;
    }
  }
  return deployment.deviceIds.every((id) => seen.has(id))
    && succeeded === value.succeeded && offline === value.offline && failed === value.failed
    && (kind === 'uninstall' || value.online === succeeded + failed);
}
const activeInstallLeaseDevices = computed(() => preflight.value?.devices.filter(device => device.blockingReason === 'deployment_install_in_progress') || []);
const uninstallBlocked = computed(() => status.value?.status === 'active'
  && (!preflight.value || preflightLoading.value || Boolean(preflightError.value) || activeInstallLeaseDevices.value.length > 0));
const uninstallBlockReason = computed(() => activeInstallLeaseDevices.value.length
  ? '设备安装租约仍有效，后端暂不接受卸载。等待安装结束后重试。'
  : '卸载前需要最新的设备状态；请刷新状态后再试。');
const canInstall = computed(() => status.value?.status === 'active' && Boolean(preflight.value?.devices.some(device => device.willDeploy)));
const canUninstall = computed(() => status.value?.status === 'active'
  || (status.value?.status === 'stopped' && deviceRows.value.some(row => ['uninstall_pending', 'uninstall_failed', 'uninstall_skipped'].includes(row.status))));
const canDelete = computed(() => status.value?.status === 'stopped'
  && deviceRows.value.every(row => row.status === 'uninstalled'));
function tagType(value?: string) {
  if (['ok', 'uninstalled', 'installed', 'active', 'success'].includes(value || '')) return 'success';
  if (['failed', 'uninstall_failed', 'error', 'blocked'].includes(value || '')) return 'danger';
  return 'warning';
}
function statusLabel(value?: string) {
  return ({ ok: '已安装', failed: '失败', skipped: '离线跳过', installing: '安装中', pending: '待安装', uninstalled: '已卸载', uninstall_pending: '卸载中', uninstall_failed: '卸载失败', uninstall_skipped: '卸载跳过', active: '运行中', stopped: '已停止', failed_deployment: '部署失败' } as Record<string, string>)[value || ''] || value || '未知状态';
}
function deploymentStatusLabel(value?: string) {
  return ({ active: '活动', stopped: '已停止', failed: '部署失败' } as Record<string, string>)[value || ''] || value || '读取中';
}
function updateDeviceAvailability(deployment: DeploymentStatus) {
  const devices = deployment.deviceIds.map(deviceId => {
    const device = deployment.deviceStatuses[deviceId];
    const online = Boolean(device?.online);
    const busy = Boolean(device?.installing);
    return { deviceId, role: deviceId === deployment.slotBindings.local ? 'local' : 'target', online,
      willDeploy: online && !busy, blockingReason: busy ? 'deployment_install_in_progress' : online ? null : 'device_offline' };
  });
  preflight.value = { deploymentId: deployment.deploymentId, devices,
    deployable: devices.filter(device => device.willDeploy).length,
    blocked: devices.filter(device => !device.willDeploy).length, blocks: [] };
}

async function load() {
  if (exportLoading.value) return;
  const generation = ++deploymentLoadGeneration;
  if (records.value.some(row => row.deploymentId !== deploymentId.value)) records.value = [];
  exportRequestId++;
  exportLoading.value = false;
  exportError.value = '';
  businessExport.value = null;
  credential.value = null;
  credentialVisible.value = false;
  const requestedDeploymentId = deploymentId.value;
  loading.value = true;
  error.value = '';
  status.value = null;
  snapshot.value = null;
  snapshotError.value = '';
  snapshotVisible.value = false;
  preflight.value = null;
  preflightError.value = '';
  try {
    const result = await getDeployment(requestedDeploymentId);
    if (generation !== deploymentLoadGeneration || requestedDeploymentId !== deploymentId.value) return;
    const deployment = dataOf(result);
    if (!isDeploymentStatus(deployment, requestedDeploymentId)) throw new Error('部署详情接口响应格式无效');
    status.value = deployment;
    try {
      const frozen = dataOf(await getDeploymentSnapshot(requestedDeploymentId));
      if (!frozen || frozen.deploymentId !== requestedDeploymentId || frozen.businessId !== deployment.businessId
        || typeof frozen.available !== 'boolean' || typeof frozen.sourceAvailable !== 'boolean'
        || typeof frozen.differsFromSource !== 'boolean' || !frozen.definition || typeof frozen.definition !== 'object'
        || Array.isArray(frozen.definition)) throw new Error('部署快照接口响应格式无效');
      snapshot.value = frozen;
    } catch (cause: any) { snapshotError.value = cause.message || '部署快照读取失败'; }
    await loadRecords();
    updateDeviceAvailability(deployment);
  } catch (cause: any) { if (generation === deploymentLoadGeneration && requestedDeploymentId === deploymentId.value) error.value = cause.message || '部署详情读取失败'; }
  finally { if (generation === deploymentLoadGeneration) loading.value = false; }
}
async function retryInstall() {
  const requestedDeploymentId = deploymentId.value;
  const deploymentSnapshot = status.value;
  if (!deploymentSnapshot || deploymentSnapshot.deploymentId !== requestedDeploymentId) return;
  const requestId = ++operationRequestId;
  if (requestId !== operationRequestId || requestedDeploymentId !== deploymentId.value
    || status.value?.deploymentId !== deploymentSnapshot.deploymentId) return;
  operationLoading.value = true;
  try {
    const result = dataOf(await installDeployment(requestedDeploymentId));
    if (!isOperationResult(result, deploymentSnapshot, 'install')) throw new Error('安装接口响应与部署绑定设备或汇总计数不一致');
    if (requestId !== operationRequestId || requestedDeploymentId !== deploymentId.value) return;
    operationResult.value = { kind: 'install', result };
    const partial = result.failed > 0 || result.offline > 0;
    ElMessage[partial ? 'warning' : 'success'](partial
      ? `安装已处理但未全部成功：成功 ${result.succeeded}，离线 ${result.offline}，失败 ${result.failed}`
      : `部署安装完成：成功 ${result.succeeded} 台`);
    await load();
  }
  catch (cause: any) {
    if (requestId === operationRequestId && requestedDeploymentId === deploymentId.value) {
      ElMessage.error(cause.message || '重新下发失败');
      await load();
    }
  }
  finally { if (requestId === operationRequestId) operationLoading.value = false; }
}
async function uninstall() {
  const requestedDeploymentId = deploymentId.value;
  const deploymentSnapshot = status.value;
  if (!deploymentSnapshot || deploymentSnapshot.deploymentId !== requestedDeploymentId) return;
  const requestId = ++operationRequestId;
  try {
    const retrying = deploymentSnapshot.status === 'stopped';
    await ElMessageBox.confirm(
      retrying ? '重试会继续处理未确认卸载的设备；已确认卸载的设备会保持原状。' : '确认卸载此部署？设备将清理当前业务环境。',
      retrying ? '重试卸载' : '卸载业务',
      { type: 'warning', confirmButtonText: retrying ? '重试卸载' : '确认卸载' }
    );
    if (requestId !== operationRequestId || requestedDeploymentId !== deploymentId.value
      || status.value?.deploymentId !== deploymentSnapshot.deploymentId) return;
    operationLoading.value = true;
    const result = dataOf(await uninstallDeployment(requestedDeploymentId));
    if (!isOperationResult(result, deploymentSnapshot, 'uninstall')) throw new Error('卸载接口响应与部署绑定设备或汇总计数不一致');
    if (requestId !== operationRequestId || requestedDeploymentId !== deploymentId.value) return;
    operationResult.value = { kind: 'uninstall', result };
    const partial = result.failed > 0 || result.offline > 0;
    ElMessage[partial ? 'warning' : 'success'](partial
      ? `卸载已处理但未全部成功：成功 ${result.succeeded}，离线 ${result.offline}，失败 ${result.failed}`
      : `部署卸载完成：成功 ${result.succeeded} 台`);
    await load();
  } catch (cause: any) {
    if (requestId === operationRequestId && requestedDeploymentId === deploymentId.value
      && cause !== 'cancel' && cause !== 'close') {
      ElMessage.error(cause.message || '卸载失败');
      await load();
    }
  } finally { if (requestId === operationRequestId) operationLoading.value = false; }
}
async function deleteCurrentDeployment() {
  const deploymentIdToDelete = deploymentId.value;
  const deployment = status.value;
  if (!deployment || !canDelete.value) return;
  try {
    await ElMessageBox.confirm('删除此部署记录不可撤销。执行记录会保留。', '删除部署记录', { type: 'warning' });
    operationLoading.value = true;
    await deleteDeployment(deploymentIdToDelete);
    ElMessage.success('部署记录已删除');
    await router.replace(deploymentListLocation.value);
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause.message || '删除部署记录失败');
  } finally { operationLoading.value = false; }
}
async function exportIntegration() {
  const deployment = status.value;
  const requestedDeploymentId = deploymentId.value;
  if (!deployment || deployment.deploymentId !== requestedDeploymentId || deployment.status !== 'active'
    || exportLoading.value || loading.value || operationLoading.value) return;
  exportLoading.value = true;
  exportError.value = '';
  try {
    await ElMessageBox.confirm(
      '继续导出会生成新密钥，并立即撤销此部署此前的外部调用密钥。请准备好同步更新所有调用端。',
      '轮换外部调用密钥', { type: 'warning', confirmButtonText: '生成并导出', cancelButtonText: '取消' }
    );
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close') exportError.value = cause.message || '导出已取消';
    exportLoading.value = false;
    return;
  }

  const requestId = ++exportRequestId;
  const generation = deploymentLoadGeneration;
  exportLoading.value = true;
  exportError.value = '';
  credential.value = null;
  businessExport.value = null;
  try {
    const template = dataOf<BusinessExportProjection>(await getDeploymentExport(requestedDeploymentId));
    if (requestId !== exportRequestId || generation !== deploymentLoadGeneration
      || requestedDeploymentId !== deploymentId.value) return;
    if (!template || template.businessId !== deployment.businessId || !Array.isArray(template.instances)
      || typeof template.tenantId !== 'string' || typeof template.instructions !== 'string'
      || template.instances.some((instance) => !instance || typeof instance !== 'object' || Array.isArray(instance)
        || typeof instance.deviceId !== 'string'
        || typeof instance.credential !== 'string')) {
      throw new Error('部署导出模板响应格式无效');
    }
    const instance = template.instances.find((candidate) => candidate.deviceId === deployment.slotBindings.local);
    if (!instance) throw new Error('导出模板中没有当前部署的本机实例，请检查部署快照');

    const exported = dataOf<DeploymentCredentialExport>(await exportDeploymentCredential(requestedDeploymentId));
    if (requestId !== exportRequestId || generation !== deploymentLoadGeneration
      || requestedDeploymentId !== deploymentId.value) return;
    const expectedEndpoint = `/api/v1/sdui/businesses/${encodeURIComponent(deployment.businessId)}/triggers/{triggerName}`;
    if (!exported || exported.deploymentId !== deployment.deploymentId
      || exported.businessId !== deployment.businessId || exported.deviceId !== deployment.slotBindings.local
      || exported.endpoint !== expectedEndpoint || typeof exported.tenantId !== 'string'
      || typeof exported.credential !== 'string' || !exported.credential.startsWith('xc_')
      || !Array.isArray(exported.triggers) || !exported.triggers.length
      || !exported.triggers.every((name) => typeof name === 'string' && name.length > 0)) {
      throw new Error('密钥轮换接口响应与当前部署不匹配');
    }
    credential.value = exported;
    businessExport.value = {
      ...template,
      name: deployment.businessName,
      tenantId: exported.tenantId,
      instances: [{ ...instance, credential: exported.credential }]
    };
    credentialVisible.value = true;
    ElMessage.success('新密钥已生成，旧密钥已撤销');
  } catch (cause: any) {
    if (requestId === exportRequestId && generation === deploymentLoadGeneration
      && requestedDeploymentId === deploymentId.value) exportError.value = cause.message || '生成集成模板失败';
  } finally {
    if (requestId === exportRequestId) exportLoading.value = false;
  }
}
async function copyBusinessExport() {
  if (!businessExport.value) return;
  const text = JSON.stringify(businessExport.value, null, 2);
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('浏览器拒绝访问剪贴板');
    }
    ElMessage.success('集成模板已复制，已包含本次生成的新密钥');
  } catch {
    ElMessage.error('复制失败，请从弹窗中手动复制集成模板');
  }
}
function integrationEndpoint(path: string) {
  const base = String(import.meta.env.VITE_BASE_API || '/');
  return new URL(`${base.replace(/\/$/, '')}${path}`, window.location.origin).toString();
}
function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function exportedInstance() {
  return businessExport.value?.instances[0];
}
function downloadMcpConfig() {
  const instance = exportedInstance();
  if (!instance || !credential.value || !businessExport.value) return;
  const url = integrationEndpoint(`/api/v1/sdui/mcp/businesses/${encodeURIComponent(businessExport.value.businessId)}`);
  const config = {
    mcpServers: {
      [`agentnexus-${businessExport.value.businessId}`]: {
        type: 'http',
        url,
        headers: {
          'X-Space-Id': businessExport.value.tenantId,
          'X-AgentNexus-Credential': instance.credential
        }
      }
    }
  };
  downloadText(`agentnexus-${businessExport.value.businessId}-mcp.json`, `${JSON.stringify(config, null, 2)}\n`, 'application/json;charset=utf-8');
  ElMessage.success('MCP 客户端配置已下载');
}
function downloadSkill() {
  const instance = exportedInstance();
  const app = businessExport.value;
  if (!instance || !credential.value || !app) return;
  const triggerDocs = instance.triggers.map(trigger => {
    const values = trigger.values.length
      ? trigger.values.map(value => `- \`${value.name}\` (${value.type})${value.required ? '，必填' : '，可选'}${value.description ? `：${value.description}` : ''}`).join('\n')
      : '- 无输入值';
    return `### ${trigger.name}\n\n环节：${trigger.flowKey}\n\n参数：\n${values}`;
  }).join('\n\n');
  const text = `---\nname: ${app.businessId}\ndescription: 调用 AgentNexus 已部署业务「${app.name}」的外部触发器。\n---\n\n# ${app.name}\n\n${app.description || '调用已部署的 AgentNexus 业务。'}\n\n## 连接信息\n\n- MCP 服务：\`${integrationEndpoint(`/api/v1/sdui/mcp/businesses/${encodeURIComponent(app.businessId)}`)}\`\n- 租户：\`${app.tenantId}\`\n- 触发凭据：\`${instance.credential}\`\n\n优先使用 MCP 工具调用。也可通过 REST 调用：向 \`${integrationEndpoint(instance.endpoint.replace('{triggerName}', '<triggerName>'))}\` 发送 POST，请求头设置 \`X-Space-Id: ${app.tenantId}\`，请求体为 \`{ "credential": "${instance.credential}", "values": { ... } }\`。建议每次调用提供唯一的 \`Idempotency-Key\`。\n\n## 可用触发器\n\n${triggerDocs}\n\n## 调用规则\n\n1. 根据用户意图选择匹配的触发器。\n2. 先确认必填值齐全且类型正确，再调用工具。\n3. 图像和音频值传资源句柄字符串；数字序列传数字数组。\n4. 将调用结果中的 runId 和执行状态如实告知用户。\n5. 此凭据只对当前部署有效；重新导出密钥后需更新本文件和 MCP 配置。\n`;
  downloadText(`${app.businessId}-SKILL.md`, text, 'text/markdown;charset=utf-8');
  ElMessage.success('Agent Skill 已下载');
}
onMounted(load);

</script>


<style scoped>
.console-heading{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:24px}.console-heading h1{font-size:24px;margin:12px 0}.console-heading p,.muted,.source-hint{color:#667085;font-size:12px}.page-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}.metric-grid strong{display:block;font-size:28px;margin-top:12px}.metric-grid small{color:#667085}.console-card{margin-bottom:20px}.operation-heading{display:flex;justify-content:space-between;align-items:center}.snapshot-diff-tag{margin-left:10px;vertical-align:middle}.record-filters{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}.record-filters .el-select{width:190px}.source-hint{display:block;margin-top:5px}.run-details{padding:16px 32px;background:#f8fafc}.run-details pre{font-size:12px;white-space:pre-wrap}.credential-button{margin-top:16px}.export-error{margin-top:12px}.exported-credential{display:block;overflow-wrap:anywhere;user-select:all;padding:8px;background:#f4f6f8}@media(max-width:800px){.metric-grid{grid-template-columns:repeat(2,1fr)}}
</style>

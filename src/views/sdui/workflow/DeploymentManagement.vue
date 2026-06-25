<template>
  <div class="deployment-page app-container">
    <section class="page-hero">
      <div>
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回工作流
        </el-button>
        <h1>部署管理</h1>
        <p class="muted">工作流：{{ workflowName || workflowId }}</p>
      </div>
    </section>

    <el-tabs v-model="statusFilter" @tab-change="loadDeployments">
      <el-tab-pane label="活跃" name="active" />
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="已停止" name="stopped" />
    </el-tabs>

    <div v-loading="loading">
      <article
        v-for="dep in deployments"
        :key="dep.id"
        class="deployment-card"
      >
        <div class="dep-header">
          <div class="dep-title">
            <strong>{{ dep.id }}</strong>
            <el-tag
              :type="dep.status === 'active' ? 'success' : dep.status === 'stopped' ? 'info' : 'warning'"
              size="small"
            >
              {{ dep.status }}
            </el-tag>
            <el-tag
              v-if="dep.health"
              :type="dep.health === 'ok' ? 'success' : 'danger'"
              size="small"
            >
              {{ dep.health }}
            </el-tag>
          </div>
          <span class="muted">{{ formatDate(dep.deployedAt) }}</span>
        </div>

        <div class="dep-bindings">
          <span
            v-for="(deviceId, slotId) in dep.slotBindings"
            :key="slotId"
            class="binding-chip"
          >
            {{ slotId }} → {{ deviceId }}
            <el-tag
              size="small"
              :type="dep.deviceStatuses?.[slotId]?.online ? 'success' : 'info'"
              effect="dark"
            >
              {{ dep.deviceStatuses?.[slotId]?.online ? '在线' : '离线' }}
            </el-tag>
          </span>
        </div>

        <div v-if="dep.lastRun" class="dep-run-info muted">
          最近运行：
          <el-tag
            :type="dep.lastRun.status === 'passed' ? 'success' : 'danger'"
            size="small"
          >
            {{ dep.lastRun.status }}
          </el-tag>
          {{ formatDate(dep.lastRun.startedAt) }}
        </div>

        <div class="dep-actions">
          <el-button size="small" @click="viewDetail(dep)">详情</el-button>
          <el-button
            size="small"
            @click="inspectDeployment(dep)"
          >
            检查
          </el-button>
          <el-button
            v-if="dep.status === 'active'"
            size="small"
            type="primary"
            @click="testTriggerDeployment(dep)"
          >
            测试触发
          </el-button>
          <el-button
            v-if="dep.status === 'active'"
            size="small"
            type="danger"
            @click="stopDeploymentConfirm(dep)"
          >
            停止
          </el-button>
          <el-button
            size="small"
            @click="viewRuns(dep)"
          >
            运行记录
          </el-button>
        </div>
      </article>

      <el-empty
        v-if="!loading && !deployments.length"
        description="暂无部署"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import {
  listDeployments,
  stopDeployment,
  testTrigger,
  inspectDeployment as inspectApi
} from '@/api/node-workflow';
import { getWorkflow } from '@/api/node-workflow';

const router = useRouter();
const route = useRoute();
const workflowId = route.params.workflowId as string;
const workflowName = ref('');
const loading = ref(false);
const statusFilter = ref('active');
const deployments = ref<DeploymentInfo[]>([]);

onMounted(async () => {
  await loadWorkflowName();
  await loadDeployments();
});

async function loadWorkflowName() {
  try {
    const res: any = await getWorkflow(workflowId);
    workflowName.value = res?.data?.name || res?.name || '';
  } catch {
    // ignore
  }
}

async function loadDeployments() {
  loading.value = true;
  try {
    const res: any = await listDeployments(workflowId);
    const items = Array.isArray(res?.data) ? res.data : [];
    const filtered =
      statusFilter.value === 'all'
        ? items
        : items.filter((d: any) => d.status === statusFilter.value);
    deployments.value = filtered.map((d: any) => ({
      id: String(d.deploymentId || d.id || ''),
      workflowId: String(d.workflowId || workflowId),
      status: d.status || 'active',
      slotBindings: d.slotBindings || {},
      deployedAt: d.deployedAt || '',
      stoppedAt: d.stoppedAt,
      replacedDeployments: d.replacedDeployments || [],
      deviceStatuses: d.deviceStatuses || {},
      uiContexts: d.uiContexts,
      lastRun: d.lastRun || null,
      runCount: d.runCount || 0,
      failedRunCount: d.failedRunCount || 0,
      health: d.health || ''
    }));
  } catch {
    deployments.value = [];
    ElMessage.error('加载部署列表失败');
  } finally {
    loading.value = false;
  }
}

function viewDetail(dep: DeploymentInfo) {
  router.push({
    name: 'SduiWorkflowDeploymentDetail',
    params: { workflowId, deploymentId: dep.id }
  });
}

function viewRuns(dep: DeploymentInfo) {
  router.push({
    name: 'SduiWorkflowRuns',
    query: { workflowId, deploymentId: dep.id }
  });
}

async function inspectDeployment(dep: DeploymentInfo) {
  try {
    const res: any = await inspectApi(workflowId, {
      slotBindings: dep.slotBindings
    });
    const inspection = res?.data || res;
    const errors = inspection?.errors || [];
    const warnings = inspection?.warnings || [];
    if (errors.length) {
      ElMessage.error(`检查发现 ${errors.length} 个错误：${errors.join('; ')}`);
    } else if (warnings.length) {
      ElMessage.warning(`检查通过，${warnings.length} 个警告：${warnings.join('; ')}`);
    } else {
      ElMessage.success('检查通过，无问题');
    }
  } catch {
    ElMessage.error('检查请求失败');
  }
}

async function testTriggerDeployment(dep: DeploymentInfo) {
  try {
    await testTrigger(workflowId, dep.id);
    ElMessage.success('测试触发已发送');
  } catch {
    ElMessage.error('测试触发失败');
  }
}

async function stopDeploymentConfirm(dep: DeploymentInfo) {
  try {
    await ElMessageBox.confirm(
      `确认停止部署 ${dep.id}？`,
      '停止部署',
      { type: 'warning', confirmButtonText: '停止', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }

  try {
    await stopDeployment(workflowId, dep.id);
    ElMessage.success('部署已停止');
    await loadDeployments();
  } catch {
    ElMessage.error('停止部署失败');
  }
}

function goBack() {
  router.push({ name: 'SduiNodeWorkflows' });
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.deployment-page {
  min-height: calc(100vh - 84px);
  padding: 18px;
  background: #f5f7fb;
}

.page-hero {
  margin-bottom: 16px;
}

.page-hero h1 {
  margin: 4px 0;
  font-size: 28px;
  font-weight: 800;
  color: #122033;
}

.muted { color: #64748b; font-size: 13px; }

.deployment-card {
  margin-bottom: 12px;
  padding: 16px 18px;
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.dep-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dep-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.dep-bindings {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.binding-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 12px;
  background: #f0f5ff;
  font-size: 12px;
  font-family: Menlo, Monaco, Consolas, monospace;
}

.dep-run-info {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dep-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

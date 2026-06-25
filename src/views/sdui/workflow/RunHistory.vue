<template>
  <div class="run-history app-container">
    <section class="page-hero">
      <div>
        <h1>运行记录</h1>
        <p v-if="deploymentId" class="muted">部署 ID：{{ deploymentId }}</p>
      </div>
      <div class="hero-actions">
        <el-select
          v-model="statusFilter"
          placeholder="状态筛选"
          clearable
          style="width: 140px"
          @change="loadRuns"
        >
          <el-option label="全部" value="" />
          <el-option label="运行中" value="running" />
          <el-option label="成功" value="passed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button @click="loadRuns">刷新</el-button>
      </div>
    </section>

    <section class="panel-card">
      <el-table
        v-loading="loading"
        :data="runs"
        border
        stripe
        size="small"
        @row-click="viewDetail"
        style="cursor: pointer"
      >
        <el-table-column prop="runId" label="Run ID" width="200">
          <template #default="{ row }">
            <span class="mono">{{ row.runId?.slice(0, 12) }}...</span>
          </template>
        </el-table-column>
        <el-table-column prop="triggerNodeId" label="触发节点" width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="
                row.status === 'passed' ? 'success'
                : row.status === 'failed' ? 'danger'
                : row.status === 'running' ? 'warning'
                : 'info'
              "
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.startedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="结束时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.completedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="error" label="错误信息" min-width="200">
          <template #default="{ row }">
            <span class="error-text">{{ row.error || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !runs.length"
        description="暂无运行记录"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  listDeploymentRuns,
  getWorkflow,
  listDeployments
} from '@/api/node-workflow';

const router = useRouter();
const route = useRoute();
const workflowId = (route.params.workflowId as string) || (route.query.workflowId as string);
const deploymentId = (route.params.deploymentId as string) || (route.query.deploymentId as string);
const loading = ref(false);
const statusFilter = ref('');
const runs = ref<RunInfo[]>([]);

onMounted(async () => {
  // 如果没有 deploymentId，加载该 workflow 的所有部署的 runs
  await loadRuns();
});

async function loadRuns() {
  loading.value = true;
  try {
    let allRuns: any[] = [];
    if (deploymentId) {
      const res: any = await listDeploymentRuns(workflowId, deploymentId);
      allRuns = Array.isArray(res?.data) ? res.data : [];
    } else if (workflowId) {
      // 遍历所有部署
      const depRes: any = await listDeployments(workflowId);
      const deps = Array.isArray(depRes?.data) ? depRes.data : [];
      for (const dep of deps) {
        const depId = dep.id;
        if (depId) {
          try {
            const runRes: any = await listDeploymentRuns(workflowId, depId);
            const depRuns = Array.isArray(runRes?.data) ? runRes.data : [];
            allRuns.push(...depRuns);
          } catch {
            // skip
          }
        }
      }
    } else {
      ElMessage.warning('缺少 workflowId 参数');
      return;
    }

    const filtered =
      statusFilter.value
        ? allRuns.filter((r: any) => r.status === statusFilter.value)
        : allRuns;

    runs.value = filtered.map((r: any) => ({
      runId: String(r.runId || r.id || ''),
      workflowId: String(r.workflowId || workflowId || ''),
      deploymentId: String(r.deploymentId || ''),
      triggerNodeId: String(r.triggerNodeId || ''),
      status: r.status || 'unknown',
      triggerEvent: r.triggerEvent,
      context: r.context,
      error: r.error || null,
      startedAt: r.startedAt || '',
      completedAt: r.completedAt || null,
      steps: r.steps || []
    }));
  } catch {
    runs.value = [];
    ElMessage.error('加载运行记录失败');
  } finally {
    loading.value = false;
  }
}

function viewDetail(row: RunInfo) {
  router.push({
    name: 'SduiWorkflowRunDetail',
    params: { workflowId: row.workflowId, runId: row.runId }
  });
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.run-history {
  min-height: calc(100vh - 84px);
  padding: 18px;
  background: #f5f7fb;
}

.page-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-hero h1 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 800;
  color: #122033;
}

.hero-actions {
  display: flex;
  gap: 10px;
}

.muted { color: #64748b; font-size: 13px; }

.panel-card {
  padding: 18px;
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.mono {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.error-text {
  color: #e6a23c;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}
</style>

<template>
  <div class="run-detail-page app-container">
    <section class="page-hero">
      <div>
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回运行记录
        </el-button>
        <h1>运行详情</h1>
      </div>
    </section>

    <div v-loading="loading">
      <!-- 基本信息 -->
      <section v-if="run" class="panel-card detail-section">
        <h3>基本信息</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="Run ID">
            {{ run.runId }}
          </el-descriptions-item>
          <el-descriptions-item label="工作流 ID">
            {{ run.workflowId }}
          </el-descriptions-item>
          <el-descriptions-item label="部署 ID">
            {{ run.deploymentId }}
          </el-descriptions-item>
          <el-descriptions-item label="触发节点">
            {{ run.triggerNodeId }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="
                run.status === 'passed' ? 'success'
                : run.status === 'failed' ? 'danger'
                : run.status === 'running' ? 'warning'
                : 'info'
              "
            >
              {{ run.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ formatDate(run.startedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="结束时间">
            {{ formatDate(run.completedAt) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="run.error"
            label="错误"
            :span="2"
          >
            <span class="error-text">{{ run.error }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <!-- 执行步骤 -->
      <section v-if="run?.steps?.length" class="panel-card detail-section">
        <h3>执行步骤 ({{ run.steps.length }})</h3>
        <div class="step-list">
          <div
            v-for="(step, idx) in run.steps"
            :key="idx"
            class="step-item"
          >
            <div class="step-indicator">
              <span
                class="step-dot"
                :style="{
                  background: step.status === 'passed' ? '#52c41a' : '#f56c6c'
                }"
              ></span>
              <span
                v-if="idx < (run.steps?.length || 0) - 1"
                class="step-line"
              ></span>
            </div>
            <div class="step-body">
              <div class="step-header">
                <strong>{{ step.nodeType }}</strong>
                <span class="muted mono">{{ step.nodeId }}</span>
                <el-tag
                  :type="step.status === 'passed' ? 'success' : 'danger'"
                  size="small"
                >
                  {{ step.status }}
                </el-tag>
              </div>
              <div class="step-meta muted">
                <span>槽位：{{ step.slotId }}</span>
                <span>设备：{{ step.deviceId }}</span>
              </div>
              <div v-if="step.error" class="step-error">
                {{ step.error }}
              </div>
              <div v-if="step.result">
                <el-button
                  size="small"
                  text
                  type="primary"
                  @click="toggleResult(idx)"
                >
                  {{ expandedResults.has(idx) ? '收起' : '展开' }}结果
                </el-button>
                <pre
                  v-if="expandedResults.has(idx)"
                  class="result-json"
                >{{ JSON.stringify(step.result, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 产物 -->
      <section v-if="artifacts.length" class="panel-card detail-section">
        <h3>产物 ({{ artifacts.length }})</h3>
        <el-table :data="artifacts" border size="small">
          <el-table-column prop="artifactId" label="产物 ID" width="200">
            <template #default="{ row }">
              <span class="mono">{{ row.artifactId?.slice(0, 12) }}...</span>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="140" />
          <el-table-column prop="mimeType" label="MIME" width="140" />
          <el-table-column prop="deviceId" label="设备" width="140" />
          <el-table-column label="时间" width="170">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                text
                @click="downloadArtifact(row)"
              >
                下载
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { getRun, getRunArtifacts } from '@/api/node-workflow';
import { buildArtifactBlobUrl } from '@/api/artifact';

const router = useRouter();
const route = useRoute();
const workflowId = route.params.workflowId as string;
const runId = route.params.runId as string;
const loading = ref(false);
const run = ref<RunInfo | null>(null);
const artifacts = ref<RunArtifact[]>([]);
const expandedResults = ref(new Set<number>());

onMounted(async () => {
  await loadRun();
  await loadArtifacts();
});

async function loadRun() {
  loading.value = true;
  try {
    const res: any = await getRun(workflowId, runId);
    const r = res?.data || res;
    run.value = {
      runId: String(r.runId || r.id || runId),
      workflowId: String(r.workflowId || workflowId),
      deploymentId: String(r.deploymentId || ''),
      triggerNodeId: String(r.triggerNodeId || ''),
      status: r.status || 'unknown',
      triggerEvent: r.triggerEvent,
      context: r.context,
      error: r.error || null,
      startedAt: r.startedAt || '',
      completedAt: r.completedAt || null,
      steps: Array.isArray(r.steps)
        ? r.steps.map((s: any) => ({
            nodeId: String(s.nodeId || ''),
            slotId: String(s.slotId || ''),
            deviceId: String(s.deviceId || ''),
            nodeType: String(s.nodeType || ''),
            status: s.status || 'passed',
            inputParams: s.inputParams,
            result: s.result,
            error: s.error || null,
            createdAt: s.createdAt
          }))
        : []
    };
  } catch {
    ElMessage.error('加载运行详情失败');
  } finally {
    loading.value = false;
  }
}

async function loadArtifacts() {
  try {
    const res: any = await getRunArtifacts(workflowId, runId);
    artifacts.value = (Array.isArray(res?.data) ? res.data : []).map(
      (a: any) => ({
        artifactId: String(a.artifactId || ''),
        deviceId: String(a.deviceId || ''),
        nodeId: a.nodeId,
        type: String(a.type || ''),
        mimeType: String(a.mimeType || ''),
        metadata: a.metadata || {},
        createdAt: String(a.createdAt || ''),
        blobUrl: buildArtifactBlobUrl(String(a.artifactId || '')),
        artifactRef: a.artifactRef
      })
    );
  } catch {
    // 产物加载失败不影响主信息
  }
}

function toggleResult(idx: number) {
  if (expandedResults.value.has(idx)) {
    expandedResults.value.delete(idx);
  } else {
    expandedResults.value.add(idx);
  }
}

function downloadArtifact(artifact: RunArtifact) {
  const url =
    artifact.blobUrl || buildArtifactBlobUrl(artifact.artifactId);
  window.open(url, '_blank');
}

function goBack() {
  router.back();
  if (window.history.length <= 1) {
    router.push({ name: 'SduiNodeWorkflows' });
  }
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.run-detail-page {
  min-height: calc(100vh - 84px);
  padding: 18px;
  background: #f5f7fb;
}

.page-hero { margin-bottom: 16px; }
.page-hero h1 { margin: 4px 0; font-size: 28px; font-weight: 800; color: #122033; }

.detail-section {
  margin-bottom: 16px;
}

.detail-section h3 {
  margin: 0 0 10px;
  font-size: 16px;
  color: #122033;
}

.panel-card {
  padding: 18px;
  border: 1px solid rgba(18, 32, 51, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.mono { font-family: Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.muted { color: #64748b; font-size: 13px; }
.error-text { color: #f56c6c; }

.step-list {
  display: flex;
  flex-direction: column;
}

.step-item {
  display: flex;
  gap: 12px;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 16px;
  background: rgba(18, 32, 51, 0.12);
}

.step-body {
  flex: 1;
  padding-bottom: 14px;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-meta {
  display: flex;
  gap: 12px;
  margin-top: 2px;
}

.step-error {
  margin-top: 4px;
  color: #f56c6c;
  font-size: 13px;
}

.result-json {
  background: #f5f7fb;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  font-family: Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  max-height: 240px;
  overflow: auto;
  margin-top: 6px;
}
</style>

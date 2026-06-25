<template>
  <div class="dep-detail-page app-container">
    <section class="page-hero">
      <div>
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回部署列表
        </el-button>
        <h1>部署详情</h1>
      </div>
    </section>

    <div v-loading="loading">
      <section v-if="deployment" class="panel-card detail-section">
        <h3>基本信息</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="部署 ID">
            {{ deployment.id }}
          </el-descriptions-item>
          <el-descriptions-item label="工作流 ID">
            {{ deployment.workflowId }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="deployment.status === 'active' ? 'success' : 'info'"
              size="small"
            >
              {{ deployment.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="部署时间">
            {{ formatDate(deployment.deployedAt) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="deployment.stoppedAt"
            label="停止时间"
          >
            {{ formatDate(deployment.stoppedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="健康度">
            <el-tag
              :type="deployment.health === 'ok' ? 'success' : 'danger'"
              size="small"
            >
              {{ deployment.health || '-' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-if="deployment" class="panel-card detail-section">
        <h3>槽位绑定</h3>
        <el-table :data="slotBindingsList" border size="small">
          <el-table-column prop="slotId" label="槽位" />
          <el-table-column prop="deviceId" label="设备" />
          <el-table-column label="在线状态">
            <template #default="{ row }">
              <el-tag
                :type="deployment.deviceStatuses?.[row.slotId]?.online ? 'success' : 'info'"
                size="small"
              >
                {{ deployment.deviceStatuses?.[row.slotId]?.online ? '在线' : '离线' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section v-if="deployment?.uiContexts" class="panel-card detail-section">
        <h3>UI 上下文</h3>
        <pre class="json-block">{{
          JSON.stringify(deployment.uiContexts, null, 2)
        }}</pre>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { getDeployment } from '@/api/node-workflow';

const router = useRouter();
const route = useRoute();
const workflowId = route.params.workflowId as string;
const deploymentId = route.params.deploymentId as string;
const loading = ref(false);
const deployment = ref<DeploymentInfo | null>(null);

const slotBindingsList = computed(() => {
  if (!deployment.value?.slotBindings) return [];
  return Object.entries(deployment.value.slotBindings).map(
    ([slotId, deviceId]) => ({ slotId, deviceId })
  );
});

onMounted(async () => {
  await loadDeployment();
});

async function loadDeployment() {
  loading.value = true;
  try {
    const res: any = await getDeployment(workflowId, deploymentId);
    const d = res?.data || res;
    deployment.value = {
      id: String(d.id || ''),
      workflowId: String(d.workflowId || ''),
      status: d.status || '',
      slotBindings: d.slotBindings || {},
      deployedAt: d.deployedAt || '',
      stoppedAt: d.stoppedAt,
      deviceStatuses: d.deviceStatuses || {},
      uiContexts: d.uiContexts,
      health: d.health || ''
    };
  } catch {
    ElMessage.error('加载部署详情失败');
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push({
    name: 'SduiWorkflowDeployments',
    params: { workflowId }
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
.dep-detail-page {
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

.json-block {
  max-height: 320px;
  overflow: auto;
  background: #f5f7fb;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  font-family: Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
}
</style>

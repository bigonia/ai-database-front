<template>
  <div class="workflow-library app-container">
    <section class="library-hero">
      <div>
        <span class="hero-kicker">Node Workflow</span>
        <h1>节点工作流</h1>
        <p>基于能力节点的可视化工作流编排，支持槽位、节点连线、部署到真实设备。</p>
      </div>
      <div class="hero-actions">
        <el-button :loading="loading" @click="loadWorkflows">刷新列表</el-button>
        <el-button type="primary" @click="goCreate">新建工作流</el-button>
      </div>
    </section>

    <section class="library-stats">
      <article class="stat-card">
        <span>定义总数</span>
        <strong>{{ workflows.length }}</strong>
      </article>
      <article class="stat-card">
        <span>筛选结果</span>
        <strong>{{ filteredWorkflows.length }}</strong>
      </article>
    </section>

    <section class="panel-card library-shell">
      <div class="toolbar-row">
        <el-input
          v-model="keyword"
          clearable
          class="search-input"
          placeholder="搜索名称、ID"
        />
      </div>

      <div v-loading="loading" class="workflow-grid">
        <article
          v-for="wf in filteredWorkflows"
          :key="wf.id"
          class="workflow-card"
        >
          <div class="workflow-head">
            <div>
              <strong>{{ wf.name || '未命名工作流' }}</strong>
              <div class="muted mono">{{ wf.id }}</div>
            </div>
          </div>

          <div class="meta-row">
            <span>{{ wf.slots?.length || 0 }} 个槽位</span>
            <span>{{ wf.nodes?.length || 0 }} 个节点</span>
            <span>{{ wf.edges?.length || 0 }} 条连线</span>
          </div>

          <div class="chip-row">
            <el-tag
              v-for="slot in wf.slots || []"
              :key="slot.slotId"
              size="small"
              effect="plain"
            >
              {{ slot.displayName || slot.slotId }}
            </el-tag>
          </div>

          <div class="action-row">
            <el-button size="small" @click="goEdit(wf.id!)">进入编辑器</el-button>
            <el-button
              size="small"
              @click="goDeployments(wf.id!)"
            >
              部署管理
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :loading="deletingWorkflowId === wf.id"
              :disabled="Boolean(deletingWorkflowId)"
              @click="removeWorkflow(wf)"
            >
              删除
            </el-button>
          </div>
        </article>

        <el-empty
          v-if="!filteredWorkflows.length"
          description="暂无工作流定义"
          :image-size="52"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listWorkflows,
  deleteWorkflow,
  listDeployments,
  stopDeployment
} from '@/api/node-workflow';

const router = useRouter();
const loading = ref(false);
const keyword = ref('');
const workflows = ref<NodeWorkflowDefinition[]>([]);
const deletingWorkflowId = ref('');

const filteredWorkflows = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) return workflows.value;
  return workflows.value.filter((item) =>
    [item.name, item.id].some((value) =>
      String(value || '').toLowerCase().includes(text)
    )
  );
});

onMounted(() => {
  loadWorkflows();
});

async function loadWorkflows() {
  loading.value = true;
  try {
    const res: any = await listWorkflows();
    const items = Array.isArray(res?.data) ? res.data : [];
    workflows.value = items.map((item: any) => {
      const definition = item.definition || item;
      return {
        id: String(item.id || item.workflowId || ''),
        name: String(item.name || definition.name || ''),
        slots: Array.isArray(definition.slots) ? definition.slots : [],
        nodes: Array.isArray(definition.nodes) ? definition.nodes : [],
        edges: Array.isArray(definition.edges) ? definition.edges : [],
        uiTemplates: Array.isArray(definition.uiTemplates) ? definition.uiTemplates : []
      };
    });
  } catch {
    workflows.value = [];
    ElMessage.error('加载工作流列表失败');
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  router.push({ name: 'SduiNodeWorkflowEditor' });
}

function goEdit(id: string) {
  router.push({ name: 'SduiNodeWorkflowEditor', query: { id } });
}

function goDeployments(id: string) {
  router.push({ name: 'SduiWorkflowDeployments', params: { workflowId: id } });
}

async function removeWorkflow(wf: NodeWorkflowDefinition) {
  const workflowId = wf.id;
  if (!workflowId || deletingWorkflowId.value) return;

  deletingWorkflowId.value = workflowId;
  try {
    const deploymentRes: any = await listDeployments(workflowId);
    const deployments = Array.isArray(deploymentRes?.data)
      ? deploymentRes.data
      : [];
    const activeDeployments = deployments.filter(
      (deployment: any) => deployment.status === 'active'
    );
    const activeDeploymentIds = activeDeployments
      .map((deployment: any) =>
        String(deployment.deploymentId || deployment.id || '')
      )
      .filter(Boolean);

    const message = activeDeploymentIds.length
      ? `工作流 ${wf.name || workflowId} 当前有 ${activeDeploymentIds.length} 个活跃部署。删除将先停止这些部署，且不可恢复，是否继续？`
      : `确认删除工作流 ${wf.name || workflowId}？此操作不可恢复。`;

    await ElMessageBox.confirm(
      message,
      '删除工作流',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );

    if (activeDeploymentIds.length) {
      await Promise.all(
        activeDeploymentIds.map((deploymentId) =>
          stopDeployment(workflowId, deploymentId)
        )
      );
    }

    await deleteWorkflow(workflowId);
    ElMessage.success('工作流已删除');
    await loadWorkflows();
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error?.message || '删除工作流失败');
  } finally {
    deletingWorkflowId.value = '';
  }
}
</script>

<style scoped lang="scss">
.workflow-library {
  min-height: calc(100vh - 84px);
  background:
    radial-gradient(circle at top left, rgba(162, 211, 255, 0.38), transparent 30%),
    linear-gradient(180deg, #f7f9fb 0%, #f5f7fb 100%);
  --ink: #122033;
  --muted: #64748b;
  --line: rgba(18, 32, 51, 0.08);
  --panel: rgba(255, 255, 255, 0.88);
  color: var(--ink);
}

.library-hero,
.hero-actions,
.library-stats,
.toolbar-row,
.workflow-head,
.meta-row,
.chip-row,
.action-row {
  display: flex;
}

.library-hero,
.library-stats {
  gap: 18px;
  margin-bottom: 18px;
}

.library-hero {
  justify-content: space-between;
  align-items: flex-end;
  padding: 18px 6px 8px;
}

.hero-kicker {
  display: inline-flex;
  margin-bottom: 10px;
  color: #1f6fb2;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.library-hero h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.muted {
  color: var(--muted);
}

.hero-actions,
.chip-row,
.action-row {
  gap: 10px;
}

.library-stats {
  flex-wrap: wrap;
}

.stat-card,
.panel-card {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 40px rgba(18, 32, 51, 0.08);
}

.stat-card {
  min-width: 180px;
  flex: 1;
  padding: 18px 20px;
}

.stat-card strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
}

.library-shell {
  padding: 18px;
}

.search-input {
  width: min(460px, 100%);
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.workflow-card {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.8);
}

.workflow-head {
  justify-content: space-between;
  gap: 12px;
}

.meta-row,
.chip-row,
.action-row {
  flex-wrap: wrap;
  margin-top: 12px;
}

.meta-row {
  gap: 16px;
}

.mono {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

@media (max-width: 768px) {
  .workflow-library {
    padding: 12px;
  }

  .library-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .library-hero h1 {
    font-size: 30px;
  }
}
</style>

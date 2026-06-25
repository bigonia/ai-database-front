<template>
  <div class="template-library app-container">
    <section class="library-hero">
      <div class="hero-copy">
        <span class="hero-kicker">UI Templates</span>
        <h1>UI 模板</h1>
        <p>定义可复用的 Section 页面模板，工作流通过变量更新驱动界面渲染。</p>
      </div>
      <div class="hero-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadTemplates">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="goCreate">新建模板</el-button>
      </div>
    </section>

    <section class="panel-card library-shell">
      <div class="toolbar-row">
        <div class="toolbar-copy">
          <h2>模板库</h2>
          <p>共 {{ templates.length }} 个模板，当前显示 {{ filteredTemplates.length }} 个</p>
        </div>
        <el-input v-model="keyword" clearable class="search-input" placeholder="搜索名称或模板 Key">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div v-loading="loading" class="template-grid">
        <article
          v-for="tpl in filteredTemplates"
          :key="tpl.id"
          class="template-card"
        >
          <div class="template-head">
            <div class="template-title">
              <div class="template-icon">UI</div>
              <div>
                <strong>{{ tpl.name || '未命名模板' }}</strong>
                <div class="muted mono">{{ tpl.templateKey }}</div>
              </div>
            </div>
            <el-tag
              :type="tpl.status === 'active' ? 'success' : 'info'"
              size="small"
            >
              {{ tpl.status }}
            </el-tag>
          </div>

          <div class="template-metrics">
            <div class="metric-item">
              <strong>{{ displayCount(tpl.sectionCount) }}</strong>
              <span>Sections</span>
            </div>
            <div class="metric-divider" />
            <div class="metric-item">
              <strong>{{ displayCount(tpl.variableCount) }}</strong>
              <span>模板变量</span>
            </div>
            <div class="metric-divider" />
            <div class="metric-item metric-layout">
              <strong>{{ layoutLabel(tpl.layout) }}</strong>
              <span>页面布局</span>
            </div>
          </div>

          <div class="template-foot">
            <span class="updated-at">更新于 {{ formatDate(tpl.updatedAt) }}</span>
            <div class="action-row">
              <el-button type="primary" text :icon="Edit" @click="goEdit(tpl.id)">编辑</el-button>
              <el-button text :icon="View" @click="previewTemplate(tpl)">预览</el-button>
              <el-button type="danger" text :icon="Delete" @click="removeTemplate(tpl)">删除</el-button>
            </div>
          </div>
        </article>

        <el-empty
          v-if="!filteredTemplates.length"
          description="暂无 UI 模板"
          :image-size="52"
        />
      </div>
    </section>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      title="模板预览"
      width="640px"
    >
      <pre v-if="previewData" class="preview-json">{{
        JSON.stringify(previewData, null, 2)
      }}</pre>
      <el-empty v-else description="加载中..." :image-size="40" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Delete, Edit, Plus, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listTemplates,
  deleteTemplate,
  getTemplate,
  previewTemplate as previewApi
} from '@/api/ui-template';

interface TemplateListItem {
  id: string;
  templateKey: string;
  name: string;
  status: string;
  sectionCount: number | null;
  variableCount: number | null;
  layout: string;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();
const loading = ref(false);
const keyword = ref('');
const templates = ref<TemplateListItem[]>([]);
const previewVisible = ref(false);
const previewData = ref<Record<string, unknown> | null>(null);

const filteredTemplates = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) return templates.value;
  return templates.value.filter((item) =>
    [item.name, item.templateKey, item.id].some((value) =>
      String(value || '').toLowerCase().includes(text)
    )
  );
});

onMounted(() => {
  loadTemplates();
});

async function loadTemplates() {
  loading.value = true;
  try {
    const response = await listTemplates();
    const items = unwrapList(response);
    const detailResults = await Promise.allSettled(
      items.map((item) => getTemplate(String(item.id || item.templateId || '')))
    );
    templates.value = items.map((item, index) => {
      const result = detailResults[index];
      const detail = result?.status === 'fulfilled' ? unwrapRecord(result.value) : {};
      const definition = unwrapRecord(detail.definition);
      return {
        id: String(item.id || item.templateId || ''),
        templateKey: String(item.templateKey || ''),
        name: String(item.name || ''),
        status: String(item.status || 'active'),
        sectionCount: Array.isArray(definition.sections) ? definition.sections.length : null,
        variableCount: Array.isArray(definition.variables) ? definition.variables.length : null,
        layout: String(definition.layout || ''),
        createdAt: String(item.createdAt || ''),
        updatedAt: String(item.updatedAt || '')
      };
    });
  } catch {
    templates.value = [];
    ElMessage.error('加载模板列表失败');
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  router.push({ name: 'SduiUiTemplateEditor' });
}

function goEdit(id: string) {
  router.push({ name: 'SduiUiTemplateEditor', query: { id }});
}

async function previewTemplate(tpl: TemplateListItem) {
  previewVisible.value = true;
  previewData.value = null;
  try {
    const response = await previewApi(tpl.id);
    previewData.value = unwrapRecord(response);
  } catch {
    ElMessage.error('预览失败');
    previewVisible.value = false;
  }
}

async function removeTemplate(tpl: TemplateListItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除模板 ${tpl.name || tpl.templateKey}？`,
      '删除模板',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }

  try {
    await deleteTemplate(tpl.id);
    ElMessage.success('模板已删除');
    await loadTemplates();
  } catch {
    ElMessage.error('删除模板失败');
  }
}

type UnknownRecord = Record<string, unknown>;

function unwrapApi(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as UnknownRecord;
  return 'data' in record ? record.data : value;
}

function unwrapRecord(value: unknown): UnknownRecord {
  const payload = unwrapApi(value);
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as UnknownRecord
    : {};
}

function unwrapList(value: unknown): UnknownRecord[] {
  const payload = unwrapApi(value);
  return Array.isArray(payload)
    ? payload.filter((item): item is UnknownRecord => typeof item === 'object' && item !== null)
    : [];
}

function displayCount(count: number | null) {
  return count == null ? '--' : count;
}

function layoutLabel(layout: string) {
  return ({
    vertical_scroll: '纵向滚动',
    horizontal_pages: '横向分页',
    fixed_single: '固定单页',
    overlay: '浮层布局'
  } as Record<string, string>)[layout] || '--';
}

function formatDate(value: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
</script>

<style scoped lang="scss">
.template-library {
  min-height: calc(100vh - 84px);
  background:
    radial-gradient(circle at top left, rgba(132, 197, 255, 0.22), transparent 32%),
    #f5f7fb;
  --ink: #122033;
  --muted: #64748b;
  --line: rgba(18, 32, 51, 0.08);
  --panel: rgba(255, 255, 255, 0.92);
  color: var(--ink);
}

.library-hero,
.hero-actions,
.toolbar-row,
.template-head,
.template-title,
.template-metrics,
.template-foot,
.action-row {
  display: flex;
}

.library-hero {
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 20px 4px 24px;
}

.hero-copy {
  max-width: 720px;
}

.hero-kicker {
  display: inline-flex;
  margin-bottom: 8px;
  color: #1f6fb2;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.library-hero h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.library-hero p {
  margin: 10px 0 0;
  color: var(--muted);
}

.muted { color: var(--muted); }
.hero-actions { gap: 10px; }

.panel-card {
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 36px rgba(18, 32, 51, 0.07);
}

.library-shell {
  padding: 20px;
}

.toolbar-row {
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.toolbar-copy h2 {
  margin: 0;
  font-size: 18px;
}

.toolbar-copy p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.search-input { width: min(360px, 100%); }

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.template-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(18, 32, 51, 0.04);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.template-card:hover {
  transform: translateY(-2px);
  border-color: rgba(64, 158, 255, 0.32);
  box-shadow: 0 14px 30px rgba(18, 32, 51, 0.08);
}

.template-head {
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.template-title {
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.template-title strong {
  display: block;
  margin-bottom: 4px;
  font-size: 16px;
}

.template-icon {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(145deg, #e9f4ff, #dcecff);
  color: #2878bd;
  font-size: 12px;
  font-weight: 800;
}

.mono { font-family: Menlo, Monaco, Consolas, monospace; font-size: 12px; }

.template-metrics {
  align-items: stretch;
  gap: 16px;
  margin-top: 22px;
  padding: 16px;
  border-radius: 14px;
  background: #f7f9fc;
}

.metric-item {
  min-width: 68px;
}

.metric-item strong,
.metric-item span {
  display: block;
}

.metric-item strong {
  font-size: 20px;
  line-height: 1.2;
}

.metric-item span {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
}

.metric-layout {
  min-width: 88px;
  flex: 1;
}

.metric-layout strong {
  overflow: hidden;
  font-size: 14px;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-divider {
  width: 1px;
  background: var(--line);
}

.template-foot {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.updated-at {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.action-row {
  justify-content: flex-end;
}

.action-row :deep(.el-button + .el-button) {
  margin-left: 2px;
}

.preview-json {
  max-height: 480px;
  overflow: auto;
  background: #f5f7fb;
  padding: 16px;
  border-radius: 8px;
  font-size: 12px;
  font-family: Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .template-library { padding: 12px; }
  .library-hero,
  .toolbar-row,
  .template-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .library-hero h1 { font-size: 30px; }
  .search-input { width: 100%; }
  .template-grid { grid-template-columns: 1fr; }
  .action-row { justify-content: flex-start; }
}
</style>

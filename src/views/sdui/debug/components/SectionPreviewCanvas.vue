<template>
  <el-card shadow="never" class="panel-card preview-panel">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">Section Preview</div>
          <div class="panel-subtitle">渲染后端当前已推送页面，仅用于展示终端实际内容。</div>
        </div>
        <el-tag size="small">{{ page?.layout || 'no-page' }}</el-tag>
      </div>
    </template>

    <div v-if="page" class="preview-shell" :class="`layout-${page.layout}`">
      <div class="preview-stage" :class="`layout-${page.layout}`">
        <template v-for="section in page.sections" :key="section.sectionId">
          <article
            v-if="section.sectionType === 'hero_section'"
            class="preview-card hero-card"
            :class="[toneClass(section.fields.tone), eventActiveClass(section.sectionId)]"
          >
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="hero-value">{{ section.fields.value || '--' }}</div>
            <div class="hero-label">{{ section.fields.label || getSectionSemantic(section.sectionType).title }}</div>
            <div class="muted">{{ section.fields.subtitle || '无副标题' }}</div>
            <el-progress :percentage="toProgress(section.fields.progress)" :show-text="false" />
          </article>

          <article v-else-if="section.sectionType === 'metric_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="metric-grid">
              <div v-for="(item, index) in asArray(section.fields.metrics)" :key="index" class="metric-item">
                <span class="muted">{{ asRecord(item).label || `metric_${index + 1}` }}</span>
                <strong>{{ asRecord(item).value || '--' }}</strong>
              </div>
            </div>
          </article>

          <article v-else-if="section.sectionType === 'chart_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <div class="chart-line">
              <span
                v-for="(point, index) in normalizedPoints(section.fields.points)"
                :key="index"
                class="chart-bar"
                :style="{ height: `${Math.max(point, 8)}%` }"
              />
            </div>
            <div class="muted">Progress {{ toProgress(section.fields.progress) }}%</div>
          </article>

          <article v-else-if="section.sectionType === 'progress_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <el-progress :percentage="toProgress(section.fields.progress)" />
            <div class="muted">{{ section.fields.progressText || `${toProgress(section.fields.progress)}%` }}</div>
          </article>

          <article v-else-if="section.sectionType === 'text_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <p class="body-copy">{{ section.fields.body || '暂无内容' }}</p>
          </article>

          <article v-else-if="section.sectionType === 'timer_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <div class="hero-value">{{ formatElapsed(asRecord(section.fields.timer).elapsedMs) }}</div>
            <div class="muted">{{ asRecord(section.fields.timer).running ? '运行中' : '已暂停' }}</div>
          </article>

          <article v-else-if="section.sectionType === 'image_section'" class="preview-card image-card" :class="eventActiveClass(section.sectionId)">
            <div class="image-icon">{{ resolveIcon(section.fields.iconSrc || section.fields.iconSymbol) }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <div class="muted">{{ section.fields.subtitle || '图标主导信息块' }}</div>
          </article>

          <article
            v-else-if="section.sectionType === 'overlay_section'"
            class="preview-card overlay-card"
            :class="[toneClass(section.fields.tone), eventActiveClass(section.sectionId)]"
          >
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ section.fields.title || getSectionSemantic(section.sectionType).title }}</strong>
            <p class="body-copy">{{ section.fields.body || '暂无提示内容' }}</p>
            <div class="toolbar-group">
              <el-tag size="small">unread {{ Number(section.fields.unreadCount || 0) }}</el-tag>
              <el-button size="small" type="primary" disabled>
                确认
              </el-button>
            </div>
          </article>

          <article v-else-if="section.sectionType === 'action_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="action-grid">
              <el-button
                v-for="(action, index) in asArray(section.fields.actions)"
                :key="index"
                :type="buttonTone(asRecord(action).tone)"
                disabled
              >
                {{ asRecord(action).label || asRecord(action).id || `action_${index + 1}` }}
              </el-button>
            </div>
          </article>

          <article v-else-if="section.sectionType === 'toggle_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="stack-gap">
              <div v-for="(option, index) in asArray(section.fields.options)" :key="index" class="toggle-row">
                <span>{{ asRecord(option).label || asRecord(option).id || `option_${index + 1}` }}</span>
                <el-switch
                  :model-value="Boolean(asRecord(option).active)"
                  disabled
                />
              </div>
            </div>
          </article>

          <article v-else-if="section.sectionType === 'list_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="stack-gap">
              <div
                v-for="(item, index) in asArray(section.fields.items)"
                :key="index"
                class="list-item"
              >
                <div>
                  <strong>{{ asRecord(item).title || `item_${index + 1}` }}</strong>
                  <div class="muted">{{ asRecord(item).subtitle || '无副标题' }}</div>
                </div>
                <span>{{ resolveIcon(asRecord(item).iconSrc) }}</span>
              </div>
            </div>
          </article>

          <article v-else-if="section.sectionType === 'nav_section'" class="preview-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <div class="nav-tabs">
              <span
                v-for="(tab, index) in asArray(section.fields.tabs)"
                :key="index"
                class="nav-tab"
                :class="{ active: asRecord(tab).id === section.fields.activeTab }"
              >
                {{ asRecord(tab).label || asRecord(tab).id || `tab_${index + 1}` }}
              </span>
            </div>
          </article>

          <article v-else class="preview-card fallback-card" :class="eventActiveClass(section.sectionId)">
            <div class="section-kicker">{{ section.sectionId }}</div>
            <strong>{{ getSectionSemantic(section.sectionType).title }}</strong>
            <div class="muted">协议未实现，以下展示原始字段。</div>
            <pre class="json-panel">{{ JSON.stringify(section.fields, null, 2) }}</pre>
          </article>
        </template>
      </div>
    </div>

    <el-empty v-else description="尚未向终端推送 Section 页面" :image-size="56" />
  </el-card>
</template>

<script setup lang="ts">
import { getSectionSemantic } from '../sectionSemantics';
import type { DebugSectionPage } from '../types';

const props = defineProps<{
  page: DebugSectionPage | null;
  activeSectionId?: string;
}>();

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function toProgress(value: unknown) {
  const num = Number(value || 0);
  return Math.max(0, Math.min(100, Number.isFinite(num) ? num : 0));
}

function normalizedPoints(value: unknown) {
  const points = Array.isArray(value) ? value.map((item) => Number(item || 0)) : [];
  const max = Math.max(...points, 1);
  return points.map((item) => Math.max(0, Math.min(100, (item / max) * 100)));
}

function formatElapsed(value: unknown) {
  const ms = Number(value || 0);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part, index) => (index === 0 && part === 0 ? null : String(part).padStart(2, '0')))
    .filter(Boolean)
    .join(':') || '00:00';
}

function resolveIcon(value: unknown) {
  const key = String(value || '').toLowerCase();
  if (key.includes('mail')) return '@';
  if (key.includes('chat')) return '...';
  if (key.includes('file')) return '[]';
  if (key.includes('love') || key.includes('heart')) return '*';
  if (key.includes('droplet')) return 'o';
  return '#';
}

function toneClass(value: unknown) {
  return `tone-${String(value || 'neutral')}`;
}

function buttonTone(value: unknown) {
  const tone = String(value || 'primary');
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  return 'primary';
}

function eventActiveClass(sectionId: string) {
  return sectionId && sectionId === props.activeSectionId ? 'is-event-active' : '';
}
</script>

<style scoped>
.preview-panel {
  border-radius: 14px;
}

.preview-panel :deep(.el-card__header) {
  padding: 16px 18px 14px;
}

.preview-panel :deep(.el-card__body) {
  padding: 14px;
}

.panel-header,
.toolbar-group,
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title,
.hero-value,
.metric-item strong {
  font-weight: 700;
}

.panel-subtitle,
.muted {
  color: #6b7280;
}

.panel-subtitle {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.5;
}

.preview-shell {
  padding: 10px;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background:
    radial-gradient(circle at top, rgba(14, 165, 233, 0.10), transparent 36%),
    linear-gradient(180deg, #eff6ff, #ffffff 40%, #f8fafc);
}

.preview-stage {
  min-height: 360px;
  display: grid;
  align-content: start;
  gap: 8px;
}

.preview-stage.layout-horizontal_pages {
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 1fr);
  overflow-x: auto;
}

.preview-stage.layout-fixed_single {
  max-height: 360px;
  overflow: hidden;
}

.preview-stage.layout-overlay {
  position: relative;
  padding: 20px;
}

.preview-card {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid #dbe4f0;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.preview-card.is-event-active {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.16), 0 10px 24px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

.hero-card.tone-primary,
.overlay-card.tone-primary {
  background: linear-gradient(135deg, #eff6ff, #ffffff);
}

.hero-card.tone-success,
.overlay-card.tone-success {
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
}

.hero-card.tone-warning,
.overlay-card.tone-warning {
  background: linear-gradient(135deg, #fffbeb, #ffffff);
}

.hero-card.tone-danger,
.overlay-card.tone-danger {
  background: linear-gradient(135deg, #fef2f2, #ffffff);
}

.section-kicker {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.hero-value {
  font-size: 28px;
  line-height: 1;
}

.hero-label {
  font-size: 14px;
  font-weight: 600;
}

.metric-grid,
.action-grid,
.nav-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.metric-item,
.nav-tab {
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
}

.chart-line {
  height: 64px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chart-bar {
  flex: 1;
  min-width: 8px;
  border-radius: 999px 999px 6px 6px;
  background: linear-gradient(180deg, #38bdf8, #2563eb);
}

.body-copy {
  margin: 0;
  line-height: 1.6;
  color: #334155;
}

.image-card {
  align-items: center;
  text-align: center;
}

.image-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #eff6ff;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.overlay-card {
  max-width: 420px;
  margin: 0 auto;
}

.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  width: 100%;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #dbe4f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.nav-tab.active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.json-panel {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  overflow: auto;
}
</style>

<template>
  <el-card shadow="never" class="panel-card event-panel">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">终端输入与 Section 交互</div>
          <div class="panel-subtitle">仅展示终端通过 SSE 上报的真实事件。</div>
        </div>
        <el-tag size="small" :type="connected ? 'success' : 'info'">
          {{ connected ? '实时连接' : '连接中' }}
        </el-tag>
      </div>
    </template>

    <div v-if="events.length" class="event-list">
      <article v-for="(item, index) in events" :key="`${item.eventId}-${item.ts}-${index}`" class="event-card">
        <div class="event-heading">
          <div>
            <div class="event-title">
              <strong>{{ item.displayName }}</strong>
              <el-tag size="small" effect="plain">{{ categoryLabel(item.category) }}</el-tag>
            </div>
            <div class="event-description">{{ item.description }}</div>
          </div>
          <span class="event-time">{{ formatTime(item.ts) }}</span>
        </div>

        <div class="event-meta">
          <span class="mono">{{ item.eventId }}</span>
          <span v-if="item.section">
            {{ item.section.sectionDisplayName || item.section.sectionType }} · {{ item.section.sectionId }}
          </span>
          <span v-else-if="item.inputSource">
            {{ item.inputSource.displayName || item.inputSource.name || item.inputSource.nodeId }}
          </span>
          <span v-if="item.value !== undefined">value {{ formatValue(item.value) }}</span>
        </div>

        <el-collapse>
          <el-collapse-item title="原始协议数据">
            <pre class="json-panel">{{ JSON.stringify(item.raw, null, 2) }}</pre>
          </el-collapse-item>
        </el-collapse>
      </article>
    </div>
    <el-empty v-else description="等待终端输入或 Section 交互" :image-size="48" />
  </el-card>
</template>

<script setup lang="ts">
import type { DebugEventStreamItem } from '../types';

defineProps<{
  events: DebugEventStreamItem[];
  connected: boolean;
}>();

function categoryLabel(category: DebugEventStreamItem['category']) {
  if (category === 'physical_input') return '物理输入';
  if (category === 'media') return '媒体';
  return 'Section 交互';
}

function formatTime(value: string | number | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString();
}

function formatValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
</script>

<style scoped>
.event-panel {
  margin-top: 14px;
}

.panel-header,
.event-heading,
.event-title,
.event-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-header,
.event-heading {
  flex-wrap: wrap;
}

.panel-title {
  font-weight: 700;
}

.panel-subtitle,
.event-description,
.event-time,
.event-meta {
  color: #64748b;
}

.panel-subtitle,
.event-description,
.event-time,
.event-meta {
  font-size: 12px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 420px;
  overflow: auto;
}

.event-card {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.event-title {
  justify-content: flex-start;
}

.event-description {
  margin-top: 4px;
}

.event-meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 8px;
}

.mono {
  font-family: Menlo, Monaco, Consolas, monospace;
}

.json-panel {
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  overflow: auto;
}
</style>

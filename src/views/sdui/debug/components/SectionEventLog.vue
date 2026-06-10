<template>
  <el-card shadow="never" class="panel-card">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">交互模拟日志</div>
          <div class="panel-subtitle">这里记录 preview 内部交互，不会回传后端。</div>
        </div>
        <el-button size="small" @click="emit('clear')">清空</el-button>
      </div>
    </template>

    <div v-if="events.length" class="stack-gap">
      <article v-for="(item, index) in events" :key="`${item.eventName}-${index}`" class="event-card">
        <div class="event-header">
          <div>
            <strong>{{ item.eventName }}</strong>
            <div class="muted mono">{{ item.pageId }} / {{ item.sectionId }}</div>
          </div>
          <span class="muted">{{ formatTime(item.createdAt) }}</span>
        </div>
        <pre class="json-panel">{{ JSON.stringify(item.payload, null, 2) }}</pre>
      </article>
    </div>
    <el-empty v-else description="还没有 preview 交互记录" :image-size="48" />
  </el-card>
</template>

<script setup lang="ts">
import type { DebugSectionPreviewEvent } from '../types';

defineProps<{
  events: DebugSectionPreviewEvent[];
}>();

const emit = defineEmits<{
  (event: 'clear'): void;
}>();

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<style scoped>
.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header,
.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  font-weight: 700;
}

.panel-subtitle,
.muted {
  color: #6b7280;
}

.mono {
  font-family: Menlo, Monaco, Consolas, monospace;
}

.event-card {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
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

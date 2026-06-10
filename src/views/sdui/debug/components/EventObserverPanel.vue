<template>
  <div class="event-panel">
    <el-card shadow="never" class="panel-card">
      <template #header>
        <div class="panel-header">
          <div>
            <div class="panel-title">输入事件观测</div>
            <div class="panel-subtitle">这里只展示真实事件时间线，不展示能力目录。</div>
          </div>
          <div class="toolbar">
            <el-input v-model="filters.eventName" size="small" placeholder="按事件名过滤" clearable />
            <el-input v-model="filters.keyword" size="small" placeholder="搜索 payload" clearable />
            <el-select v-model="viewMode" size="small" style="width: 110px">
              <el-option label="JSON" value="json" />
              <el-option label="Raw" value="raw" />
            </el-select>
            <el-switch v-model="paused" inline-prompt active-text="暂停" inactive-text="滚动" />
            <el-button size="small" @click="clearEvents">清空</el-button>
          </div>
        </div>
      </template>

      <div v-if="visibleEvents.length" class="stack-gap">
        <article v-for="(item, index) in visibleEvents" :key="`${item.eventName}-${index}`" class="event-card">
          <div class="event-header">
            <div>
              <strong>{{ item.eventName }}</strong>
              <div class="muted mono">{{ item.nodeId || 'no-node-id' }}</div>
            </div>
            <span class="muted">{{ formatTs(item.ts) }}</span>
          </div>
          <pre class="json-panel">{{ renderPayload(item) }}</pre>
        </article>
      </div>
      <el-empty v-else description="当前没有命中过滤条件的事件" :image-size="52" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { DebugEventStreamItem } from '../types';

const props = defineProps<{
  events: DebugEventStreamItem[];
}>();

const paused = ref(false);
const viewMode = ref<'json' | 'raw'>('json');
const filters = reactive({
  eventName: '',
  keyword: ''
});
const localEvents = ref<DebugEventStreamItem[]>([]);

watch(
  () => props.events,
  (value) => {
    if (paused.value) return;
    localEvents.value = value.slice(0, 100);
  },
  { immediate: true, deep: true }
);

const visibleEvents = computed(() => {
  return localEvents.value.filter((item) => {
    const eventMatched = !filters.eventName || item.eventName.includes(filters.eventName);
    const keywordMatched = !filters.keyword || JSON.stringify(item.raw).includes(filters.keyword);
    return eventMatched && keywordMatched;
  });
});

function clearEvents() {
  localEvents.value = [];
}

function renderPayload(item: DebugEventStreamItem) {
  if (viewMode.value === 'raw') {
    return typeof item.raw === 'string' ? item.raw : JSON.stringify(item.raw);
  }
  return JSON.stringify(item.raw, null, 2);
}

function formatTs(value: string | number | null) {
  if (!value) return '-';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
</script>

<style scoped>
.event-panel,
.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header,
.toolbar,
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
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
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

<template>
  <el-card shadow="never" class="timeline-panel">
    <template #header>
      <div class="timeline-header">
        <span>连接事件</span>
        <el-tag size="small">{{ data?.totalEvents ?? 0 }} 条</el-tag>
      </div>
    </template>

    <div ref="bodyRef" class="timeline-body">
      <div v-if="events.length" class="event-list">
        <div
          v-for="(evt, idx) in events"
          :key="`${evt.eventAt}-${idx}`"
          class="event-item"
          :class="evt.eventType === 'CONNECTED' ? 'connected' : 'disconnected'"
        >
          <div class="event-dot" :class="evt.eventType === 'CONNECTED' ? 'dot-connect' : 'dot-disconnect'" />
          <div class="event-body-card">
            <div class="event-top">
              <strong>{{ evt.eventType === 'CONNECTED' ? '已连接' : '已断开' }}</strong>
              <span class="event-time">{{ formatTime(evt.eventAt) }}</span>
            </div>
            <div class="event-meta">
              <span v-if="evt.sessionId">Session: <code>{{ evt.sessionId }}</code></span>
              <span v-if="evt.ipAddress">IP: {{ evt.ipAddress }}</span>
              <span v-if="evt.disconnectReason" class="disconnect-reason">
                原因: {{ evt.disconnectReason }}
              </span>
            </div>
            <div class="event-subline">
              <span>{{ evt.eventType === 'CONNECTED' ? '会话建立' : '会话结束' }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无连接事件" :image-size="40" />
    </div>

    <div v-if="(data?.totalEvents ?? 0) > 0" class="timeline-footer">
      <el-pagination
        small
        background
        :current-page="currentPage + 1"
        :page-size="pageSize"
        :page-sizes="[pageSize]"
        layout="total, prev, pager, next"
        :total="data?.totalEvents ?? 0"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  data: ConnectionLog | null
  currentPage: number
  pageSize: number
}>();

const emit = defineEmits<{
  pageChange: [page: number, size: number]
}>();

const bodyRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let lastAutoSize = 0;

const events = computed(() => props.data?.events || []);

function handleCurrentChange(page: number) {
  emit('pageChange', page - 1, props.pageSize);
}

function syncAutoPageSize() {
  const el = bodyRef.value;
  if (!el) return;
  const availableHeight = el.clientHeight;
  const rowHeight = 82;
  const nextSize = Math.max(3, Math.floor(availableHeight / rowHeight));
  if (nextSize !== props.pageSize && nextSize !== lastAutoSize) {
    lastAutoSize = nextSize;
    emit('pageChange', 0, nextSize);
  }
}

onMounted(() => {
  lastAutoSize = props.pageSize;
  syncAutoPageSize();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncAutoPageSize());
    if (bodyRef.value) resizeObserver.observe(bodyRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

function formatTime(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.timeline-panel {
  height: 100%;
}
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.timeline-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.event-item {
  display: flex;
  gap: 12px;
  min-height: 72px;
}
.event-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.dot-connect { background: #22c55e; }
.dot-disconnect { background: #ef4444; }
.event-body-card {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.event-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.event-top strong {
  font-size: 13px;
  color: #111827;
}
.event-time {
  font-size: 12px;
  color: #94a3b8;
}
.event-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}
.event-subline {
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}
.event-meta code {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 1px 5px;
  border-radius: 3px;
}
.disconnect-reason {
  color: #b45309;
}
.timeline-footer {
  padding-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.timeline-panel :deep(.el-card__body) {
  height: calc(100% - 57px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.timeline-panel :deep(.el-empty) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

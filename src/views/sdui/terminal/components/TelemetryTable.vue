<template>
  <el-card shadow="never" class="table-panel">
    <template #header>
      <div class="panel-header">
        <span>遥测历史记录</span>
        <el-tag size="small" effect="plain">{{ total }}</el-tag>
      </div>
    </template>

    <div ref="bodyRef" class="panel-body">
      <el-table
        v-loading="loading"
        :data="rows"
        size="small"
        stripe
        height="100%"
        class="telemetry-table"
      >
        <el-table-column label="时间" min-width="164">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="RSSI" min-width="76">
          <template #default="{ row }">
            {{ row.wifiRssi ?? row.wifi?.rssi ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="温度" min-width="86">
          <template #default="{ row }">
            {{ formatTemp(row) }}
          </template>
        </el-table-column>
        <el-table-column label="电量" min-width="76">
          <template #default="{ row }">
            {{ row.batteryPct != null ? `${row.batteryPct}%` : row.power?.batteryPct != null ? `${row.power.batteryPct}%` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="运行时长" min-width="94">
          <template #default="{ row }">{{ formatDuration(row.uptimeS) }}</template>
        </el-table-column>
        <el-table-column label="IP" min-width="126">
          <template #default="{ row }">{{ row.ip || row.wifi?.ip || '-' }}</template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!rows.length && !loading" description="暂无遥测数据" :image-size="40" />
    </div>

    <div v-if="total > 0" class="panel-footer">
      <el-pagination
        small
        background
        :current-page="currentPage + 1"
        :page-size="pageSize"
        :page-sizes="[pageSize]"
        layout="total, prev, pager, next"
        :total="total"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  rows: Record<string, unknown>[]
  loading: boolean
  total: number
  currentPage: number
  pageSize: number
}>();

const emit = defineEmits<{
  pageChange: [page: number, size: number]
}>();

const bodyRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let lastAutoSize = 0;

function handleCurrentChange(page: number) {
  emit('pageChange', page - 1, props.pageSize);
}

function syncAutoPageSize() {
  const el = bodyRef.value;
  if (!el) return;
  const availableHeight = el.clientHeight;
  const rowHeight = 42;
  const tableHeaderHeight = 40;
  const nextSize = Math.max(4, Math.floor((availableHeight - tableHeaderHeight) / rowHeight));
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

function formatTemp(row: Record<string, unknown>): string {
  // Try raw temperature number on row
  if (typeof row.temperature === 'number') return `${row.temperature.toFixed(1)}°C`;
  // Try celsius in temperature object
  const t = row.temperature as Record<string, unknown> | undefined;
  if (typeof t?.celsius === 'number') return `${(t.celsius as number).toFixed(1)}°C`;
  return '-';
}

function formatTime(val: unknown): string {
  if (!val) return '-';
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString('zh-CN', { hour12: false });
}

function formatDuration(seconds: unknown): string {
  const s = Number(seconds);
  if (isNaN(s)) return '-';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
</script>

<style scoped>
.table-panel {
  height: 100%;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-body {
  min-height: 0;
  flex: 1;
  position: relative;
}
.panel-footer {
  padding-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.telemetry-table {
  height: 100%;
}
.table-panel :deep(.el-card__body) {
  height: calc(100% - 57px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.table-panel :deep(.el-empty) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

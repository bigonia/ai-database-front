<template>
  <div class="connection-overview">
    <!-- Current session -->
    <el-card shadow="never" class="conn-card">
      <template #header><span>当前会话</span></template>
      <el-descriptions v-if="data?.currentSession" :column="2" size="small" border>
        <el-descriptions-item label="连接时间">
          {{ formatTime(data.currentSession.connectedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="Session ID">
          <code>{{ data.currentSession.sessionId || '-' }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="持续时长" :span="2">
          {{ formatDuration(data.currentSession.durationS) }}
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="无活跃会话" :image-size="48" />
    </el-card>

    <!-- Stats -->
    <el-card shadow="never" class="conn-card">
      <template #header><span>连接统计</span></template>
      <div v-if="data?.stats" class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总连接</span>
          <strong class="stat-value good">{{ data.stats.totalConnections }}</strong>
        </div>
        <div class="stat-item">
          <span class="stat-label">总断开</span>
          <strong class="stat-value warn">{{ data.stats.totalDisconnections }}</strong>
        </div>
        <div class="stat-item full-width">
          <span class="stat-label">断开原因分布</span>
          <div v-if="reasonEntries.length" class="reason-tags">
            <el-tag
              v-for="[reason, count] in reasonEntries"
              :key="reason"
              size="small"
              type="info"
            >
              {{ reason }}: {{ count }}
            </el-tag>
          </div>
          <span v-else class="na-text">-</span>
        </div>
      </div>
      <el-empty v-else description="暂无统计数据" :image-size="48" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: ConnectionLog | null
}>();

const reasonEntries = computed<[string, number][]>(() => {
  const reasons = props.data?.stats?.disconnectReasons;
  if (!reasons) return [];
  return Object.entries(reasons);
});

function formatTime(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
</script>

<style scoped>
.connection-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.conn-card {
  overflow: hidden;
}
.conn-card code {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stat-item {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-item.full-width {
  grid-column: 1 / -1;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
}
.stat-value {
  font-size: 22px;
}
.stat-value.good { color: #15803d; }
.stat-value.warn { color: #b45309; }
.reason-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.na-text {
  color: #d1d5db;
}
</style>

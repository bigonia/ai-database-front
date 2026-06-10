<template>
  <el-card shadow="never" v-if="commands.length" class="commands-panel">
    <template #header>
      <div class="panel-header">
        <span>最近命令</span>
        <el-tag size="small">{{ commands.length }}</el-tag>
      </div>
    </template>

    <div class="cmd-list">
      <div
        v-for="cmd in commands"
        :key="cmd.cmdId"
        class="cmd-item"
      >
        <div class="cmd-left">
          <span class="cmd-id-mono">{{ cmd.cmdId }}</span>
          <span class="cmd-action">{{ cmd.action }}</span>
        </div>
        <div class="cmd-right">
          <el-tag :type="statusTagType(cmd.status)" size="small">
            {{ cmd.status }}
          </el-tag>
          <span class="cmd-time">{{ formatTime(cmd.createdAt) }}</span>
        </div>
        <div v-if="cmd.reason" class="cmd-reason">{{ cmd.reason }}</div>
      </div>
    </div>
  </el-card>
  <el-empty v-else description="暂无命令记录" :image-size="48" />
</template>

<script setup lang="ts">
defineProps<{
  commands: Array<{
    cmdId: string
    action: string
    status: string
    reason: string | null
    createdAt: string | null
  }>
}>();

function statusTagType(status: string): string {
  switch (status) {
    case 'ACKED': return 'success';
    case 'REJECTED':
    case 'ERROR': return 'danger';
    case 'TIMEOUT': return 'warning';
    default: return 'info';
  }
}

function formatTime(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.commands-panel {
  height: 100%;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cmd-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  min-height: 0;
}
.cmd-item {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fafbfc;
}
.cmd-left, .cmd-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cmd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}
.cmd-id-mono {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #6b7280;
}
.cmd-action {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}
.cmd-time {
  font-size: 11px;
  color: #94a3b8;
}
.cmd-reason {
  width: 100%;
  margin-top: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 12px;
}
.commands-panel :deep(.el-card__body) {
  height: calc(100% - 57px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>

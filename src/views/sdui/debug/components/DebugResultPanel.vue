<template>
  <aside class="result-panel" aria-label="调试结果">
    <section class="current-result" aria-live="polite">
      <div class="panel-heading"><h2>执行结果</h2><span v-if="submitting" class="pending">执行中</span></div>
      <el-alert v-if="submitting" type="info" :closable="false" :title="`正在${actionLabel(submitting)}…`" show-icon/>
      <el-alert v-else-if="submitError" type="error" :closable="false" :title="submitError" show-icon/>
      <template v-else-if="selected">
        <div class="result-summary"><strong>{{ actionLabel(selected.name) }}</strong><el-tag :type="selected.ok ? 'success' : 'danger'" size="small">{{ selected.ok ? '成功' : '失败' }}</el-tag></div>
        <p v-if="selected.error" class="result-error">{{ selected.error }}</p>
        <dl class="result-meta"><dt>请求 ID</dt><dd>{{ selected.requestId }}</dd><template v-if="'at' in selected"><dt>时间</dt><dd>{{ formatTime(selected.at) }}</dd></template></dl>
      </template>
      <p v-else class="empty-result">执行操作后，结果显示在这里</p>
      <el-alert v-if="audioStatus" :type="audioStatusType" :closable="false" :title="audioStatus" show-icon/>
      <el-skeleton v-if="detailLoading" :rows="2" animated/>
      <el-alert v-if="detailError" type="warning" :closable="false" :title="detailError" show-icon/>
      <details v-if="selected" :key="selected.requestId" class="technical-details"><summary>请求与返回数据</summary><pre>{{ JSON.stringify(selected, null, 2) }}</pre></details>
    </section>
    <section class="history-section">
      <div class="panel-heading"><h2>最近操作</h2><el-button link type="primary" :loading="loading" @click="$emit('refresh')">刷新</el-button></div>
      <el-alert v-if="error" :type="history.length ? 'warning' : 'error'" :closable="false" :title="error" show-icon/>
      <div v-loading="loading" class="history-list">
        <p v-if="!history.length" class="empty-history">{{ error ? '历史记录读取失败' : '暂无操作记录' }}</p>
        <button v-for="entry in history" :key="entry.requestId" type="button" class="history-entry" :class="{selected: selected?.requestId === entry.requestId}" :disabled="Boolean(submitting)" :aria-pressed="selected?.requestId === entry.requestId" @click="$emit('select', entry)">
          <span class="entry-main"><span>{{ actionLabel(entry.name) }}</span><time :datetime="entry.at">{{ formatTime(entry.at) }}</time></span>
          <span class="entry-status" :class="{failed: !entry.ok}">{{ entry.ok ? '成功' : '失败' }}</span>
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import type { DebugJournalEntry, DebugRequestResult } from '@/types/sdui-debug';

defineProps<{
  history: DebugJournalEntry[];
  selected: DebugJournalEntry | DebugRequestResult | null;
  loading: boolean;
  detailLoading: boolean;
  error: string;
  detailError: string;
  submitting: string;
  submitError: string;
  audioStatus: string;
  audioStatusType: 'success' | 'error' | 'info' | 'warning';
  actionLabel: (name: string) => string;
}>();
defineEmits<{ refresh: []; select: [entry: DebugJournalEntry] }>();

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped lang="scss">
.result-panel { min-width: 0; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; border: 1px solid #e4e7ec; border-radius: 6px; background: #fff; overflow: hidden; }
.current-result, .history-section { padding: 16px; }
.current-result { display: flex; flex: 0 1 auto; flex-direction: column; min-height: 0; max-height: 45%; overflow-y: auto; }
.history-section { display: flex; flex: 1 1 0; flex-direction: column; min-height: 0; border-top: 1px solid #eef0f3; }
.history-section > .panel-heading { flex-shrink: 0; }
.panel-heading, .result-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-heading { margin-bottom: 12px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; color: #1d2939; }
.pending { color: #175cd3; font-size: 12px; }
.result-summary { font-size: 14px; line-height: 1.5; }
.result-summary strong { overflow-wrap: anywhere; }
.result-meta { margin: 16px 0; display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 8px; font-size: 12px; line-height: 1.6; }
.result-meta dt { color: #667085; }
.result-meta dd { margin: 0; color: #344054; overflow-wrap: anywhere; }
.result-error { font-size: 13px; color: #b42318; overflow-wrap: anywhere; }
.empty-result, .empty-history { color: #667085; font-size: 13px; line-height: 1.6; }
.empty-result { margin: 4px 0; }
.technical-details { margin-top: 16px; font-size: 12px; color: #475467; }
summary { cursor: pointer; padding: 4px 0; }
pre { max-height: 260px; overflow: auto; padding: 12px; background: #f7f8fa; border-radius: 4px; line-height: 1.6; }
.history-list { flex: 1; min-height: 0; overflow-y: auto; }
.history-entry { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; padding: 10px 8px; border: 0; border-bottom: 1px solid #eef0f3; background: #fff; border-radius: 4px; cursor: pointer; font: inherit; }
.history-entry:hover { background: #f7f8fa; }
.history-entry:disabled { cursor: wait; opacity: .6; }
.history-entry.selected { background: #eff6ff; }
.history-entry:focus-visible, summary:focus-visible { outline: 2px solid #1677ff; outline-offset: -2px; }
.entry-main { display: grid; min-width: 0; gap: 5px; font-size: 13px; color: #344054; overflow-wrap: anywhere; }
.entry-main time { font-size: 12px; color: #667085; }
.entry-status { flex-shrink: 0; color: #067647; font-size: 12px; }
.entry-status.failed { color: #b42318; }
:deep(.el-alert) { margin: 12px 0; }
@media (max-width: 1200px) { .result-panel { height: 480px; } }
</style>

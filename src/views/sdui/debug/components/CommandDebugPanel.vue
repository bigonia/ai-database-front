<template>
  <div class="command-panel">
    <div class="command-grid">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-header">
            <div>
              <div class="panel-title">命令目录</div>
              <div class="panel-subtitle">直接执行设备命令，结果会进入右侧时间线。</div>
            </div>
            <el-button text :loading="loading" @click="emit('refresh')">刷新</el-button>
          </div>
        </template>

        <div v-if="activeGroups.length" class="command-layout">
          <article
            v-if="rgbEffectCommand"
            class="rgb-feature-card"
            :class="[`tone-${resolveGroupTone(rgbEffectCommand.group)}`]"
          >
            <div class="rgb-feature-main">
              <div class="command-card-top">
                <div class="command-badges">
                  <span class="group-count">{{ rgbEffectCommand.group }}</span>
                  <span class="command-chip">调色盘取色</span>
                  <span class="command-chip">一键关闭</span>
                </div>
              </div>

              <div class="command-head">
                <div class="command-title-row">
                  <strong>{{ rgbEffectCommand.displayName }}</strong>
                  <span class="command-key mono">{{ rgbEffectCommand.command }}</span>
                </div>
                <div v-if="rgbEffectCommand.description" class="muted command-description">
                  {{ rgbEffectCommand.description }}
                </div>
              </div>

              <div class="rgb-feature-grid">
                <div class="rgb-preview rgb-feature-preview" :style="{ '--rgb-color': rgbColorHex }">
                  <div class="rgb-swatch" />
                  <div class="rgb-preview-meta">
                    <strong>{{ rgbColorHex.toUpperCase() }}</strong>
                    <span class="muted">R {{ rgbTriplet.r }} / G {{ rgbTriplet.g }} / B {{ rgbTriplet.b }}</span>
                  </div>
                </div>

                <el-form label-position="top" size="small" class="rgb-feature-form">
                  <div class="rgb-feature-controls">
                    <el-form-item label="颜色">
                      <el-color-picker v-model="rgbColorHex" show-alpha="false" />
                    </el-form-item>
                    <el-form-item label="模式">
                      <el-select v-model="formState[rgbEffectCommand.command].mode">
                        <el-option
                          v-for="option in findParam(rgbEffectCommand, 'mode')?.options || []"
                          :key="String(option.value)"
                          :label="option.label"
                          :value="option.value"
                        />
                      </el-select>
                    </el-form-item>
                  </div>

                  <div class="rgb-inline-fields">
                    <el-form-item label="亮度">
                      <el-input-number
                        v-model="formState[rgbEffectCommand.command].brightness"
                        :min="findParam(rgbEffectCommand, 'brightness')?.min ?? 0"
                        :max="findParam(rgbEffectCommand, 'brightness')?.max ?? 255"
                        :step="findParam(rgbEffectCommand, 'brightness')?.step ?? 1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    <el-form-item label="周期 ms">
                      <el-input-number
                        v-model="formState[rgbEffectCommand.command].period_ms"
                        :min="findParam(rgbEffectCommand, 'period_ms')?.min ?? 200"
                        :max="findParam(rgbEffectCommand, 'period_ms')?.max ?? 5000"
                        :step="findParam(rgbEffectCommand, 'period_ms')?.step ?? 1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    <el-form-item label="步进 ms">
                      <el-input-number
                        v-model="formState[rgbEffectCommand.command].step_ms"
                        :min="findParam(rgbEffectCommand, 'step_ms')?.min ?? 10"
                        :max="findParam(rgbEffectCommand, 'step_ms')?.max ?? 500"
                        :step="findParam(rgbEffectCommand, 'step_ms')?.step ?? 1"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </div>
                </el-form>
              </div>
            </div>

            <div class="command-actions rgb-actions rgb-feature-actions">
              <el-button
                plain
                size="small"
                :loading="submittingCommand === 'rgb.off'"
                @click="submitRgbOff"
              >
                关闭灯光
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="submittingCommand === rgbEffectCommand.command"
                @click="submitRgbEffect"
              >
                应用灯光
              </el-button>
            </div>
          </article>

          <div class="command-wall">
            <article
              v-for="command in displayCommands"
              :key="command.command"
              class="command-card"
              :class="[`tone-${resolveGroupTone(command.group)}`, { 'command-card-compact': command.params.length === 0 }]"
            >
            <div class="command-card-top">
              <div class="command-badges">
                <span class="group-count">{{ command.group }}</span>
                <span class="command-chip">{{ command.params.length ? `${command.params.length} 个参数` : '即点即发' }}</span>
              </div>
            </div>

            <div class="command-card-body">
              <div class="command-head">
                <div class="command-title-row">
                  <strong>{{ command.displayName }}</strong>
                  <span class="command-key mono">{{ command.command }}</span>
                </div>
                <div v-if="command.description" class="muted command-description">
                  {{ command.description }}
                </div>
              </div>

              <el-form v-if="command.params.length" label-position="top" size="small" class="command-form">
                <el-form-item v-for="param in command.params" :key="`${command.command}-${param.name}`" :label="param.label">
                  <el-select
                    v-if="param.options?.length"
                    v-model="formState[command.command][param.name]"
                    filterable
                    clearable
                  >
                    <el-option v-for="option in param.options" :key="String(option.value)" :label="option.label" :value="option.value" />
                  </el-select>
                  <el-switch
                    v-else-if="param.type === 'bool'"
                    v-model="formState[command.command][param.name]"
                  />
                  <el-input-number
                    v-else-if="isNumericParam(param.type)"
                    v-model="formState[command.command][param.name]"
                    :min="param.min ?? 0"
                    :max="param.max ?? 9999"
                    :step="param.step ?? 1"
                    style="width: 100%"
                  />
                  <el-input
                    v-else
                    v-model="formState[command.command][param.name]"
                    :placeholder="param.required ? '必填参数' : '可选参数'"
                  />
                </el-form-item>
              </el-form>
              <div v-else class="command-empty muted">无需额外参数，点击后会直接下发命令。</div>

              <div class="command-actions">
                <el-button
                  type="primary"
                  size="small"
                  :loading="submittingCommand === command.command"
                  @click="submit(command.command)"
                >
                  执行并跟踪
                </el-button>
              </div>
            </div>
            </article>
          </div>
        </div>
        <el-empty v-else description="当前设备没有可调试命令" :image-size="52" />
      </el-card>

      <div class="stack-gap">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">回执时间线</div>
                <div class="panel-subtitle">初始数据来自 history，后续由 SSE 增量更新。</div>
              </div>
            </div>
          </template>

          <div v-if="timeline.length" class="timeline-list">
            <article
              v-for="item in timeline"
              :key="item.cmdId"
              class="timeline-card"
              @click="emit('select-detail', item.cmdId)"
            >
              <div class="timeline-top">
                <div class="timeline-heading">
                  <strong>{{ item.command }}</strong>
                  <div class="muted mono timeline-id">{{ item.cmdId }}</div>
                </div>
                <el-tag size="small" :type="statusType(item.ackStatus)">
                  {{ item.ackStatus || item.dispatchStatus }}
                </el-tag>
              </div>
              <div class="timeline-meta">
                <span>action {{ item.action || '-' }}</span>
                <span>{{ formatTime(item.createdAt) }}</span>
                <span v-if="item.ackAt">ack {{ formatTime(item.ackAt) }}</span>
              </div>
              <div v-if="item.reason" class="reason-banner">{{ item.reason }}</div>
              <pre class="json-panel">{{ prettyJson(item.params) }}</pre>
            </article>
          </div>
          <el-empty v-else description="还没有命令记录" :image-size="48" />
        </el-card>
      </div>
    </div>

    <el-drawer :model-value="!!selectedDetail" title="命令详情" size="520px" @close="emit('close-detail')">
      <template v-if="selectedDetail">
        <div class="stack-gap">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="cmdId">{{ selectedDetail.cmdId }}</el-descriptions-item>
            <el-descriptions-item label="command">{{ selectedDetail.command }}</el-descriptions-item>
            <el-descriptions-item label="action">{{ selectedDetail.action || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ selectedDetail.ackStatus || selectedDetail.dispatchStatus }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(selectedDetail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="ACK 时间">{{ formatTime(selectedDetail.ackAt) }}</el-descriptions-item>
          </el-descriptions>
          <pre class="json-panel">{{ prettyJson(selectedDetail.params) }}</pre>
          <div v-if="selectedDetail.reason" class="reason-banner">{{ selectedDetail.reason }}</div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { sendDebugCommand } from '@/api/sdui';
import { normalizeCommandExecution, groupCommandsByGroup } from '../normalize';
import type { DebugCommandCatalog, DebugCommandDefinition, DebugCommandHistoryItem } from '../types';

const props = defineProps<{
  deviceId: string;
  loading: boolean;
  catalog: DebugCommandCatalog;
  timeline: DebugCommandHistoryItem[];
  selectedDetail: DebugCommandHistoryItem | null;
}>();

const emit = defineEmits(['refresh', 'record-created', 'select-detail', 'close-detail']);

const submittingCommand = ref('');
const formState = reactive<Record<string, Record<string, unknown>>>({});

const activeGroups = computed(() => {
  return groupCommandsByGroup(props.catalog.deviceCommands);
});

const flatCommands = computed(() => {
  return activeGroups.value.flatMap((group) => group.commands.map((command) => ({
    ...command,
    group: group.name
  })));
});

const rgbEffectCommand = computed(() => {
  return flatCommands.value.find((command) => command.command === 'rgb.effect.set');
});

const displayCommands = computed(() => {
  return flatCommands.value.filter((command) => !['rgb.effect.set', 'rgb.off'].includes(command.command));
});

const rgbColorHex = computed({
  get() {
    const rgbCommand = rgbEffectCommand.value;
    if (!rgbCommand) return '#ff0000';
    const state = formState[rgbCommand.command] || {};
    const r = clampColorChannel(state.r);
    const g = clampColorChannel(state.g);
    const b = clampColorChannel(state.b);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },
  set(value: string) {
    const rgbCommand = rgbEffectCommand.value;
    if (!rgbCommand) return;
    const { r, g, b } = parseHexColor(value);
    formState[rgbCommand.command].r = r;
    formState[rgbCommand.command].g = g;
    formState[rgbCommand.command].b = b;
  }
});

const rgbTriplet = computed(() => {
  return parseHexColor(rgbColorHex.value);
});

watch(
  () => props.catalog.deviceCommands,
  () => {
    props.catalog.deviceCommands.forEach((command) => {
      if (!formState[command.command]) formState[command.command] = {};
      command.params.forEach((param) => {
        if (formState[command.command][param.name] !== undefined) return;
        if (param.options?.length) {
          formState[command.command][param.name] = param.options[0].value;
          return;
        }
        if (param.type === 'bool') {
          formState[command.command][param.name] = false;
          return;
        }
        if (isNumericParam(param.type)) {
          formState[command.command][param.name] = param.default ?? param.min ?? 0;
          return;
        }
        formState[command.command][param.name] = param.default ?? '';
      });
    });
  },
  { immediate: true, deep: true }
);

async function submit(commandName: string) {
  const command = props.catalog.deviceCommands
    .find((item) => item.command === commandName) as DebugCommandDefinition | undefined;
  if (!command) return;

  submittingCommand.value = commandName;
  const params = { ...(formState[commandName] || {}) };
  try {
    const response = await sendDebugCommand(props.deviceId, { command: commandName, params });
    const result = normalizeCommandExecution(response, commandName, params);
    if (!result.sent || result.status === 'VALIDATION_FAILED') {
      ElMessage.error(result.validationErrors.join('；') || `${commandName} 执行业务失败`);
    } else {
      ElMessage.success(`${commandName} 已发送，等待 ACK`);
    }
    emit('record-created', {
      cmdId: result.cmdId,
      deviceId: result.deviceId,
      command: result.command,
      action: result.command,
      params,
      dispatchStatus: result.dispatchStatus,
      ackStatus: result.ackStatus,
      reason: result.validationErrors.join('；'),
      createdAt: new Date().toISOString(),
      ackAt: ''
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '命令发送失败';
    ElMessage.error(message);
  } finally {
    submittingCommand.value = '';
  }
}

async function submitRgbEffect() {
  const command = rgbEffectCommand.value;
  if (!command) return;
  const nextParams = {
    ...(formState[command.command] || {}),
    ...rgbTriplet.value
  };
  await submitWithParams(command, nextParams);
}

async function submitRgbOff() {
  const command = props.catalog.deviceCommands.find((item) => item.command === 'rgb.off');
  if (!command) return;
  await submitWithParams(command, {});
}

async function submitWithParams(command: DebugCommandDefinition, params: Record<string, unknown>) {
  submittingCommand.value = command.command;
  try {
    const response = await sendDebugCommand(props.deviceId, { command: command.command, params });
    const result = normalizeCommandExecution(response, command.command, params);
    if (!result.sent || result.status === 'VALIDATION_FAILED') {
      ElMessage.error(result.validationErrors.join('；') || `${command.command} 执行业务失败`);
    } else {
      ElMessage.success(`${command.displayName} 已发送，等待 ACK`);
    }
    emit('record-created', {
      cmdId: result.cmdId,
      deviceId: result.deviceId,
      command: result.command,
      action: result.command,
      params,
      dispatchStatus: result.dispatchStatus,
      ackStatus: result.ackStatus,
      reason: result.validationErrors.join('；'),
      createdAt: new Date().toISOString(),
      ackAt: ''
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '命令发送失败';
    ElMessage.error(message);
  } finally {
    submittingCommand.value = '';
  }
}

function isNumericParam(type: string) {
  return ['int', 'number', 'float'].includes(type);
}

function statusType(status: string) {
  if (status === 'ACKED') return 'success';
  if (['REJECTED', 'ERROR'].includes(status)) return 'danger';
  if (status === 'TIMEOUT' || status === 'VALIDATION_FAILED') return 'warning';
  return 'info';
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function prettyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function findParam(command: DebugCommandDefinition, name: string) {
  return command.params.find((param) => param.name === name);
}

function resolveGroupTone(group: string) {
  if (group.includes('显示')) return 'display';
  if (group.includes('音频') || group.includes('声音')) return 'audio';
  if (group.includes('设备')) return 'device';
  if (group.includes('RGB')) return 'rgb';
  return 'default';
}

function clampColorChannel(value: unknown) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.min(255, Math.max(0, Math.round(number)));
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}

function parseHexColor(value: string) {
  const normalized = value.replace('#', '').trim();
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0
  };
}
</script>

<style scoped>
.command-panel,
.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
  gap: 20px;
  align-items: start;
}

.panel-header,
.command-actions,
.timeline-meta {
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
.muted,
.timeline-meta {
  color: #6b7280;
}

.mono {
  font-family: Menlo, Monaco, Consolas, monospace;
}

.command-layout,
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.timeline-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.group-count {
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  background: #eff6ff;
  white-space: nowrap;
}

.command-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 360px));
  gap: 16px;
  align-items: start;
  align-content: start;
}

.command-card,
.timeline-card,
.rgb-feature-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.command-card {
  display: flex;
  flex-direction: column;
  height: 260px;
  padding: 16px;
  overflow: hidden;
}

.command-card-compact {
  height: 260px;
}

.command-card-top {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.command-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.command-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.command-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.command-title-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.command-key {
  color: #64748b;
  font-size: 12px;
  word-break: break-all;
}

.command-description {
  font-size: 13px;
  line-height: 1.5;
}

.command-chip {
  color: #475569;
  font-size: 12px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.command-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.command-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.command-form {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.command-empty {
  margin-top: 6px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.9);
  font-size: 13px;
  line-height: 1.5;
}

.rgb-feature-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: end;
  padding: 18px 20px;
}

.rgb-feature-main {
  min-width: 0;
}

.rgb-feature-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.rgb-feature-form {
  min-width: 0;
}

.rgb-feature-controls {
  display: grid;
  grid-template-columns: 180px minmax(220px, 280px);
  gap: 12px;
}

.rgb-feature-preview {
  margin-bottom: 0;
  min-height: 116px;
}

.rgb-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--rgb-color) 18%, white) 0%, rgba(255, 255, 255, 0.96) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  flex-shrink: 0;
}

.rgb-swatch {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--rgb-color);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.7),
    0 10px 24px color-mix(in srgb, var(--rgb-color) 28%, transparent);
}

.rgb-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rgb-inline-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.command-actions {
  margin-top: auto;
  padding-top: 14px;
  flex-shrink: 0;
}

.rgb-actions {
  justify-content: flex-end;
  gap: 10px;
}

.rgb-feature-actions {
  align-self: end;
  padding-top: 0;
  white-space: nowrap;
}

.tone-display {
  border-color: #bfdbfe;
  background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
}

.tone-display .group-count {
  color: #1d4ed8;
  background: #dbeafe;
}

.tone-audio {
  border-color: #fde68a;
  background: linear-gradient(180deg, #ffffff 0%, #fffdf5 100%);
}

.tone-audio .group-count {
  color: #b45309;
  background: #fef3c7;
}

.tone-device {
  border-color: #c7d2fe;
  background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
}

.tone-device .group-count {
  color: #4338ca;
  background: #e0e7ff;
}

.tone-rgb {
  border-color: #f5d0fe;
  background:
    linear-gradient(180deg, #ffffff 0%, #fff9fe 100%),
    radial-gradient(circle at top right, rgba(236, 72, 153, 0.1), transparent 35%);
}

.tone-rgb .group-count {
  color: #a21caf;
  background: #fae8ff;
}

.tone-default .group-count {
  color: #0f766e;
  background: #ccfbf1;
}

.timeline-card {
  cursor: pointer;
  padding: 14px 16px 16px;
}

.timeline-heading {
  min-width: 0;
}

.timeline-id {
  margin-top: 2px;
  word-break: break-all;
}

.json-panel {
  margin: 10px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  overflow: auto;
  max-height: 180px;
}

.reason-banner {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
  color: #c2410c;
}

@media (max-width: 1200px) {
  .command-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .command-wall {
    grid-template-columns: 1fr;
  }

  .rgb-feature-card,
  .rgb-feature-grid,
  .rgb-feature-controls,
  .rgb-inline-fields {
    grid-template-columns: 1fr;
  }

  .rgb-feature-actions {
    white-space: normal;
  }

  .timeline-meta {
    flex-direction: column;
    align-items: flex-start;
  }
}

</style>

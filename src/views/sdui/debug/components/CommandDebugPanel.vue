<template>
  <div class="command-panel">
    <div class="command-grid">
      <el-card shadow="never" class="panel-card command-directory-card">
        <template #header>
          <div class="panel-header">
            <div>
              <div class="panel-title">命令目录</div>
              <div class="panel-subtitle">直接执行设备命令，结果会进入右侧执行记录。</div>
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

          <article
            v-if="audioRecordFeatureEnabled"
            class="audio-record-card"
            :class="[`tone-${resolveGroupTone(audioRecordCommand?.group || '音频')}`, `audio-phase-${effectiveAudioPhase}`]"
          >
            <div class="audio-record-main">
              <div class="command-card-top">
                <div class="command-badges">
                  <span class="group-count">{{ audioRecordCommand?.group || '音频' }}</span>
                  <span class="command-chip">开始 / 停止合并</span>
                  <span class="command-chip">{{ audioStatusText }}</span>
                </div>
              </div>

              <div class="command-head">
                <div class="command-title-row">
                  <strong>音频录制</strong>
                  <span class="command-key mono">audio.record.start / audio.record.stop</span>
                </div>
                <div class="muted command-description">
                  采集设备录音，查看识别结果并直接试听返回音频。
                </div>
              </div>

              <div class="audio-summary-band">
                <div class="audio-status-top">
                  <div class="audio-status-orb" :class="`audio-status-${effectiveAudioPhase}`">
                    <span>{{ audioPhaseEmoji }}</span>
                  </div>
                  <div class="audio-status-meta">
                    <strong>{{ audioStatusHeadline }}</strong>
                    <span class="muted">{{ audioProgressText }}</span>
                  </div>
                </div>

                <div class="audio-metric-strip">
                  <div class="audio-metric-chip">
                    <span class="audio-metric-label">状态</span>
                    <strong>{{ audioStatusText }}</strong>
                  </div>
                  <div class="audio-metric-chip">
                    <span class="audio-metric-label">数据量</span>
                    <strong>{{ audioDataSizeText }}</strong>
                  </div>
                  <div class="audio-metric-chip">
                    <span class="audio-metric-label">分片</span>
                    <strong>{{ audioChunkCountText }}</strong>
                  </div>
                  <div class="audio-metric-chip">
                    <span class="audio-metric-label">时长</span>
                    <strong>{{ audioDurationText }}</strong>
                  </div>
                </div>
              </div>

              <div class="audio-record-grid">
                <div class="audio-primary-panel">
                  <span class="audio-record-label">识别结果</span>
                  <div class="audio-record-value audio-transcript" :class="{ muted: !audioTranscriptText }">
                    {{ audioTranscriptText || '暂无识别文本' }}
                  </div>
                </div>

                <div class="audio-secondary-stack">
                  <div v-if="effectiveAudioPhase !== 'idle'" class="audio-record-row">
                    <span class="audio-record-label">处理进度</span>
                    <span class="audio-record-value">
                      {{ audioProcessingText }}
                    </span>
                  </div>

                  <div v-if="audioArtifactMetaText" class="audio-record-row">
                    <span class="audio-record-label">产物信息</span>
                    <span class="audio-record-value">
                      {{ audioArtifactMetaText }}
                    </span>
                  </div>

                  <div v-if="audioRecordState.artifact" class="audio-record-player">
                    <span class="audio-record-label">试听播放</span>
                    <audio :key="audioRecordState.resultVersion" controls preload="metadata" :src="audioRecordUrl" />
                  </div>
                </div>
              </div>
            </div>

            <div class="command-actions audio-actions">
              <el-button
                class="audio-record-button"
                :class="{ 'is-recording': effectiveAudioPhase === 'recording' }"
                :type="effectiveAudioPhase === 'recording' ? 'danger' : 'primary'"
                :loading="isAudioCommandSubmitting"
                :disabled="effectiveAudioPhase === 'processing'"
                @click="toggleAudioRecord"
              >
                {{ audioButtonLabel }}
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
        <el-card shadow="never" class="panel-card execution-record-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">命令执行记录</div>
                <div class="panel-subtitle">同一次命令的下发和设备确认会合并为一条业务记录。</div>
              </div>
            </div>
          </template>

          <div v-if="timeline.length" class="execution-record-content">
            <div class="timeline-list">
              <article
                v-for="item in pagedTimeline"
                :key="item.cmdId"
                class="timeline-card"
                @click="emit('select-detail', item.cmdId)"
              >
                <div class="timeline-top">
                  <div class="timeline-heading">
                    <strong>{{ commandDisplayName(item.command) }}</strong>
                    <div class="muted command-summary">{{ commandParamSummary(item) }}</div>
                  </div>
                  <el-tag size="small" :type="executionStatus(item).tagType">
                    {{ executionStatus(item).label }}
                  </el-tag>
                </div>
                <div class="timeline-meta">
                  <span>{{ executionStatus(item).description }}</span>
                  <span>{{ formatTime(item.ackAt || item.createdAt) }}</span>
                </div>
                <div v-if="item.reason" class="reason-banner">{{ item.reason }}</div>
              </article>
            </div>

            <el-pagination
              v-model:current-page="executionRecordPage"
              class="execution-pagination"
              :page-size="executionRecordPageSize"
              :total="timeline.length"
              layout="total, prev, pager, next"
              small
              background
            />
          </div>
          <el-empty v-else description="还没有命令执行记录" :image-size="48" />
        </el-card>
      </div>
    </div>

    <el-drawer :model-value="!!selectedDetail" title="命令执行详情" size="520px" @close="emit('close-detail')">
      <template v-if="selectedDetail">
        <div class="stack-gap">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="命令">{{ commandDisplayName(selectedDetail.command) }}</el-descriptions-item>
            <el-descriptions-item label="执行状态">
              {{ executionStatus(selectedDetail).label }}
            </el-descriptions-item>
            <el-descriptions-item label="执行参数">{{ commandParamSummary(selectedDetail) }}</el-descriptions-item>
            <el-descriptions-item label="发起时间">{{ formatTime(selectedDetail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatTime(selectedDetail.ackAt) }}</el-descriptions-item>
          </el-descriptions>
          <div v-if="selectedDetail.reason" class="reason-banner">{{ selectedDetail.reason }}</div>
          <el-collapse>
            <el-collapse-item title="技术详情">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="cmdId">{{ selectedDetail.cmdId }}</el-descriptions-item>
                <el-descriptions-item label="command">{{ selectedDetail.command }}</el-descriptions-item>
                <el-descriptions-item label="action">{{ selectedDetail.action || '-' }}</el-descriptions-item>
                <el-descriptions-item label="下发状态">{{ selectedDetail.dispatchStatus || '-' }}</el-descriptions-item>
                <el-descriptions-item label="回执状态">{{ selectedDetail.ackStatus || '-' }}</el-descriptions-item>
              </el-descriptions>
              <pre class="json-panel detail-json">{{ prettyJson(selectedDetail.params) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { buildDebugAudioRecordArtifactBlobUrl, sendDebugCommand } from '@/api/sdui';
import { normalizeCommandExecution, groupCommandsByGroup } from '../normalize';
import type {
  DebugAudioRecordState,
  DebugCommandCatalog,
  DebugCommandDefinition,
  DebugCommandHistoryItem
} from '../types';

const props = defineProps<{
  deviceId: string;
  loading: boolean;
  catalog: DebugCommandCatalog;
  timeline: DebugCommandHistoryItem[];
  audioRecordState: DebugAudioRecordState;
  selectedDetail: DebugCommandHistoryItem | null;
}>();

const emit = defineEmits(['refresh', 'record-created', 'select-detail', 'close-detail']);

const submittingCommand = ref('');
const optimisticAudioPhase = ref<DebugAudioRecordState['phase'] | null>(null);
const formState = reactive<Record<string, Record<string, unknown>>>({});
const executionRecordPage = ref(1);
const executionRecordPageSize = 5;

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

const audioStartCommand = computed(() => {
  return flatCommands.value.find((command) => command.command === 'audio.record.start');
});

const audioStopCommand = computed(() => {
  return flatCommands.value.find((command) => command.command === 'audio.record.stop');
});

const audioRecordFeatureEnabled = computed(() => {
  return !!audioStartCommand.value && !!audioStopCommand.value;
});

const audioRecordCommand = computed(() => {
  return audioStartCommand.value || audioStopCommand.value || null;
});

const displayCommands = computed(() => {
  return flatCommands.value.filter((command) => ![
    'rgb.effect.set',
    'rgb.off',
    ...(audioRecordFeatureEnabled.value ? ['audio.record.start', 'audio.record.stop'] : [])
  ].includes(command.command));
});

const pagedTimeline = computed(() => {
  const start = (executionRecordPage.value - 1) * executionRecordPageSize;
  return props.timeline.slice(start, start + executionRecordPageSize);
});

const isAudioCommandSubmitting = computed(() => {
  return ['audio.record.start', 'audio.record.stop'].includes(submittingCommand.value);
});

const effectiveAudioPhase = computed(() => {
  return optimisticAudioPhase.value ?? props.audioRecordState.phase;
});

const audioButtonLabel = computed(() => {
  if (effectiveAudioPhase.value === 'starting') return '⏺ 等待设备开始';
  if (effectiveAudioPhase.value === 'recording') return '⏹ 停止录制';
  if (effectiveAudioPhase.value === 'stopping') return '⏳ 等待设备停止';
  if (effectiveAudioPhase.value === 'processing') return '⏳ 识别中...';
  return '⏺ 开始录制';
});

const audioStatusText = computed(() => {
  if (effectiveAudioPhase.value === 'starting') return '启动中';
  if (effectiveAudioPhase.value === 'recording') return '录制中';
  if (effectiveAudioPhase.value === 'stopping') return '停止中';
  if (effectiveAudioPhase.value === 'processing') return '正在识别';
  if (effectiveAudioPhase.value === 'done') return '已完成';
  return '待开始';
});

const audioStatusHeadline = computed(() => {
  if (effectiveAudioPhase.value === 'starting') return '命令已发送，等待设备进入录制态';
  if (effectiveAudioPhase.value === 'recording') return '正在持续采集音频';
  if (effectiveAudioPhase.value === 'stopping') return '停止命令已发送，等待上传结束';
  if (effectiveAudioPhase.value === 'processing') return '音频已上传，正在识别';
  if (effectiveAudioPhase.value === 'done') return '录制与识别已完成';
  return '等待开始新的录音';
});

const audioPhaseEmoji = computed(() => {
  if (effectiveAudioPhase.value === 'starting') return '⌛';
  if (effectiveAudioPhase.value === 'recording') return '⏺';
  if (effectiveAudioPhase.value === 'stopping') return '⏹';
  if (effectiveAudioPhase.value === 'processing') return '⏳';
  if (effectiveAudioPhase.value === 'done') return '✅';
  return '🎤';
});

const audioProgressText = computed(() => {
  const { bytesReceived, chunkCount } = props.audioRecordState;
  const phase = effectiveAudioPhase.value;
  if (phase === 'starting') return '等待 audio.record.started 事件确认';
  if (phase === 'stopping') return '等待设备结束上传并进入识别';
  if (phase === 'processing' && bytesReceived > 0) {
    return `上传完成 · PCM ${formatBytes(bytesReceived)}`;
  }
  if (bytesReceived > 0 || chunkCount > 0) {
    return `已接收 ${formatBytes(bytesReceived)} · ${chunkCount} 分片`;
  }
  if (phase === 'processing') return '正在识别音频...';
  if (phase === 'done') return '录制与识别已完成';
  return '等待开始录制';
});

const audioDataSizeText = computed(() => {
  return props.audioRecordState.bytesReceived > 0 ? formatBytes(props.audioRecordState.bytesReceived) : '-';
});

const audioChunkCountText = computed(() => {
  return props.audioRecordState.chunkCount > 0 ? `${props.audioRecordState.chunkCount} 个` : '-';
});

const audioDurationText = computed(() => {
  if (props.audioRecordState.durationMs > 0) return formatDuration(props.audioRecordState.durationMs);
  if (props.audioRecordState.session?.elapsedMs) return formatDuration(props.audioRecordState.session.elapsedMs);
  return '-';
});

const audioProcessingText = computed(() => {
  if (effectiveAudioPhase.value === 'starting') return '命令 ACK 不代表已开始录音，等待设备事件回流';
  if (effectiveAudioPhase.value === 'stopping') return '设备仍在收尾上传，完成后会自动切到识别阶段';
  if (effectiveAudioPhase.value === 'processing') return '设备已停止录制，正在等待语音识别结果返回';
  if (effectiveAudioPhase.value === 'done') return '识别结果已返回，可继续试听或再次发起录制';
  return '';
});

const audioTranscriptText = computed(() => {
  return props.audioRecordState.transcript.trim();
});

const audioArtifactMetaText = computed(() => {
  const artifact = props.audioRecordState.artifact;
  if (!artifact) return '';
  const parts = [
    artifact.mimeType || 'audio/wav',
    artifact.blobBytes > 0 ? formatBytes(artifact.blobBytes) : '',
    artifact.sampleRate > 0 ? `${artifact.sampleRate}Hz` : '',
    artifact.channels > 0 ? `${artifact.channels} 声道` : '',
    artifact.bitsPerSample > 0 ? `${artifact.bitsPerSample}bit` : ''
  ].filter(Boolean);
  return parts.join(' · ');
});

const audioRecordUrl = computed(() => {
  return buildDebugAudioRecordArtifactBlobUrl(props.deviceId, props.audioRecordState.resultVersion || Date.now());
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

watch(
  () => props.audioRecordState.phase,
  (phase) => {
    if (!optimisticAudioPhase.value) return;
    if (phase === 'recording' || phase === 'processing' || phase === 'done' || phase === 'idle') {
      optimisticAudioPhase.value = null;
    }
  }
);

watch(
  () => props.deviceId,
  () => {
    optimisticAudioPhase.value = null;
    executionRecordPage.value = 1;
  }
);

watch(
  () => [props.timeline.length, props.timeline[0]?.cmdId] as const,
  ([length, latestCmdId], [previousLength, previousLatestCmdId]) => {
    const pageCount = Math.max(1, Math.ceil(length / executionRecordPageSize));
    if (latestCmdId && latestCmdId !== previousLatestCmdId && length >= previousLength) {
      executionRecordPage.value = 1;
      return;
    }
    if (executionRecordPage.value > pageCount) {
      executionRecordPage.value = pageCount;
    }
  }
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
      phase: 'dispatch',
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

async function toggleAudioRecord() {
  if (['starting', 'stopping', 'processing'].includes(effectiveAudioPhase.value)) return;
  if (effectiveAudioPhase.value === 'recording') {
    if (!audioStopCommand.value) return;
    optimisticAudioPhase.value = 'stopping';
    await submitWithParams(audioStopCommand.value, {});
    return;
  }
  if (!audioStartCommand.value) return;
  optimisticAudioPhase.value = 'starting';
  await submitWithParams(audioStartCommand.value, {});
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
      phase: 'dispatch',
      params,
      dispatchStatus: result.dispatchStatus,
      ackStatus: result.ackStatus,
      reason: result.validationErrors.join('；'),
      createdAt: new Date().toISOString(),
      ackAt: ''
    });
  } catch (error: unknown) {
    if (command.command === 'audio.record.start' || command.command === 'audio.record.stop') {
      optimisticAudioPhase.value = null;
    }
    const message = error instanceof Error ? error.message : '命令发送失败';
    ElMessage.error(message);
  } finally {
    submittingCommand.value = '';
  }
}

function isNumericParam(type: string) {
  return ['int', 'number', 'float'].includes(type);
}

function findCatalogCommand(commandName: string) {
  return flatCommands.value.find((command) => command.command === commandName);
}

function commandDisplayName(commandName: string) {
  return findCatalogCommand(commandName)?.displayName || commandName;
}

function commandParamSummary(item: DebugCommandHistoryItem) {
  const entries = Object.entries(item.params || {});
  if (!entries.length) return '无参数';
  const definition = findCatalogCommand(item.command);
  return entries.map(([key, value]) => {
    const param = definition?.params.find((candidate) => candidate.name === key);
    const option = param?.options?.find((candidate) => candidate.value === value);
    return `${param?.label || key}：${option?.label || formatParamValue(value)}`;
  }).join('，');
}

function formatParamValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '开启' : '关闭';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function executionStatus(item: DebugCommandHistoryItem): {
  label: string;
  description: string;
  tagType: 'success' | 'warning' | 'danger' | 'info';
} {
  if (item.ackStatus === 'ACKED') {
    return { label: '设备已确认', description: '命令下发成功，设备已返回确认', tagType: 'success' };
  }
  if (item.ackStatus === 'REJECTED') {
    return { label: '设备拒绝', description: '设备拒绝执行该命令', tagType: 'danger' };
  }
  if (item.ackStatus === 'TIMEOUT') {
    return { label: '确认超时', description: '命令已发送，但设备未及时确认', tagType: 'warning' };
  }
  if (['ERROR', 'VALIDATION_FAILED'].includes(item.ackStatus) || ['FAILED', 'ERROR'].includes(item.dispatchStatus)) {
    return { label: '执行失败', description: '命令未能正常执行', tagType: 'danger' };
  }
  if (['SENT', 'sent'].includes(item.dispatchStatus)) {
    return { label: '等待确认', description: '命令已发送，正在等待设备确认', tagType: 'info' };
  }
  return { label: '正在发送', description: '正在向设备下发命令', tagType: 'info' };
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function prettyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function formatBytes(value: number) {
  if (!value) return '0 KB';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatDuration(value: number) {
  if (!value) return '0s';
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
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
  --command-card-height: clamp(620px, calc(100vh - 260px), 820px);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
  gap: 20px;
  align-items: stretch;
}

.command-directory-card,
.execution-record-card {
  height: var(--command-card-height);
  display: flex;
  flex-direction: column;
}

.command-directory-card :deep(.el-card__header),
.execution-record-card :deep(.el-card__header) {
  flex: 0 0 auto;
}

.command-directory-card :deep(.el-card__body) {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.stack-gap,
.execution-record-card {
  min-height: 0;
}

.execution-record-card :deep(.el-card__body) {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
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

.execution-record-content {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.execution-record-content .timeline-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding-right: 2px;
}

.execution-pagination {
  flex: 0 0 auto;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #eef2f7;
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
.rgb-feature-card,
.audio-record-card {
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

.audio-record-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  min-height: 260px;
  align-items: stretch;
  padding: 18px 20px;
}

.audio-record-main {
  min-width: 0;
}

.audio-summary-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.92), rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(245, 158, 11, 0.16);
}

.audio-record-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
  gap: 18px;
  align-items: start;
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

.audio-record-button {
  min-width: 152px;
  font-weight: 700;
}

.audio-record-button.is-recording {
  animation: audio-record-pulse 1.6s ease-in-out infinite;
}

.audio-status-top {
  display: flex;
  gap: 14px;
  align-items: center;
}

.audio-status-orb {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 24px;
  background: #fff7ed;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.audio-status-recording {
  background: #fef2f2;
  color: #dc2626;
}

.audio-status-starting,
.audio-status-stopping {
  background: #eff6ff;
  color: #2563eb;
}

.audio-status-processing {
  background: #fff7ed;
  color: #ea580c;
}

.audio-status-done {
  background: #f0fdf4;
  color: #16a34a;
}

.audio-status-idle {
  background: #fff7ed;
  color: #b45309;
}

.audio-status-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.audio-metric-strip {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: wrap;
}

.audio-metric-chip {
  min-width: 92px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(245, 158, 11, 0.14);
}

.audio-metric-chip strong {
  font-size: 18px;
  line-height: 1.1;
  color: #1f2937;
}

.audio-metric-label {
  font-size: 11px;
  color: #92400e;
  letter-spacing: 0.03em;
}

.audio-primary-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.audio-secondary-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audio-record-row,
.audio-record-player {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.audio-record-label {
  font-size: 12px;
  font-weight: 700;
  color: #92400e;
  letter-spacing: 0.02em;
}

.audio-record-value {
  color: #3f3f46;
  line-height: 1.5;
  word-break: break-word;
}

.audio-transcript {
  min-height: 82px;
  font-size: 16px;
  line-height: 1.7;
}

.audio-record-player audio {
  width: 100%;
}

.rgb-actions {
  justify-content: flex-end;
  gap: 10px;
}

.audio-actions {
  justify-content: flex-end;
  align-self: stretch;
  padding-top: 0;
  white-space: nowrap;
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

.audio-phase-recording {
  border-color: #fca5a5;
  background:
    radial-gradient(circle at top right, rgba(239, 68, 68, 0.14), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #fff7f7 100%);
}

.audio-phase-starting,
.audio-phase-stopping {
  border-color: #93c5fd;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.audio-phase-processing {
  border-color: #fdba74;
  background:
    radial-gradient(circle at top right, rgba(251, 146, 60, 0.16), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #fffaf1 100%);
}

.audio-phase-done {
  border-color: #86efac;
  background:
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f7fff8 100%);
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

.command-summary {
  margin-top: 2px;
  line-height: 1.5;
  word-break: break-word;
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

.detail-json {
  margin-top: 12px;
}

.reason-banner {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
  color: #c2410c;
}

@keyframes audio-record-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.18);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
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
  .rgb-inline-fields,
  .audio-record-card,
  .audio-record-grid {
    grid-template-columns: 1fr;
  }

  .audio-summary-band {
    flex-direction: column;
    align-items: stretch;
  }

  .rgb-feature-actions,
  .audio-actions {
    white-space: normal;
  }

  .timeline-meta {
    flex-direction: column;
    align-items: flex-start;
  }
}

</style>

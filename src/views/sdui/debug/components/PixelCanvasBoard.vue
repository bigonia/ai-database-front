<template>
  <el-card shadow="never" class="canvas-debug-card frame-debug-card">
    <template #header>
      <div class="card-header">
        <span>Canvas 画板</span>
        <span class="canvas-resolution">{{ frameSpec.width }} × {{ frameSpec.width }} 像素 · {{ frameSpec.maxFps }} fps</span>
      </div>
    </template>
    <el-alert v-if="capabilityError" type="warning" :closable="false" :title="capabilityError"/>
    <el-alert v-if="specError" type="error" :closable="false" :title="specError"/>
    <div v-if="viewStateError" class="frame-state-warning">
      <el-alert type="warning" :closable="false" :title="`视图状态读取失败：${viewStateError}。编辑和新传输仍可继续。`"/>
      <el-button link type="primary" @click="emit('retry-view-state')">重试读取状态</el-button>
    </div>
    <el-form label-position="top">
      <div class="canvas-editor-layout">
        <div class="pixel-editor">
          <div class="pixel-toolbar">
            <div>
              <el-button size="small" :disabled="blocked || !drawingStrokes.length" @click="undoPixelStroke">撤销上一笔</el-button>
              <el-button size="small" :disabled="blocked" @click="clearPixelBoard">清空画布</el-button>
            </div>
          </div>
          <div class="pixel-grid-layout">
            <div class="pixel-ruler-top">
              <span v-for="mark in pixelGridMarks" :key="`x-${mark}`" :style="{left:`${mark/frameSpec.width*100}%`}">{{ mark }}</span>
            </div>
            <div class="pixel-ruler-left">
              <span v-for="mark in pixelGridMarks" :key="`y-${mark}`" :style="{top:`${mark/frameSpec.width*100}%`}">{{ mark }}</span>
            </div>
            <div class="pixel-board-wrap" :style="{backgroundColor:canvasBackgroundColor}">
              <canvas ref="pixelBoard" class="pixel-board" :width="frameSpec.width" :height="frameSpec.width" :aria-label="`${frameSpec.width}乘${frameSpec.width}像素网格画板`" @pointerdown="startPixelStroke" @pointermove="continuePixelStroke" @pointerup="finishPixelStroke" @pointercancel="finishPixelStroke"/>
              <svg class="pixel-grid-overlay" :viewBox="`0 0 ${frameSpec.width} ${frameSpec.width}`" preserveAspectRatio="none" aria-hidden="true">
                <path :d="pixelGridPath"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="canvas-settings">
          <h3 class="canvas-settings-heading">画布与画笔</h3>
          <dl class="canvas-meta">
            <div><dt>画布</dt><dd>{{ frameSpec.width }} × {{ frameSpec.width }}</dd></div>
            <div><dt>调色板</dt><dd>{{ parsedPalette.length }} 色{{ paletteBits(parsedPalette.length) ? ` · ${paletteBits(parsedPalette.length)} bit` : '' }}</dd></div>
            <div><dt>单帧约</dt><dd>{{ frameBytes === null ? '—' : `${(frameBytes / 1024).toFixed(1)} KiB` }}</dd></div>
            <div><dt>画笔</dt><dd>{{ brushSize }} px</dd></div>
          </dl>
          <div class="dimensions">
            <el-form-item label="画布分辨率">
              <el-select v-model="frameSpec.width" :disabled="sessionOpen || blocked" @change="setPixelResolution">
                <el-option v-for="size in frameOptions" :key="size" :label="`${size} × ${size} 像素`" :value="size">
                  {{ size }} × {{ size }}
                </el-option>
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="背景色" class="canvas-background-control">
            <el-color-picker v-model="canvasBackgroundColor" :disabled="sessionOpen" :predefine="DEFAULT_PALETTE_COLORS" color-format="hex" @change="setCanvasBackgroundColor"/>
          </el-form-item>
          <el-form-item label="画笔颜色" class="canvas-palette-control">
            <div class="palette-colors color-swatch-list">
              <button v-for="color in DEFAULT_PALETTE_COLORS" :key="`brush-${color}`" type="button" class="palette-swatch" :class="{selected:paletteColors[selectedPaletteIndex].toLowerCase()===color.toLowerCase()}" :style="{backgroundColor:color}" :title="`选择画笔颜色 ${color}`" :aria-label="`选择画笔颜色 ${color}`" @click="setCanvasBrushColor(color)"/>
              <el-color-picker :model-value="paletteColors[selectedPaletteIndex]" :disabled="sessionOpen" color-format="hex" @change="updatePaletteColor(selectedPaletteIndex,$event)"/>
            </div>
          </el-form-item>
          <el-form-item label="画笔大小" class="canvas-brush-control">
            <el-radio-group v-model="brushSize">
              <el-radio-button :value="1">1 px</el-radio-button>
              <el-radio-button :value="2">2 px</el-radio-button>
              <el-radio-button :value="4">4 px</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <h3 class="canvas-settings-heading canvas-transfer-heading">终端发送</h3>
          <el-form-item label="发送方式" class="canvas-send-control">
            <el-radio-group v-model="canvasSendMode">
              <el-radio-button value="final">最终画面</el-radio-button>
              <el-radio-button value="process">绘制过程</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="canvasSendMode==='process'" label="过程播放时长" class="canvas-duration-control">
            <el-select v-model="playbackSeconds">
              <el-option v-for="seconds in [2,4,8,12]" :key="seconds" :label="`${seconds} 秒`" :value="seconds"/>
            </el-select>
          </el-form-item>
          <el-form-item label="终端帧率上限" class="canvas-fps-control">
            <el-input-number v-model="frameSpec.maxFps" :min="1" :max="30" :disabled="sessionOpen"/>
          </el-form-item>
          <el-progress v-if="canvasPlaybackActive" :percentage="canvasPlaybackProgress" :show-text="true"/>
          <div class="frame-actions">
            <el-button type="primary" :disabled="blocked || (sessionOpen && sessionMode!=='canvas') || !online || Boolean(specError) || !pixelPixels.length" :loading="sendingCanvas && !canvasPlaybackActive" @click="sendPixelCanvas">{{ canvasSendMode==='final' ? '发送最终画面' : '播放绘制过程' }}</el-button>
            <el-button v-if="canvasPlaybackActive" type="warning" @click="cancelCanvasPlayback">停止播放</el-button>
            <el-button v-if="sessionOpen && sessionMode==='canvas'" :disabled="blocked || !canComplete" :loading="frameBusy && sessionMode==='canvas'" @click="emit('complete')">关闭 Canvas</el-button>
            <el-tag v-if="sessionOpen && sessionMode==='canvas'" type="success">Canvas 会话已打开</el-tag>
          </div>
        </div>
      </div>
    </el-form>
  </el-card>
</template>
<script setup lang="ts">
// Canvas 画板调试面板：像素绘制、调色板、帧打包与终端回放全部内聚在此组件。
// 会话开关与帧计数由父组件持有（与图片面板共享），通过 props/emits 同步。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { pixelPlaybackFrames, type PixelChange } from '../utils/pixelPlayback';
import {
  DEFAULT_PALETTE_COLORS,
  FRAME_SIZES,
  paletteBits,
  packPixelIndexes,
  rgbHexTo565,
  validateFrameSpec,
  type CanvasSessionSpec,
  type FrameCapabilities
} from '../utils/frameSpec';
import { publishDebugView, sendDebugViewFrame } from '@/api/sdui';

const props = defineProps<{
  deviceId: string;
  online: boolean;
  /** 其他调试功能（动作/区段/图片/音频）发送中 */
  externalBusy: boolean;
  /** 父组件帧操作（如 complete）进行中，用于按钮 loading */
  frameBusy: boolean;
  capabilities: FrameCapabilities | null;
  capabilityError: string;
  viewStateError: string;
  sessionOpen: boolean;
  sessionMode: 'image' | 'canvas';
  canComplete: boolean;
  /** 服务端报告的活动 Canvas 会话规格，恢复分辨率 / 帧率 / 调色板 */
  sessionSpec: CanvasSessionSpec | null;
}>();

const emit = defineEmits<{
  'busy-change': [busy: boolean];
  'session-opened': [];
  'frame-sent': [];
  'session-closed': [];
  'complete': [];
  'retry-view-state': [];
}>();

function dataOf(response: unknown): unknown { return (response as { data?: unknown })?.data; }
function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }

const frameSpec = ref({ width: 128, height: 128, maxFps: 10 });
const paletteColorCount = ref(16);
const paletteColors = ref([...DEFAULT_PALETTE_COLORS]);
const canvasBackgroundColor = ref('#ffffff');
const selectedPaletteIndex = ref(1);
const brushSize = ref(1);
const canvasSendMode = ref<'final' | 'process'>('final');
const playbackSeconds = ref(4);
const pixelBoard = ref<HTMLCanvasElement | null>(null);
const pixelPixels = ref<Uint8Array>(new Uint8Array(128 * 128));
const drawingStrokes = ref<PixelChange[][]>([]);
let pendingPixelChanges: PixelChange[] = [];
const pixelStrokeActive = ref(false);
const lastPaintPoint = ref<{ x: number; y: number } | null>(null);
const sendingCanvas = ref(false);
const canvasPlaybackActive = ref(false);
const canvasPlaybackProgress = ref(0);
const stopCanvasPlayback = ref(false);
let operationEpoch = 0;

const frameOptions = computed(() => props.capabilities?.resolutions == null ? FRAME_SIZES : props.capabilities.resolutions);
const availablePaletteColors = computed(() => paletteColors.value.slice(0, paletteColorCount.value));
const parsedPalette = computed(() => availablePaletteColors.value.map(rgbHexTo565));
const paletteText = computed(() => availablePaletteColors.value.map(rgbHexTo565).join(', '));
const blocked = computed(() => props.externalBusy || sendingCanvas.value);
const specError = computed(() => {
  const validation = validateFrameSpec({
    mode: 'canvas',
    palette: parsedPalette.value,
    width: frameSpec.value.width,
    height: frameSpec.value.height,
    capabilities: props.capabilities
  });
  return 'error' in validation ? validation.error : '';
});
const frameBytes = computed(() => {
  const bits = paletteBits(parsedPalette.value.length);
  return bits ? frameSpec.value.width * frameSpec.value.height * bits / 8 : null;
});
const pixelGridMarks = computed(() => {
  const size = frameSpec.value.width;
  const step = size <= 32 ? 4 : size <= 64 ? 8 : 16;
  const marks: number[] = [];
  for (let mark = 0; mark < size; mark += step) marks.push(mark);
  marks.push(size);
  return marks;
});
const pixelGridPath = computed(() => {
  const size = frameSpec.value.width;
  const commands: string[] = [];
  for (let line = 1; line < size; line++) commands.push(`M${line} 0V${size}`, `M0 ${line}H${size}`);
  return commands.join(' ');
});

function drawPixelBoard() {
  const canvas = pixelBoard.value;
  if (!canvas) return;
  const size = frameSpec.value.width;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.fillStyle = canvasBackgroundColor.value;
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < pixelPixels.value.length; index++) {
    const colorIndex = pixelPixels.value[index];
    if (colorIndex === 0) continue;
    context.fillStyle = colorIndex === 0 ? canvasBackgroundColor.value : (paletteColors.value[colorIndex] || paletteColors.value[0] || canvasBackgroundColor.value);
    context.fillRect(index % size, Math.floor(index / size), 1, 1);
  }
}

function setPixelResolution(size: number) {
  frameSpec.value.width = size;
  frameSpec.value.height = size;
  resetPixelBoard();
}

function resetPixelBoard() {
  pixelPixels.value = new Uint8Array(frameSpec.value.width * frameSpec.value.width);
  drawingStrokes.value = [];
  pendingPixelChanges = [];
  pixelStrokeActive.value = false;
  lastPaintPoint.value = null;
  selectedPaletteIndex.value = Math.min(1, paletteColorCount.value - 1);
  void nextTick(drawPixelBoard);
}

function capturePixelFrame() {
  if (pendingPixelChanges.length) drawingStrokes.value.push(pendingPixelChanges);
  pendingPixelChanges = [];
}

function changePixel(index: number, color: number) {
  const before = pixelPixels.value[index];
  if (before === color) return;
  pendingPixelChanges.push({ index, before, after: color });
  pixelPixels.value[index] = color;
}

function pixelPosition(event: PointerEvent) {
  const canvas = pixelBoard.value;
  if (!canvas) return null;
  const bounds = canvas.getBoundingClientRect();
  const size = frameSpec.value.width;
  if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return null;
  return {
    x: Math.max(0, Math.min(size - 1, Math.floor((event.clientX - bounds.left) * size / bounds.width))),
    y: Math.max(0, Math.min(size - 1, Math.floor((event.clientY - bounds.top) * size / bounds.height)))
  };
}

function paintPixel(point: { x: number; y: number }) {
  const size = frameSpec.value.width;
  const radius = Math.floor(brushSize.value / 2);
  for (let dy = -radius; dy < brushSize.value - radius; dy++) {
    for (let dx = -radius; dx < brushSize.value - radius; dx++) {
      const x = point.x + dx;
      const y = point.y + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) changePixel(y * size + x, selectedPaletteIndex.value);
    }
  }
}

function paintPixelLine(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let step = 0; step <= steps; step++) paintPixel({ x: Math.round(from.x + dx * step / steps), y: Math.round(from.y + dy * step / steps) });
  drawPixelBoard();
}

function startPixelStroke(event: PointerEvent) {
  if (blocked.value) return;
  event.preventDefault();
  pixelStrokeActive.value = true;
  pixelBoard.value?.setPointerCapture(event.pointerId);
  const point = pixelPosition(event);
  if (point) { paintPixel(point); lastPaintPoint.value = point; drawPixelBoard(); }
}

function continuePixelStroke(event: PointerEvent) {
  if (blocked.value || !pixelStrokeActive.value) return;
  const point = pixelPosition(event);
  if (!point) { lastPaintPoint.value = null; return; }
  paintPixelLine(lastPaintPoint.value || point, point);
  lastPaintPoint.value = point;
}

function finishPixelStroke() {
  if (!pixelStrokeActive.value) return;
  pixelStrokeActive.value = false;
  lastPaintPoint.value = null;
  capturePixelFrame();
}

function clearPixelBoard() {
  if (blocked.value) return;
  finishPixelStroke();
  for (let index = 0; index < pixelPixels.value.length; index++) changePixel(index, 0);
  drawPixelBoard();
  capturePixelFrame();
}

function undoPixelStroke() {
  if (blocked.value) return;
  finishPixelStroke();
  const stroke = drawingStrokes.value.pop();
  if (!stroke) return;
  for (let index = stroke.length - 1; index >= 0; index--) pixelPixels.value[stroke[index].index] = stroke[index].before;
  drawPixelBoard();
}

function updatePaletteColor(index: number, value: string | null) {
  if (!value) return;
  paletteColors.value[Math.max(1, index)] = value;
  void nextTick(drawPixelBoard);
}

function setCanvasBackgroundColor(color: string | null) {
  if (!color) return;
  canvasBackgroundColor.value = color;
  paletteColors.value[0] = color;
  void nextTick(drawPixelBoard);
}

function setCanvasBrushColor(color: string) {
  const existingIndex = paletteColors.value.findIndex((value, index) => index > 0 && index < paletteColorCount.value && value.toLowerCase() === color.toLowerCase());
  const index = existingIndex > 0 ? existingIndex : Math.max(1, Math.min(selectedPaletteIndex.value, paletteColorCount.value - 1));
  paletteColors.value[index] = color;
  selectedPaletteIndex.value = index;
  void nextTick(drawPixelBoard);
}

function cancelCanvasPlayback() { stopCanvasPlayback.value = true; }

async function sendPixelCanvas() {
  if (blocked.value || !props.online || (props.sessionOpen && props.sessionMode !== 'canvas')) return;
  const spec = validateFrameSpec({
    mode: 'canvas',
    palette: parsedPalette.value,
    width: frameSpec.value.width,
    height: frameSpec.value.height,
    capabilities: props.capabilities
  });
  if ('error' in spec) { ElMessage.error(spec.error); return; }
  finishPixelStroke();
  const requested = props.deviceId;
  const operation = ++operationEpoch;
  const finalPixels = pixelPixels.value.slice();
  const process = canvasSendMode.value === 'process';
  const changes = drawingStrokes.value.flat();
  const width = frameSpec.value.width;
  const fps = frameSpec.value.maxFps;
  const seconds = playbackSeconds.value;
  const frameBudget = Math.max(1, Math.floor(fps * seconds));
  const updateCount = process ? Math.min(changes.length, frameBudget) : 0;
  const frames = process ? pixelPlaybackFrames(finalPixels.length, changes, frameBudget) : [finalPixels];
  const totalFrames = process ? updateCount + 1 : 1;
  const interval = process && updateCount > 0 ? seconds * 1000 / updateCount : 1000 / fps;
  sendingCanvas.value = true;
  canvasPlaybackActive.value = process;
  canvasPlaybackProgress.value = 0;
  stopCanvasPlayback.value = false;
  emit('busy-change', true);
  const stale = () => props.deviceId !== requested || operation !== operationEpoch;
  try {
    // 每次推送都开启新会话；本地标志无法证明设备旧会话仍然存活。
    const opened = dataOf(await publishDebugView(requested, { mode: 'canvas', width, height: width, palette: spec.palette, maxFps: fps })) as { ok?: boolean; error?: string } | undefined;
    if (stale()) return;
    if (!opened?.ok) throw new Error(opened?.error || '无法打开 Canvas 会话');
    emit('session-opened');
    let sent = 0;
    let lastSendAt = 0;
    for (const indexes of frames) {
      if (stopCanvasPlayback.value) break;
      if (sent > 0) { const remaining = interval - (performance.now() - lastSendAt); if (remaining > 0) await delay(remaining); }
      if (stale()) return;
      if (stopCanvasPlayback.value) break;
      const frame = packPixelIndexes(indexes, spec.bits);
      lastSendAt = performance.now();
      const result = await sendDebugViewFrame(requested, frame) as { ok?: boolean; error?: string } | undefined;
      if (stale()) return;
      if (!result?.ok) throw new Error(result?.error || 'Canvas 帧提交失败');
      sent++;
      emit('frame-sent');
      canvasPlaybackProgress.value = Math.round(sent / totalFrames * 100);
    }
    if (sent > 0) await delay(1000 / fps + 60);
    if (stale()) return;
    ElMessage.success(stopCanvasPlayback.value ? `绘制过程已停止，已发送 ${sent} 帧` : canvasSendMode.value === 'final' ? '最终画面已发送' : `绘制过程已发送 ${sent} 帧`);
  } catch (cause: unknown) {
    if (!stale()) {
      emit('session-closed');
      const message = cause instanceof Error ? cause.message : String(cause ?? '');
      ElMessage.error(message || 'Canvas 发送失败');
    }
  } finally {
    if (operation === operationEpoch) {
      sendingCanvas.value = false;
      canvasPlaybackActive.value = false;
      stopCanvasPlayback.value = false;
      emit('busy-change', false);
    }
  }
}

watch(() => frameSpec.value.width, resetPixelBoard);
watch(paletteText, () => void nextTick(drawPixelBoard));
// 恢复服务端活动 Canvas 会话：对齐分辨率、帧率与调色板后重置画板。
watch(() => props.sessionSpec, spec => {
  if (!spec) return;
  frameSpec.value = { width: spec.width, height: spec.height, maxFps: spec.maxFps };
  if ([2, 4, 16].includes(spec.paletteSize)) paletteColorCount.value = spec.paletteSize;
  resetPixelBoard();
}, { immediate: true });
// 切换终端使所有在途发送失效，并复位播放进度（避免卡在发送中的 UI 状态）。
watch(() => props.deviceId, () => {
  operationEpoch++;
  stopCanvasPlayback.value = true;
  sendingCanvas.value = false;
  canvasPlaybackActive.value = false;
  canvasPlaybackProgress.value = 0;
  emit('busy-change', false);
}, { flush: 'sync' });

onMounted(resetPixelBoard);
onBeforeUnmount(() => {
  operationEpoch++;
  stopCanvasPlayback.value = true;
});
</script>
<style scoped lang="scss">
.frame-debug-card { container-type: inline-size; container-name: frame; }
.frame-debug-card :deep(.el-form-item) { margin-bottom: 12px; }
.frame-debug-card :deep(.el-form-item__label) { font-size: 12px; padding-bottom: 4px; }
.frame-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.frame-actions :deep(.el-button + .el-button) { margin-left: 0; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0; }
.canvas-debug-card { width: 100%; min-height: 0; }
.canvas-resolution { color: #667085; font-size: 12px; font-weight: 400; }
.frame-state-warning { margin-bottom: 12px; }
.canvas-editor-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; align-items: start; }
.canvas-settings { display: grid; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; padding-left: 20px; border-left: 1px solid #eef0f3; align-content: start; }
.canvas-settings-heading { grid-column: 1 / -1; margin: 0; font-size: 13px; font-weight: 600; line-height: 22px; }
.canvas-transfer-heading { margin-top: 4px; padding-top: 14px; border-top: 1px solid #eef0f3; }
.canvas-meta { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 10px 12px; border-radius: 8px; background: #f7f8fa; }
.canvas-meta > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
.canvas-meta dt { color: #667085; font-size: 12px; white-space: nowrap; }
.canvas-meta dd { margin: 0; color: #1d2939; font-size: 12px; font-weight: 600; white-space: nowrap; }
.canvas-settings .palette-colors { flex-wrap: nowrap; gap: 6px; margin: 0; overflow-x: auto; display: flex; align-items: center; }
.palette-swatch { width: 22px; height: 22px; padding: 0; border: 2px solid #d0d5dd; border-radius: 3px; cursor: pointer; flex-shrink: 0; }
.palette-swatch.selected { outline: 2px solid #409eff; outline-offset: 2px; }
.palette-swatch:focus-visible { outline: 2px solid #1677ff; outline-offset: 2px; }
.canvas-settings .el-input-number { width: 100%; max-width: none; }
.canvas-settings .el-select { width: 100%; min-width: 0; max-width: none; }
.canvas-settings .dimensions { display: block; grid-column: 1 / -1; }
.canvas-settings :deep(.el-form-item) { min-width: 0; margin-bottom: 0; }
.canvas-settings :deep(.el-form-item__label) { padding-bottom: 4px; line-height: 20px; }
.canvas-settings :deep(.el-radio-group) { display: flex; flex-wrap: wrap; }
.canvas-settings :deep(.el-radio-button__inner) { padding: 8px 10px; }
.canvas-settings .canvas-palette-control,
.canvas-settings .canvas-send-control,
.canvas-settings .frame-actions,
.canvas-settings > :deep(.el-progress) { grid-column: 1 / -1; }
.canvas-settings .frame-actions { margin-top: 2px; }
.canvas-settings .canvas-background-control,
.canvas-settings .canvas-brush-control,
.canvas-settings .canvas-duration-control,
.canvas-settings .canvas-fps-control { grid-column: span 1; }
.canvas-settings .canvas-background-control :deep(.el-color-picker),
.canvas-settings .canvas-background-control :deep(.el-color-picker__trigger) { width: 100%; }
.pixel-editor { width: min(100%, 520px); min-width: 0; margin: 0 auto; }
.pixel-toolbar { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 10px; }
.pixel-grid-layout { display: grid; grid-template-columns: 22px minmax(0, 1fr); grid-template-rows: 16px auto; width: 100%; padding: 0 6px 6px 0; box-sizing: border-box; }
.pixel-ruler-top, .pixel-ruler-left { position: relative; color: #667085; font: 10px/1 sans-serif; }
.pixel-ruler-top { grid-row: 1; grid-column: 2; }
.pixel-ruler-top span { position: absolute; bottom: 3px; transform: translateX(-50%); }
.pixel-ruler-left { grid-row: 2; grid-column: 1; }
.pixel-ruler-left span { position: absolute; right: 6px; transform: translateY(-50%); }
.pixel-board-wrap { grid-row: 2; grid-column: 2; position: relative; width: 100%; aspect-ratio: 1; border: 1px solid #667085; overflow: hidden; touch-action: none; background: #000; }
.pixel-board { display: block; width: 100%; height: 100%; image-rendering: pixelated; touch-action: none; background: transparent; }
.pixel-grid-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.pixel-grid-overlay path { fill: none; stroke: #475467; stroke-width: 0.16; vector-effect: non-scaling-stroke; opacity: 0.28; }
@container frame (max-width: 700px) {
  .canvas-editor-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .canvas-settings { padding: 16px 0 0; border-left: 0; border-top: 1px solid #eef0f3; }
  .canvas-transfer-heading { margin-top: 0; }
}
@container frame (min-width: 780px) {
  .canvas-editor-layout { grid-template-columns: minmax(0, 1fr) 240px; }
  .canvas-settings { grid-template-columns: minmax(0, 1fr); }
}
@container frame (max-width: 460px) {
  .canvas-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .canvas-settings .canvas-palette-control,
  .canvas-settings .canvas-send-control,
  .canvas-settings .frame-actions { grid-column: 1 / -1; }
}
@container frame (max-width: 340px) {
  .canvas-settings { grid-template-columns: minmax(0, 1fr); }
}
</style>

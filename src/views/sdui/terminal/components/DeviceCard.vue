<template>
  <div class="terminal-card" @click="emit('click', device)">
    <!-- ═══ Screen Preview ═══ -->
    <div class="screen-area">
      <div
        class="screen-preview screen-rect"
      >
        <div class="screen-inner">
          <div class="screen-status-dot" :class="device.status === 'ONLINE' ? 'online' : 'offline'" />
          <div class="screen-device-name">{{ device.name || device.deviceId }}</div>
          <div class="screen-metric-row">
            <span class="screen-metric">{{ fmtBytes(mem?.freeHeapTotal) }}</span>
            <span class="screen-metric-sep">|</span>
            <span class="screen-metric">{{ uptimeText }}</span>
          </div>
        </div>
      </div>
      <!-- Status badge overlaid -->
      <div class="screen-status-tag">
        <el-tag
          :type="device.status === 'ONLINE' ? 'success' : 'info'"
          effect="dark"
          round
          size="small"
        >
          {{ device.status === 'ONLINE' ? '在线' : '离线' }}
        </el-tag>
      </div>
    </div>

    <!-- ═══ Device Info ═══ -->
    <div class="info-row">
      <div class="device-id-mono">{{ device.deviceId }}</div>
      <div class="device-meta">
        <el-tag size="small" :type="capabilitySyncTagType(device.capabilitySyncState)">
          {{ capabilitySyncLabel(device.capabilitySyncState, device.status) }}
        </el-tag>
        <span class="meta-dot">·</span>
        <span>连接 {{ device.connectionCount ?? '-' }}</span>
      </div>
    </div>

    <!-- ═══ Available Memory ═══ -->
    <div class="memory-section">
      <div class="memory-header">
        <span class="memory-label">总可用内存</span>
        <span class="memory-value">{{ fmtBytes(mem?.freeHeapTotal) }}</span>
      </div>
      <div v-for="pool in memoryPools" :key="pool.label" class="memory-pool">
        <div class="memory-detail">
          <span class="memory-label">{{ pool.label }}可用</span>
          <span class="memory-value">{{ fmtBytes(pool.free) }}</span>
          <span v-if="pool.frag != null" class="memory-frag" :class="fragLevel(pool.frag)">
            碎片 {{ pool.frag }}%
          </span>
        </div>
        <div
          v-if="pool.frag != null"
          class="water-bar-track"
          role="progressbar"
          :aria-label="`${pool.label}碎片率`"
          :aria-valuenow="pool.frag"
          :aria-valuetext="`碎片率 ${pool.frag}%`"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :title="`${pool.label}碎片率 ${pool.frag}%`"
        >
          <div
            class="water-bar-fill"
            :class="fragLevel(pool.frag)"
            :style="{ width: Math.min(Math.max(pool.frag, 0), 100) + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- ═══ Status Strip: Battery / WiFi / Temp ═══ -->
    <div class="status-strip">
      <!-- Battery -->
      <div class="status-item">
        <div class="battery-icon" :class="batteryIconClass" :title="batteryTooltip">
          <div class="battery-cap" />
          <div class="battery-body">
            <div class="battery-fill" :style="{ width: (device.lastTelemetry?.power?.batteryPct ?? 0) + '%' }" />
          </div>
        </div>
        <div class="status-text">
          <strong>{{ batteryText }}</strong>
          <small v-if="device.lastTelemetry?.power?.charging">充电中</small>
          <small v-else-if="device.lastTelemetry?.power?.extPowerPresent">外部供电</small>
          <small v-else>电池</small>
        </div>
      </div>

      <!-- WiFi -->
      <div class="status-item">
        <div class="wifi-bars" :title="`RSSI: ${wifiRssiText}`">
          <span v-for="i in 4" :key="i" class="wifi-bar" :class="{ active: i <= wifiBarCount }" :style="{ height: (i * 25) + '%' }" />
        </div>
        <div class="status-text">
          <strong>{{ wifiRssiText }}</strong>
          <small>{{ device.lastTelemetry?.wifi?.ip || '-' }}</small>
        </div>
      </div>

      <!-- Temperature -->
      <div class="status-item">
        <div class="temp-display" :class="tempLevel">
          <span class="temp-value">{{ tempText }}</span>
        </div>
        <div class="status-text">
          <strong>{{ tempLevelLabel }}</strong>
          <small>温度</small>
        </div>
      </div>
    </div>

    <!-- ═══ Bottom ═══ -->
    <div class="card-footer">
      <div class="last-seen">
        <span>上次在线</span>
        <strong>{{ formatTime(device.lastSeenAt) }}</strong>
      </div>
      <div class="card-actions">
        <el-button link type="primary" size="small" @click.stop="emit('click', device)">详情</el-button>
        <el-button link type="danger" size="small" @click.stop="emit('delete', device)">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SduiDevice } from '@/types/sdui-dashboard';

const props = defineProps<{ device: SduiDevice }>();

const emit = defineEmits<{
  click: [device: SduiDevice]
  delete: [device: SduiDevice]
}>();

// ── Helpers ─────────────────────────────────────────────
function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatTime(val: string | null | undefined): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}

function capabilitySyncTagType(state: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' {
  if (state === 'READY') return 'success';
  if (state === 'FAILED') return 'danger';
  if (state === 'SCHEMA_PENDING' || state === 'READY_SENT') return 'warning';
  return 'info';
}

function capabilitySyncLabel(state: string | null | undefined, status: string): string {
  const labels: Record<string, string> = {
    HELLO_PENDING: status === 'ONLINE' ? '等待能力握手' : '离线 · 等待握手',
    SCHEMA_PENDING: '能力同步中',
    READY_SENT: '等待终端确认',
    READY: '能力已就绪',
    FAILED: '能力同步失败'
  };
  return state ? labels[state] || `能力状态：${state}` : '尚无能力状态';
}

// ── Memory ──────────────────────────────────────────────
const mem = computed(() => props.device.lastTelemetry?.memory);
const memoryPools = computed(() => [
  { label: '内部内存', free: mem.value?.freeHeapInternal, frag: mem.value?.fragInternalPct },
  { label: 'PSRAM', free: mem.value?.freeHeapPsram, frag: mem.value?.fragPsramPct },
  { label: 'DMA 内存', free: mem.value?.freeHeapDma, frag: mem.value?.fragDmaPct }
].filter((pool) => pool.label === '内部内存' || pool.free != null || pool.frag != null));

function fragLevel(pct: number): string {
  if (pct >= 60) return 'critical';
  if (pct >= 30) return 'warn';
  return 'good';
}

const uptimeText = computed(() => fmtDuration(props.device.lastTelemetry?.uptimeS ?? null));

// ── Battery ─────────────────────────────────────────────
const batteryText = computed(() => {
  const pct = props.device.lastTelemetry?.power?.batteryPct;
  return pct != null ? `${pct}%` : '-';
});

const batteryTooltip = computed(() => {
  const p = props.device.lastTelemetry?.power;
  if (!p) return '无数据';
  const parts: string[] = [];
  if (p.batteryMv != null) parts.push(`${p.batteryMv} mV`);
  if (p.charging) parts.push('充电中');
  if (p.extPowerPresent) parts.push('外部供电');
  return parts.length ? parts.join(' · ') : '电池';
});

const batteryIconClass = computed(() => {
  const pct = props.device.lastTelemetry?.power?.batteryPct ?? 0;
  if (props.device.lastTelemetry?.power?.charging) return 'charging';
  if (pct <= 15) return 'low';
  if (pct <= 30) return 'mid';
  return 'high';
});

// ── WiFi ────────────────────────────────────────────────
const wifiRssiText = computed(() => {
  const rssi = props.device.lastTelemetry?.wifi?.rssi;
  return rssi != null ? `${rssi} dBm` : '-';
});

const wifiBarCount = computed(() => {
  const rssi = props.device.lastTelemetry?.wifi?.rssi;
  if (rssi == null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -80) return 2;
  return 1;
});

// ── Temperature ─────────────────────────────────────────
const tempText = computed(() => {
  const c = props.device.lastTelemetry?.temperature?.celsius;
  return c != null ? `${c.toFixed(1)}°C` : '-';
});

const tempLevel = computed(() => {
  const c = props.device.lastTelemetry?.temperature?.celsius;
  if (c == null) return '';
  if (c >= 50) return 'hot';
  if (c >= 35) return 'warm';
  return 'cool';
});

const tempLevelLabel = computed(() => {
  const c = props.device.lastTelemetry?.temperature?.celsius;
  if (c == null) return '-';
  if (c >= 50) return '偏高';
  if (c >= 35) return '正常';
  return '良好';
});
</script>

<style scoped>
/* ═══ Card Shell ═══ */
.terminal-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #fafbfd 100%);
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}
.terminal-card:hover {
  transform: translateY(-3px);
  border-color: #93c5fd;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
}

/* ═══ Screen Preview ═══ */
.screen-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.screen-preview {
  position: relative;
  overflow: hidden;
}
.screen-round {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #1e293b, #0f172a);
  border: 4px solid #334155;
  box-shadow:
    inset 0 0 30px rgba(59, 130, 246, 0.15),
    0 0 0 6px #1e293b,
    0 0 0 10px #475569,
    0 4px 20px rgba(0, 0, 0, 0.3);
}
.screen-rect {
  width: 200px;
  height: 130px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border: 3px solid #334155;
  box-shadow:
    inset 0 0 20px rgba(59, 130, 246, 0.1),
    0 0 0 5px #1e293b,
    0 4px 16px rgba(0, 0, 0, 0.25);
}

.screen-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  color: #e2e8f0;
  text-align: center;
  gap: 6px;
}
.screen-round .screen-inner {
  padding: 24px 28px;
}

.screen-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-bottom: 4px;
  animation: pulse-dot 2s infinite;
}
.screen-status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}
.screen-status-dot.offline {
  background: #6b7280;
  animation: none;
}

.screen-device-name {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.screen-metric-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
}
.screen-metric {
  color: #94a3b8;
  font-family: Menlo, Monaco, Consolas, monospace;
}
.screen-metric-sep {
  color: #475569;
}

/* Status tag overlay */
.screen-status-tag {
  position: absolute;
  bottom: -4px;
}
.screen-round ~ .screen-status-tag {
  bottom: -4px;
}
.screen-rect ~ .screen-status-tag {
  bottom: -4px;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ═══ Info Row ═══ */
.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 6px;
}
.device-id-mono {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #64748b;
}
.device-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #6b7280;
}
.meta-dot {
  color: #cbd5e1;
}

/* ═══ Available Memory ═══ */
.memory-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.memory-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.memory-label {
  font-size: 12px;
  color: #64748b;
}
.memory-value {
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}
.memory-frag {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.memory-frag.good {
  background: #f0fdf4;
  color: #15803d;
}
.memory-frag.warn {
  background: #fefce8;
  color: #a16207;
}
.memory-frag.critical {
  background: #fef2f2;
  color: #b91c1c;
}

.memory-pool {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.memory-detail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.water-bar-track {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: #e2e8f0;
}
.water-bar-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.5s ease;
}
.water-bar-fill.good { background: linear-gradient(90deg, #86efac, #22c55e); }
.water-bar-fill.warn { background: linear-gradient(90deg, #fde047, #eab308); }
.water-bar-fill.critical { background: linear-gradient(90deg, #fca5a5, #ef4444); }

/* ═══ Status Strip ═══ */
.status-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.status-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.status-text strong {
  font-size: 13px;
  color: #111827;
}
.status-text small {
  font-size: 10px;
  color: #94a3b8;
}

/* ── Battery Icon ── */
.battery-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.battery-cap {
  width: 3px;
  height: 10px;
  border-radius: 0 2px 2px 0;
  background: #334155;
}
.battery-body {
  width: 24px;
  height: 14px;
  border-radius: 3px;
  border: 2px solid #334155;
  padding: 2px;
  position: relative;
}
.battery-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.4s;
  background: #22c55e;
}
.battery-icon.low .battery-fill { background: #ef4444; }
.battery-icon.mid .battery-fill { background: #f59e0b; }
.battery-icon.charging .battery-fill { background: #3b82f6; animation: charge-pulse 1.5s infinite; }

@keyframes charge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── WiFi Bars ── */
.wifi-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 22px;
  width: 22px;
  flex-shrink: 0;
}
.wifi-bar {
  width: 4px;
  border-radius: 999px;
  background: #d1d5db;
  transition: background 0.3s;
}
.wifi-bar.active {
  background: #3b82f6;
  box-shadow: 0 0 4px rgba(59, 130, 246, 0.4);
}

/* ── Temperature ── */
.temp-display {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.temp-display.cool {
  background: #f0fdf4;
  border: 2px solid #86efac;
}
.temp-display.warm {
  background: #fefce8;
  border: 2px solid #fde047;
}
.temp-display.hot {
  background: #fef2f2;
  border: 2px solid #fca5a5;
}
.temp-value {
  font-size: 11px;
  font-weight: 800;
  font-family: Menlo, Monaco, Consolas, monospace;
}
.temp-display.cool .temp-value { color: #15803d; }
.temp-display.warm .temp-value { color: #a16207; }
.temp-display.hot .temp-value { color: #b91c1c; }

/* ═══ Footer ═══ */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}
.last-seen {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 12px;
  color: #6b7280;
}
.last-seen strong {
  font-size: 12px;
  color: #111827;
}
.card-actions {
  display: flex;
  gap: 4px;
}

/* ═══ Responsive ═══ */
@media (max-width: 400px) {
  .status-strip {
    grid-template-columns: 1fr;
  }
}
</style>

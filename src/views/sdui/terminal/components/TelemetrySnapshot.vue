<template>
  <el-card shadow="never" class="snapshot-panel">
    <template #header><span>实时状态</span></template>

    <div class="snapshot-grid">
      <!-- WiFi -->
      <div class="snap-item">
        <div class="snap-icon wifi">
          <div class="icon-wifi-bars">
            <span v-for="i in 4" :key="i" class="mini-bar" :class="{ active: i <= wifiBars }" :style="{ height: (i * 5 + 4) + 'px' }" />
          </div>
        </div>
        <div class="snap-body">
          <span class="snap-label">WiFi 信号</span>
          <strong>{{ wifiRssi }}</strong>
          <small>{{ t?.wifi?.ip || '-' }}</small>
        </div>
      </div>

      <!-- Battery -->
      <div class="snap-item">
        <div class="snap-icon battery" :class="{ charging: isCharging, low: batteryLow }">
          <span class="icon-char">{{ isCharging ? '⚡' : '🔋' }}</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">电量</span>
          <strong>{{ batteryText }}</strong>
          <small>{{ powerDetail }}</small>
        </div>
      </div>

      <!-- Temperature -->
      <div class="snap-item">
        <div class="snap-icon temp" :class="tempLevel">
          <span class="icon-char">🌡</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">温度</span>
          <strong>{{ tempText }}</strong>
          <small>{{ tempLabel }}</small>
        </div>
      </div>

      <!-- Memory Internal -->
      <div class="snap-item">
        <div class="snap-icon memory">
          <span class="icon-char">🧠</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">内部内存</span>
          <strong>{{ fmtBytes(t?.memory?.freeHeapInternal) }}</strong>
          <small>碎片 {{ t?.memory?.fragInternalPct ?? '-' }}%</small>
        </div>
      </div>

      <!-- Memory PSRAM -->
      <div class="snap-item" v-if="psramVisible">
        <div class="snap-icon psram">
          <span class="icon-char">💾</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">PSRAM</span>
          <strong>{{ fmtBytes(t?.memory?.freeHeapPsram) }}</strong>
          <small>碎片 {{ t?.memory?.fragPsramPct ?? '-' }}%</small>
        </div>
      </div>

      <!-- Memory DMA -->
      <div class="snap-item" v-if="dmaVisible">
        <div class="snap-icon dma">
          <span class="icon-char">📦</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">DMA 内存</span>
          <strong>{{ fmtBytes(t?.memory?.freeHeapDma) }}</strong>
          <small>碎片 {{ t?.memory?.fragDmaPct ?? '-' }}%</small>
        </div>
      </div>

      <!-- Uptime -->
      <div class="snap-item">
        <div class="snap-icon uptime">
          <span class="icon-char">⏱</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">运行时长</span>
          <strong>{{ uptimeText }}</strong>
          <small>总 {{ totalUptimeText }}</small>
        </div>
      </div>

      <!-- Heartbeat -->
      <div class="snap-item">
        <div class="snap-icon heartbeat">
          <span class="icon-char">💓</span>
        </div>
        <div class="snap-body">
          <span class="snap-label">最后心跳</span>
          <strong>{{ heartbeatText }}</strong>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  telemetry: TelemetrySnapshot | null | undefined
  totalUptimeS: number | null | undefined
}>();

const t = computed(() => props.telemetry || null);

// ── Helpers ───────────────────────────────────────────
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

function fmtTime(val: string | null | undefined): string {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { hour12: false });
}

// ── WiFi ──────────────────────────────────────────────
const wifiRssi = computed(() => {
  const v = t.value?.wifi?.rssi;
  return v != null ? `${v} dBm` : '-';
});
const wifiBars = computed(() => {
  const rssi = t.value?.wifi?.rssi;
  if (rssi == null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -80) return 2;
  return 1;
});

// ── Battery ───────────────────────────────────────────
const batteryText = computed(() => {
  const pct = t.value?.power?.batteryPct;
  return pct != null ? `${pct}%` : '-';
});
const isCharging = computed(() => t.value?.power?.charging ?? false);
const batteryLow = computed(() => (t.value?.power?.batteryPct ?? 100) <= 15);
const powerDetail = computed(() => {
  const p = t.value?.power;
  if (!p) return '-';
  const parts: string[] = [];
  if (p.batteryMv != null) parts.push(`${p.batteryMv} mV`);
  if (p.charging) parts.push('充电中');
  else if (p.extPowerPresent) parts.push('外部供电');
  return parts.length ? parts.join(' · ') : '-';
});

// ── Temperature ───────────────────────────────────────
const tempText = computed(() => {
  const c = t.value?.temperature?.celsius;
  return c != null ? `${c.toFixed(1)}°C` : '-';
});
const tempLevel = computed(() => {
  const c = t.value?.temperature?.celsius;
  if (c == null) return '';
  if (c >= 50) return 'hot';
  if (c >= 35) return 'warm';
  return 'cool';
});
const tempLabel = computed(() => {
  const c = t.value?.temperature?.celsius;
  if (c == null) return '-';
  if (c >= 50) return '偏高⚠';
  if (c >= 35) return '正常';
  return '良好';
});

// ── Memory visibility ─────────────────────────────────
const psramVisible = computed(() => {
  const v = t.value?.memory?.freeHeapPsram;
  return v != null && v > 0;
});
const dmaVisible = computed(() => {
  const v = t.value?.memory?.freeHeapDma;
  return v != null && v > 0;
});

// ── Uptime ────────────────────────────────────────────
const uptimeText = computed(() => fmtDuration(t.value?.uptimeS ?? null));
const totalUptimeText = computed(() => fmtDuration(props.totalUptimeS ?? null));
const heartbeatText = computed(() => fmtTime(t.value?.lastHeartbeatAt ?? null));
</script>

<style scoped>
.snapshot-panel {
  margin-bottom: 0;
}
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
}
.snap-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.snap-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.snap-icon.wifi { background: #eff6ff; }
.snap-icon.battery { background: #fefce8; }
.snap-icon.battery.charging { background: #f0fdf4; }
.snap-icon.battery.low { background: #fef2f2; }
.snap-icon.temp.cool { background: #f0fdf4; }
.snap-icon.temp.warm { background: #fefce8; }
.snap-icon.temp.hot { background: #fef2f2; }
.snap-icon.memory { background: #f5f3ff; }
.snap-icon.psram { background: #ecfeff; }
.snap-icon.dma { background: #fff7ed; }
.snap-icon.uptime { background: #ecfeff; }
.snap-icon.heartbeat { background: #fdf2f8; }

.icon-char { font-size: 18px; }

/* Mini WiFi bars in snapshot */
.icon-wifi-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
}
.mini-bar {
  width: 3px;
  border-radius: 999px;
  background: #d1d5db;
}
.mini-bar.active {
  background: #2563eb;
}

.snap-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.snap-label {
  font-size: 11px;
  color: #94a3b8;
}
.snap-body strong {
  font-size: 14px;
  color: #111827;
}
.snap-body small {
  font-size: 11px;
  color: #94a3b8;
}
</style>

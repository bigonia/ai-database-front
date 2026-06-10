<template>
  <el-card shadow="never" class="trends-panel">
    <template #header>
      <div class="trends-header">
        <span>遥测趋势</span>
        <div class="trends-controls">
          <el-select
            :model-value="metrics"
            size="small"
            style="width: 110px"
            @change="emit('update:metrics', $event)"
          >
            <el-option label="全部" value="all" />
            <el-option label="内存" value="memory" />
            <el-option label="温度" value="temperature" />
            <el-option label="WiFi" value="wifi" />
            <el-option label="电量" value="battery" />
          </el-select>
          <el-radio-group
            :model-value="range"
            size="small"
            @change="emit('update:range', $event)"
          >
            <el-radio-button value="1h">1h</el-radio-button>
            <el-radio-button value="6h">6h</el-radio-button>
            <el-radio-button value="24h">24h</el-radio-button>
            <el-radio-button value="7d">7d</el-radio-button>
            <el-radio-button value="30d">30d</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="cards-area">
      <div v-if="visibleCards.length" class="trend-grid">
        <section
          v-for="card in visibleCards"
          :key="card.key"
          class="trend-card"
          :style="{
            '--card-color': card.color,
            '--card-color-soft': `${card.color}22`,
            '--card-color-mid': `${card.color}55`,
          }"
        >
          <div class="trend-card-head">
            <div>
              <div class="trend-card-title">{{ card.title }}</div>
              <div class="trend-card-subtitle">{{ card.subtitle }}</div>
            </div>
            <div class="trend-card-chip">
              <span class="chip-dot" />
              {{ card.unitLabel }}
            </div>
          </div>

          <div class="trend-card-topline">
            <div class="trend-card-value">
              {{ formatValue(card.latestValue, card.formatter) }}
            </div>
            <div class="trend-card-delta" :class="deltaClass(card.delta)">
              {{ formatDelta(card.delta, card.formatter) }}
            </div>
          </div>

          <div class="trend-card-chart">
            <svg
              v-if="card.path"
              viewBox="0 0 240 88"
              preserveAspectRatio="none"
              class="sparkline"
            >
              <path :d="card.baselinePath" class="sparkline-baseline" />
              <defs>
                <linearGradient :id="`fill-${card.key}`" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" :stop-color="card.color" stop-opacity="0.35" />
                  <stop offset="100%" :stop-color="card.color" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path :d="card.areaPath" :fill="`url(#fill-${card.key})`" />
              <path :d="card.path" fill="none" :stroke="card.color" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <circle
                v-if="card.lastPoint"
                :cx="card.lastPoint.x"
                :cy="card.lastPoint.y"
                r="4"
                :fill="card.color"
                class="spark-dot"
              />
            </svg>
            <div v-else class="sparkline-empty">暂无折线</div>
          </div>

          <div class="trend-stats">
            <div class="stat-item">
              <span class="stat-label">最小</span>
              <strong>{{ formatValue(card.minValue, card.formatter) }}</strong>
            </div>
            <div class="stat-item">
              <span class="stat-label">最大</span>
              <strong>{{ formatValue(card.maxValue, card.formatter) }}</strong>
            </div>
            <div class="stat-item">
              <span class="stat-label">采样</span>
              <strong>{{ card.sampleLabel }}</strong>
            </div>
          </div>
        </section>
      </div>
      <el-empty v-else description="暂无趋势数据" :image-size="48" />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Point2D = { x: number; y: number };

type TrendCard = {
  key: string
  title: string
  subtitle: string
  unitLabel: string
  color: string
  rows: TrendPoint[]
  formatter: (value: number) => string
  latestValue: number | undefined
  minValue: number | undefined
  maxValue: number | undefined
  delta: number | undefined
  sampleLabel: string
  path: string
  areaPath: string
  baselinePath: string
  lastPoint: Point2D | null
};

const props = defineProps<{
  trendData: TrendSeries | null
  range: string
  metrics: string
  loading: boolean
}>();

const emit = defineEmits<{
  'update:range': [value: string]
  'update:metrics': [value: string]
}>();

function getWifiSeries() {
  return props.trendData?.series?.wifi?.rssi || [];
}

function getTempSeries() {
  return props.trendData?.series?.temperature?.celsius || [];
}

function getBatterySeries() {
  return props.trendData?.series?.power?.batteryPct || props.trendData?.series?.battery?.batteryPct || [];
}

function getMemorySeries() {
  return props.trendData?.series?.memory?.freeHeapTotal || [];
}

function fmtPlain(value: number) {
  return `${value.toFixed(1)}`;
}

function fmtPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function fmtBytes(value: number) {
  if (value >= 1048576) return `${(value / 1048576).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value.toFixed(0)} B`;
}

function buildSparkline(rows: TrendPoint[]) {
  const values = rows
    .map((item) => item.avg)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

  if (!values.length) {
    return {
      path: '',
      areaPath: '',
      baselinePath: '',
      lastPoint: null as Point2D | null
    };
  }

  const width = 240;
  const height = 88;
  const paddingX = 8;
  const paddingY = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(values.length - 1, 1);
    const y = height - paddingY - ((value - min) / range) * (height - paddingY * 2);
    return { x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
  const baselineY = height - paddingY - (height - paddingY * 2) / 2;
  const baselinePath = `M ${paddingX} ${baselineY} L ${width - paddingX} ${baselineY}`;

  return {
    path,
    areaPath,
    baselinePath,
    lastPoint: points[points.length - 1]
  };
}

function buildCard(
  key: string,
  title: string,
  unitLabel: string,
  color: string,
  rows: TrendPoint[],
  formatter: (value: number) => string
): TrendCard {
  const recentRows = rows.slice(-12);
  const values = recentRows
    .map((item) => item.avg)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  const sparkline = buildSparkline(recentRows);

  return {
    key,
    title,
    subtitle: buildSubtitle(recentRows),
    unitLabel,
    color,
    rows: recentRows,
    formatter,
    latestValue: values.at(-1),
    minValue: values.length ? Math.min(...values) : undefined,
    maxValue: values.length ? Math.max(...values) : undefined,
    delta: values.length >= 2 ? values[values.length - 1] - values[values.length - 2] : undefined,
    sampleLabel: `${recentRows.length} 条`,
    path: sparkline.path,
    areaPath: sparkline.areaPath,
    baselinePath: sparkline.baselinePath,
    lastPoint: sparkline.lastPoint
  };
}

const allCards = computed<TrendCard[]>(() => [
  buildCard('wifi', 'WiFi RSSI', 'dBm', '#2563eb', getWifiSeries(), fmtPlain),
  buildCard('temperature', '温度', '°C', '#ef4444', getTempSeries(), fmtPlain),
  buildCard('battery', '电量', '%', '#16a34a', getBatterySeries(), fmtPercent),
  buildCard('memory', '可用内存', 'bytes', '#7c3aed', getMemorySeries(), fmtBytes)
]);

const visibleCards = computed(() => {
  const filtered = props.metrics === 'all'
    ? allCards.value
    : allCards.value.filter((item) => item.key === props.metrics);
  return filtered.filter((item) => item.rows.length > 0);
});

function formatValue(value: number | undefined, formatter: (value: number) => string) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return formatter(value);
}

function formatDelta(value: number | undefined, formatter: (value: number) => string) {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return '持平';
  return `${value > 0 ? '+' : ''}${formatter(value)}`;
}

function deltaClass(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return 'is-flat';
  return value > 0 ? 'is-up' : 'is-down';
}

function buildSubtitle(rows: TrendPoint[]) {
  if (!rows.length) return '暂无数据';
  const first = rows[0]?.ts;
  const last = rows[rows.length - 1]?.ts;
  return `${formatShortTime(first)} - ${formatShortTime(last)}`;
}

function formatShortTime(val: string | undefined) {
  if (!val) return '--';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.trends-panel {
  margin: 0;
}

.trends-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.trends-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cards-area {
  min-height: 460px;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

.trend-card {
  min-height: 220px;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background:
    radial-gradient(circle at top right, var(--card-color-soft), transparent 42%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
}

.trend-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.trend-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.trend-card-subtitle {
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
}

.trend-card-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #475569;
  border: 1px solid rgba(226, 232, 240, 0.9);
  font-size: 11px;
  font-weight: 600;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--card-color);
  box-shadow: 0 0 0 4px var(--card-color-soft);
}

.trend-card-topline {
  margin-top: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.trend-card-value {
  min-width: 0;
  flex: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.trend-card-delta {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.trend-card-delta.is-up {
  color: #166534;
  background: rgba(34, 197, 94, 0.14);
}

.trend-card-delta.is-down {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.14);
}

.trend-card-delta.is-flat {
  color: #475569;
  background: rgba(148, 163, 184, 0.18);
}

.trend-card-value {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.1;
  font-weight: 700;
  color: #111827;
}

.trend-card-chart {
  margin-top: 12px;
  height: 88px;
  min-height: 88px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.8));
  border: 1px solid rgba(226, 232, 240, 0.8);
  overflow: hidden;
}

.sparkline {
  display: block;
  width: 100%;
  height: 100%;
}

.sparkline-baseline {
  stroke: var(--card-color-mid);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  fill: none;
}

.spark-dot {
  stroke: #fff;
  stroke-width: 2;
}

.sparkline-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #94a3b8;
}

.trend-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  margin-top: auto;
  padding-top: 12px;
}

.stat-item {
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(241, 245, 249, 0.95);
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-item strong {
  display: block;
  font-size: 12px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .cards-area {
    min-height: 0;
  }

  .trend-grid {
    grid-template-columns: 1fr;
  }

  .trend-card {
    min-height: 200px;
  }
}
</style>

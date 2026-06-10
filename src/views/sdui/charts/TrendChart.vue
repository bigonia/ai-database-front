<template>
  <div class="trend-chart">
    <div class="chart-toolbar">
      <el-radio-group v-model="currentRange" size="small" @change="loadData">
        <el-radio-button value="1h">1h</el-radio-button>
        <el-radio-button value="6h">6h</el-radio-button>
        <el-radio-button value="24h">24h</el-radio-button>
        <el-radio-button value="7d">7d</el-radio-button>
        <el-radio-button value="30d">30d</el-radio-button>
      </el-radio-group>
    </div>
    <div ref="chartRef" class="chart-container" v-loading="loading" />
  </div>
</template>

<script>
import * as echarts from 'echarts';
import { getDeviceTelemetryTrends } from '@/api/sdui';

export default {
  name: 'TrendChart',
  props: {
    deviceId: { type: String, required: true },
    metric: { type: String, default: 'memory' }, // memory | temperature | wifi | battery
    defaultRange: { type: String, default: '24h' }
  },
  data() {
    return {
      currentRange: this.defaultRange,
      loading: false,
      chart: null,
      resizeHandler: null
    };
  },
  watch: {
    deviceId() {
      this.loadData();
    },
    metric() {
      this.loadData();
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.chart = echarts.init(this.$refs.chartRef);
      this.resizeHandler = () => this.chart?.resize();
      window.addEventListener('resize', this.resizeHandler);
      this.loadData();
    });
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.resizeHandler);
    this.chart?.dispose();
    this.chart = null;
  },
  methods: {
    async loadData() {
      if (!this.deviceId) return;
      this.loading = true;
      try {
        const res = await getDeviceTelemetryTrends(this.deviceId, {
          range: this.currentRange,
          bucket: 'auto',
          metrics: this.metric
        });
        const data = res?.data;
        if (data?.series) {
          this.renderChart(data);
        }
      } catch {
        // silent
      } finally {
        this.loading = false;
      }
    },

    renderChart(data) {
      const option = this.buildOption(data);
      this.chart?.setOption(option, true);
    },

    buildOption(data) {
      const seriesConfig = this.getMetricConfig();
      const series = [];
      const legendData = [];

      for (const cfg of seriesConfig) {
        const sourceData = this.getNestedValue(data.series, cfg.path);
        if (!sourceData || !sourceData.length) continue;

        legendData.push(cfg.name);
        const serie = {
          name: cfg.name,
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: sourceData.map(p => [p.ts, p.avg]),
          ...cfg.extra
        };
        series.push(serie);
      }

      if (series.length === 0) {
        this.chart?.clear();
        return;
      }

      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const lines = params.map(p => {
              const val = typeof p.value[1] === 'number' ? p.value[1].toFixed(2) : p.value[1];
              return `${p.marker} ${p.seriesName}: <strong>${val} ${p.seriesName.includes('%') ? '%' : ''}</strong>`;
            });
            return lines.join('<br/>');
          }
        },
        legend: { data: legendData, bottom: 0 },
        grid: { left: 60, right: 30, top: 20, bottom: 40 },
        xAxis: { type: 'time', axisLabel: { fontSize: 11 }},
        yAxis: seriesConfig[0]?.yAxis || { type: 'value' },
        series
      };
    },

    getMetricConfig() {
      const configs = {
        memory: [
          { name: '总空闲堆', path: ['memory', 'freeHeapTotal'], yAxis: { type: 'value', name: 'bytes', axisLabel: { formatter: v => this.formatBytesShort(v) }}},
          { name: '内部空闲堆', path: ['memory', 'freeHeapInternal'], yAxis: { type: 'value' }},
          { name: '碎片率(%)', path: ['memory', 'fragInternalPct'], extra: { markLine: { silent: true, data: [{ yAxis: 30, label: { formatter: '安全线' }, lineStyle: { color: '#22c55e', type: 'dashed' }}, { yAxis: 60, label: { formatter: '告警线' }, lineStyle: { color: '#eab308', type: 'dashed' }}] }}}
        ],
        temperature: [
          { name: '芯片温度(°C)', path: ['temperature', 'celsius'], yAxis: { type: 'value', name: '°C' }, extra: { markLine: { silent: true, data: [{ yAxis: 75, label: { formatter: '过热' }, lineStyle: { color: '#ef4444', type: 'dashed' }}] }}}
        ],
        wifi: [
          { name: 'RSSI (dBm)', path: ['wifi', 'rssi'], yAxis: { type: 'value', name: 'dBm' }, extra: { markLine: { silent: true, data: [{ yAxis: -80, label: { formatter: '弱信号' }, lineStyle: { color: '#ef4444', type: 'dashed' }}] }}}
        ],
        battery: [
          { name: '电量(%)', path: ['battery', 'batteryPct'], yAxis: { type: 'value', name: '%', min: 0, max: 100 }, extra: { markLine: { silent: true, data: [{ yAxis: 15, label: { formatter: '低电量' }, lineStyle: { color: '#ef4444', type: 'dashed' }}] }}},
          { name: '电压(mV)', path: ['battery', 'batteryMv'], yAxis: { type: 'value', name: 'mV' }}
        ]
      };
      return configs[this.metric] || configs.memory;
    },

    getNestedValue(obj, path) {
      let current = obj;
      for (const key of path) {
        if (current == null) return null;
        current = current[key];
      }
      return current;
    },

    formatBytesShort(bytes) {
      if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
      if (bytes >= 1024) return (bytes / 1024).toFixed(0) + 'KB';
      return bytes + 'B';
    }
  }
};
</script>

<style scoped>
.trend-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
}

.chart-container {
  width: 100%;
  height: 320px;
}
</style>

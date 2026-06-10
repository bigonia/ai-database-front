import { ref, reactive } from 'vue';
import { getDeviceTelemetry, getDeviceTelemetryTrends } from '@/api/sdui';
import { ElMessage } from 'element-plus';

export function useTelemetry() {
  const telemetryRows = ref<Record<string, unknown>[]>([]);
  const telemetryPagination = reactive({
    page: 0,
    size: 20,
    total: 0,
    totalPages: 0
  });

  const trendData = ref<TrendSeries | null>(null);
  const trendRange = ref('24h');
  const trendMetrics = ref('all');

  const loading = reactive({
    table: false,
    trends: false
  });

  // ── Telemetry history table ────────────────────────────
  async function fetchTelemetryHistory(deviceId: string) {
    loading.table = true;
    try {
      const res = await getDeviceTelemetry(deviceId, {
        page: telemetryPagination.page,
        size: telemetryPagination.size
      });
      const data = res?.data as Record<string, unknown> | undefined;
      telemetryRows.value = (data?.content as Record<string, unknown>[]) || [];
      telemetryPagination.total = (data?.totalElements as number) ?? 0;
      telemetryPagination.totalPages = (data?.totalPages as number) ?? 0;
    } catch {
      telemetryRows.value = [];
      ElMessage.error('加载遥测历史失败');
    } finally {
      loading.table = false;
    }
  }

  // ── Telemetry trends ────────────────────────────────────
  async function fetchTelemetryTrends(deviceId: string) {
    loading.trends = true;
    try {
      const res = await getDeviceTelemetryTrends(deviceId, {
        range: trendRange.value,
        metrics: trendMetrics.value,
        bucket: 'auto'
      });
      trendData.value = (res?.data || null) as TrendSeries | null;
    } catch {
      trendData.value = null;
      ElMessage.error('加载趋势数据失败');
    } finally {
      loading.trends = false;
    }
  }

  function setTrendRange(range: string) {
    trendRange.value = range;
  }

  function setTrendMetrics(metrics: string) {
    trendMetrics.value = metrics;
  }

  function handleTelemetryPage(page: number, size: number) {
    telemetryPagination.page = page;
    telemetryPagination.size = size;
  }

  return {
    telemetryRows,
    telemetryPagination,
    trendData,
    trendRange,
    trendMetrics,
    loading,
    fetchTelemetryHistory,
    fetchTelemetryTrends,
    setTrendRange,
    setTrendMetrics,
    handleTelemetryPage
  };
}

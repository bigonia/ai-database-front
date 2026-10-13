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
  const errors = reactive({
    table: '',
    trends: ''
  });
  let historyRequestId = 0;
  let trendsRequestId = 0;

  function reset() {
    historyRequestId++;
    trendsRequestId++;
    telemetryRows.value = [];
    telemetryPagination.page = 0;
    telemetryPagination.size = 20;
    telemetryPagination.total = 0;
    telemetryPagination.totalPages = 0;
    trendData.value = null;
    loading.table = false;
    loading.trends = false;
    errors.table = '';
    errors.trends = '';
  }

  // ── Telemetry history table ────────────────────────────
  async function fetchTelemetryHistory(deviceId: string) {
    const requestId = ++historyRequestId;
    const page = telemetryPagination.page;
    const size = telemetryPagination.size;
    loading.table = true;
    errors.table = '';
    try {
      const res = await getDeviceTelemetry(deviceId, {
        page,
        size
      });
      const data = res?.data as Record<string, unknown> | undefined;
      if (requestId !== historyRequestId) return;
      if (!isTelemetryPage(data, deviceId, page, size)) throw new Error('遥测历史接口响应格式无效');
      const totalElements = data.totalElements as number;
      const totalPages = data.totalPages as number;
      if (page >= totalPages && page > 0) {
        telemetryPagination.page = Math.max(0, totalPages - 1);
        void fetchTelemetryHistory(deviceId);
        return;
      }
      telemetryRows.value = data.content as Record<string, unknown>[];
      telemetryPagination.total = totalElements;
      telemetryPagination.totalPages = totalPages;
    } catch (cause: any) {
      if (requestId !== historyRequestId) return;
      telemetryRows.value = [];
      errors.table = cause.message || '加载遥测历史失败';
      ElMessage.error(errors.table);
    } finally {
      if (requestId === historyRequestId) loading.table = false;
    }
  }

  // ── Telemetry trends ────────────────────────────────────
  async function fetchTelemetryTrends(deviceId: string) {
    const requestId = ++trendsRequestId;
    const range = trendRange.value;
    const metrics = trendMetrics.value;
    loading.trends = true;
    errors.trends = '';
    try {
      const res = await getDeviceTelemetryTrends(deviceId, {
        range,
        metrics,
        bucket: 'auto'
      });
      if (requestId !== trendsRequestId) return;
      const data = res?.data as unknown;
      if (!isTrendSeries(data, deviceId, range)) throw new Error('遥测趋势接口响应格式无效');
      trendData.value = data;
    } catch (cause: any) {
      if (requestId !== trendsRequestId) return;
      trendData.value = null;
      errors.trends = cause.message || '加载趋势数据失败';
      ElMessage.error(errors.trends);
    } finally {
      if (requestId === trendsRequestId) loading.trends = false;
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
    errors,
    fetchTelemetryHistory,
    fetchTelemetryTrends,
    setTrendRange,
    setTrendMetrics,
    handleTelemetryPage,
    reset
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTelemetryPage(
  value: unknown,
  deviceId: string,
  requestedPage: number,
  requestedSize: number
): value is Record<string, unknown> & { content: unknown[] } {
  if (!isRecord(value) || !Array.isArray(value.content)) return false;
  if (value.page !== requestedPage || value.size !== requestedSize) return false;
  if (!isNonNegativeInteger(value.totalElements) || !isNonNegativeInteger(value.totalPages)) return false;
  if (typeof value.first !== 'boolean' || typeof value.last !== 'boolean' || typeof value.empty !== 'boolean') return false;
  if (value.content.length > requestedSize || value.empty !== (value.content.length === 0)) return false;
  const expectedPages = value.totalElements === 0 ? 0 : Math.ceil(Number(value.totalElements) / requestedSize);
  if (value.totalPages !== expectedPages || value.first !== (requestedPage === 0)
    || value.last !== (expectedPages === 0 || requestedPage >= expectedPages - 1)) return false;
  return value.content.every((row) => {
    if (!isRecord(row) || row.deviceId !== deviceId || !isNonNegativeInteger(row.id) || row.id === 0) return false;
    if (row.ip !== null && typeof row.ip !== 'string') return false;
    if (row.createdAt !== null && typeof row.createdAt !== 'string') return false;
    const numericFields = [
      'wifiRssi', 'temperature', 'freeHeapInternal', 'largestHeapInternal', 'freeHeapDma',
      'largestHeapDma', 'freeHeapPsram', 'largestHeapPsram', 'freeHeapTotal', 'fragInternalPct',
      'fragDmaPct', 'fragPsramPct', 'uptimeS', 'batteryMv', 'batteryPct'
    ];
    if (!numericFields.every((key) => isNullableNumber(row[key]))) return false;
    const booleanFields = ['powerSupported', 'charging', 'extPowerPresent', 'extPowerCtrl', 'extPowerOn'];
    return booleanFields.every((key) => row[key] === null || typeof row[key] === 'boolean');
  });
}

function isTrendSeries(value: unknown, deviceId: string, range: string): value is TrendSeries {
  if (!isRecord(value) || value.deviceId !== deviceId || value.range !== range) return false;
  if (typeof value.bucket !== 'string' || !value.bucket || !isNonNegativeInteger(value.pointCount)) return false;
  if (!isRecord(value.series)) return false;
  return Object.values(value.series).every((metrics) => {
    if (!isRecord(metrics)) return false;
    return Object.values(metrics).every((points) => Array.isArray(points) && points.every((point) => {
      if (!isRecord(point)) return false;
      if (point.ts !== null && typeof point.ts !== 'string') return false;
      if (!isNullableNumber(point.avg)) return false;
      return ['min', 'max'].every((key) => point[key] === undefined || isNullableNumber(point[key]));
    }));
  });
}

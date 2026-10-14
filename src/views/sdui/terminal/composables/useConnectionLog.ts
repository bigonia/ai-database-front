import { ref, reactive } from 'vue';
import { getDeviceConnectionLog } from '@/api/sdui';
import { ElMessage } from 'element-plus';
import type { ConnectionLog } from '@/types/sdui-dashboard';
import { errorDetails } from '@/utils/errorDetails';

export function useConnectionLog() {
  const connectionData = ref<ConnectionLog | null>(null);
  const connectionPagination = reactive({
    page: 0,
    size: 20
  });

  const loading = ref(false);
  const error = ref('');
  let requestId = 0;

  function reset() {
    requestId++;
    connectionData.value = null;
    connectionPagination.page = 0;
    connectionPagination.size = 20;
    loading.value = false;
    error.value = '';
  }

  async function fetchConnectionLog(deviceId: string) {
    const currentRequestId = ++requestId;
    const page = connectionPagination.page;
    const size = connectionPagination.size;
    loading.value = true;
    error.value = '';
    try {
      const res = await getDeviceConnectionLog(deviceId, {
        page,
        size
      });
      if (currentRequestId !== requestId) return;
      const data = res?.data as unknown;
      if (!isConnectionLog(data, deviceId, page, size)) throw new Error('连接日志接口响应格式无效');
      if (data.totalEvents === 0 && page > 0) {
        connectionPagination.page = 0;
        void fetchConnectionLog(deviceId);
        return;
      }
      if (data.totalEvents > 0 && page * size >= data.totalEvents) {
        connectionPagination.page = Math.floor((data.totalEvents - 1) / size);
        void fetchConnectionLog(deviceId);
        return;
      }
      connectionData.value = data;
    } catch (cause: unknown) {
      if (currentRequestId === requestId) {
        connectionData.value = null;
        error.value = errorDetails(cause).message || '加载连接日志失败';
        ElMessage.error(error.value);
      }
    } finally {
      if (currentRequestId === requestId) loading.value = false;
    }
  }

  function handleConnectionPage(page: number, size: number) {
    connectionPagination.page = page;
    connectionPagination.size = size;
  }

  return {
    connectionData,
    connectionPagination,
    loading,
    error,
    fetchConnectionLog,
    handleConnectionPage,
    reset
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isConnectionLog(
  value: unknown,
  deviceId: string,
  requestedPage: number,
  requestedSize: number
): value is ConnectionLog {
  if (!isRecord(value) || value.deviceId !== deviceId || value.page !== requestedPage || value.size !== requestedSize) return false;
  if (!isNonNegativeInteger(value.totalEvents) || !Array.isArray(value.events) || value.events.length > requestedSize) return false;
  if (value.currentSession != null) {
    if (!isRecord(value.currentSession) ||
      !isNullableString(value.currentSession.connectedAt) ||
      !isNullableString(value.currentSession.sessionId) ||
      !(value.currentSession.durationS === null || isNonNegativeInteger(value.currentSession.durationS))) return false;
  }
  if (value.stats != null) {
    if (!isRecord(value.stats) ||
      !isNonNegativeInteger(value.stats.totalConnections) ||
      !isNonNegativeInteger(value.stats.totalDisconnections) ||
      !isRecord(value.stats.disconnectReasons) ||
      !Object.values(value.stats.disconnectReasons).every(isNonNegativeInteger)) return false;
  }
  return value.events.every((event) => isRecord(event) &&
    (event.eventType === 'CONNECTED' || event.eventType === 'DISCONNECTED') &&
    isNullableString(event.sessionId) &&
    isNullableString(event.ipAddress) &&
    isNullableString(event.disconnectReason) &&
    isNullableString(event.eventAt));
}

import { ref, reactive } from 'vue';
import { getDeviceDetail, updateDevice } from '@/api/sdui';
import { ElMessage } from 'element-plus';
import { isTelemetrySnapshot } from '@/sdui/terminalTelemetry';
import type { SduiDeviceDetailResponse } from '@/types/sdui-dashboard';
import { errorDetails } from '@/utils/errorDetails';

export function useDeviceDetail() {
  const detail = ref<SduiDeviceDetailResponse | null>(null);
  const loading = reactive({
    detail: false,
    saving: false
  });
  let detailRequestId = 0;
  let saveRequestId = 0;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNullableString(value: unknown): boolean {
    return value === null || typeof value === 'string';
  }

  function isNullableNumber(value: unknown): boolean {
    return value === null || (typeof value === 'number' && Number.isFinite(value));
  }

  function isSurface(value: unknown): boolean {
    if (value === null) return true;
    if (!isRecord(value)) return false;
    const screenValid = value.screen === null || (isRecord(value.screen) &&
      Number.isInteger(value.screen.width) && Number(value.screen.width) > 0 &&
      Number.isInteger(value.screen.height) && Number(value.screen.height) > 0 &&
      typeof value.screen.touch === 'boolean');
    const uiValid = value.ui === null || (isRecord(value.ui) &&
      (value.ui.sectionTypes === null || (Array.isArray(value.ui.sectionTypes) &&
        value.ui.sectionTypes.every((type) => typeof type === 'string'))) &&
      (value.ui.viewModes === null || (Array.isArray(value.ui.viewModes) &&
        value.ui.viewModes.every((mode) => typeof mode === 'string'))) &&
      isRecord(value.ui.menuNativeInput) &&
      Object.values(value.ui.menuNativeInput).every((input) => typeof input === 'string'));
    const imageValid = value.image === null || (isRecord(value.image) &&
      (value.image.maxBytes === null || (Number.isInteger(value.image.maxBytes) && Number(value.image.maxBytes) >= 0)) &&
      (value.image.maxPaletteColors === null || (Number.isInteger(value.image.maxPaletteColors) &&
        Number(value.image.maxPaletteColors) >= 0)));
    const canvasValid = value.canvas === null || (isRecord(value.canvas) &&
      Array.isArray(value.canvas.resolutions) && value.canvas.resolutions.every((item) => typeof item === 'string') &&
      Array.isArray(value.canvas.colorBits) && value.canvas.colorBits.every((item) => Number.isInteger(item)) &&
      (value.canvas.maxFps === null || Number.isInteger(value.canvas.maxFps)));
    const audioValid = value.audio === null || (isRecord(value.audio) &&
      Array.isArray(value.audio.formats) && value.audio.formats.every((item) => typeof item === 'string') &&
      isNullableNumber(value.audio.sampleRate) && isNullableNumber(value.audio.maxBufferBytes));
    return screenValid && uiValid && imageValid && canvasValid && audioValid;
  }

  function isDeviceDetail(value: unknown, expectedDeviceId: string): value is SduiDeviceDetailResponse {
    if (!isRecord(value) || value.deviceId !== expectedDeviceId ||
      !(value.name === null || typeof value.name === 'string') ||
      !(value.notes === null || typeof value.notes === 'string') ||
      !['ONLINE', 'OFFLINE'].includes(String(value.status)) ||
      !['CLAIMED', 'UNCLAIMED'].includes(String(value.registrationStatus)) ||
      !isNullableString(value.board) || !isNullableString(value.protocolVersion) ||
      !isNullableString(value.schemaVersion) || !isNullableString(value.capabilityHash) ||
      !isNullableString(value.capabilitySyncState) || typeof value.businessAllowed !== 'boolean' ||
      !isNullableString(value.connectedAt) || !isNullableString(value.sessionId) ||
      !(value.connectionCount === null || (Number.isInteger(value.connectionCount) && Number(value.connectionCount) >= 0)) ||
      !(value.totalUptimeS === null || (Number.isInteger(value.totalUptimeS) && Number(value.totalUptimeS) >= 0)) ||
      !isNullableString(value.lastSeenAt) || !isNullableString(value.claimedAt) || !isNullableString(value.createdAt) ||
      !isSurface(value.surface) || !isTelemetrySnapshot(value.lastTelemetry)) return false;
    if (value.capabilitySummary === null) return true;
    const summary = value.capabilitySummary;
    return isRecord(summary) && summary.deviceId === expectedDeviceId &&
      typeof summary.online === 'boolean' && typeof summary.syncState === 'string' &&
      isNullableString(summary.commandSchemaHash) && isNullableString(summary.uiSchemaHash) &&
      typeof summary.schemaSynced === 'boolean' && isNullableString(summary.board) &&
      isNullableString(summary.protocolVersion) && isNullableString(summary.schemaVersion) &&
      Number.isInteger(summary.actionCount) && Number(summary.actionCount) >= 0 &&
      Number.isInteger(summary.triggerCount) && Number(summary.triggerCount) >= 0 &&
      isSurface(summary.surface);
  }

  async function fetchDetail(deviceId: string) {
    const requestId = ++detailRequestId;
    loading.detail = true;
    try {
      const res = await getDeviceDetail(deviceId);
      if (requestId === detailRequestId) {
        if (!isDeviceDetail(res?.data, deviceId)) throw new Error('设备详情响应与请求设备身份或数据结构不匹配');
        detail.value = res.data;
      }
    } catch (cause: unknown) {
      if (requestId === detailRequestId) {
        detail.value = null;
        ElMessage.error(errorDetails(cause).message || '加载设备详情失败');
      }
    } finally {
      if (requestId === detailRequestId) loading.detail = false;
    }
  }

  async function saveDeviceInfo(deviceId: string, data: { name?: string; notes?: string }) {
    if (loading.saving || detail.value?.deviceId !== deviceId) return false;
    if (!data.name?.trim() && data.notes === undefined) {
      ElMessage.warning('名称和备注至少填写一个');
      return false;
    }
    const requestId = ++saveRequestId;
    loading.saving = true;
    try {
      await updateDevice(deviceId, data);
      if (requestId !== saveRequestId || detail.value?.deviceId !== deviceId) return true;
      ElMessage.success('设备信息已更新');
      if (detail.value) {
        if (data.name !== undefined) detail.value.name = data.name;
        if (data.notes !== undefined) detail.value.notes = data.notes;
      }
      return true;
    } catch (cause: unknown) {
      if (requestId === saveRequestId && detail.value?.deviceId === deviceId) {
        ElMessage.error(errorDetails(cause).message || '更新设备信息失败');
      }
      return false;
    } finally {
      if (requestId === saveRequestId) loading.saving = false;
    }
  }

  function clearDetail() {
    detailRequestId++;
    saveRequestId++;
    detail.value = null;
    loading.detail = false;
    loading.saving = false;
  }

  return {
    detail,
    loading,
    fetchDetail,
    saveDeviceInfo,
    clearDetail
  };
}

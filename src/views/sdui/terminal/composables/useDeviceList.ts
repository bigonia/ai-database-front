import { ref, reactive } from 'vue';
import {
  getDeviceList,
  getUnclaimedDevices,
  claimDevice,
  deleteDevice
} from '@/api/sdui';
import { ElMessage, ElMessageBox } from 'element-plus';
import { isTelemetrySnapshot } from '@/sdui/terminalTelemetry';
import type { SduiDevice, SduiDeviceListResponse } from '@/types/sdui-dashboard';
import { errorDetails } from '@/utils/errorDetails';

export function useDeviceList() {
  // ── State ──────────────────────────────────────────────
  const claimedDevices = ref<SduiDevice[]>([]);
  const unclaimedDevices = ref<SduiDevice[]>([]);
  const loading = reactive({
    claimed: false,
    unclaimed: false,
    claim: false,
    delete: false
  });
  const errors = reactive({ claimed: '', unclaimed: '' });
  const staleSnapshot = reactive({ claimed: false, unclaimed: false });
  let claimedRequestId = 0;
  let unclaimedRequestId = 0;
  let lastClaimedQueryKey: string | null = null;
  let lastUnclaimedQueryKey: string | null = null;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNullableString(value: unknown): boolean {
    return value === null || typeof value === 'string';
  }

  function isAuthorizationFailure(cause: unknown): boolean {
    const status = errorDetails(cause).response?.status;
    return status === 401 || status === 403;
  }

  function parseInventoryPage(value: unknown, page: number, size: number,
    registrationStatus: 'CLAIMED' | 'UNCLAIMED'): SduiDeviceListResponse {
    if (!isRecord(value) || !Number.isInteger(value.totalCount) || Number(value.totalCount) < 0 ||
      !Number.isInteger(value.onlineCount) || Number(value.onlineCount) < 0 ||
      !Number.isInteger(value.offlineCount) || Number(value.offlineCount) < 0 ||
      Number(value.onlineCount) + Number(value.offlineCount) !== Number(value.totalCount) ||
      value.page !== page || value.size !== size || !Array.isArray(value.items) ||
      value.items.length > size) throw new Error('终端列表接口分页响应格式无效');
    const ids = new Set<string>();
    const validItems = value.items.every((item) => {
      if (!isRecord(item) || typeof item.deviceId !== 'string' || !item.deviceId.trim() ||
        ids.has(item.deviceId) || !(item.name === null || typeof item.name === 'string') ||
        !['ONLINE', 'OFFLINE'].includes(String(item.status)) ||
        item.registrationStatus !== registrationStatus ||
        !isNullableString(item.board) || !isNullableString(item.capabilitySyncState) ||
        !isNullableString(item.lastSeenAt) || !isNullableString(item.connectedAt) ||
        !(item.connectionCount === null || (Number.isInteger(item.connectionCount) && Number(item.connectionCount) >= 0)) ||
        !isNullableString(item.claimedAt) || !isNullableString(item.createdAt) ||
        !isTelemetrySnapshot(item.lastTelemetry)) return false;
      ids.add(item.deviceId);
      return true;
    });
    if (!validItems) throw new Error('终端列表包含无效、重复或不属于当前认领状态的设备');
    return value as unknown as SduiDeviceListResponse;
  }

  const filters = reactive({
    status: '',
    search: '',
    sortBy: 'lastSeenAt',
    sortDir: 'DESC' as 'DESC' | 'ASC'
  });

  const pagination = reactive({
    page: 1,
    size: 12,
    total: 0
  });
  const unclaimedPagination = reactive({ page: 1, size: 12, total: 0 });
  const claimedCounts = reactive({ total: 0, online: 0, offline: 0 });
  const unclaimedCounts = reactive({ total: 0, online: 0, offline: 0 });

  // ── Computed helpers ────────────────────────────────────
  function onlineCount(list: SduiDevice[]) {
    return list.filter((d) => d.status === 'ONLINE').length;
  }

  function offlineCount(list: SduiDevice[]) {
    return list.filter((d) => d.status !== 'ONLINE').length;
  }

  // ── Fetch ───────────────────────────────────────────────
  async function fetchClaimedDevices() {
    const requestId = ++claimedRequestId;
    const query = {
      page: pagination.page - 1,
      size: pagination.size,
      status: filters.status,
      search: filters.search,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir
    };
    const queryKey = JSON.stringify(query);
    const isCurrentQuery = () => requestId === claimedRequestId &&
      query.page === pagination.page - 1 && query.size === pagination.size &&
      query.status === filters.status &&
      query.search === filters.search && query.sortBy === filters.sortBy &&
      query.sortDir === filters.sortDir;
    loading.claimed = true;
    errors.claimed = '';
    staleSnapshot.claimed = false;
    try {
      const params: Record<string, unknown> = {
        page: query.page,
        size: query.size,
        registrationStatus: 'CLAIMED',
        sortBy: query.sortBy,
        sortDir: query.sortDir
      };
      if (query.status) params.status = query.status;
      if (query.search) params.search = query.search;

      const res = await getDeviceList(params);
      if (!isCurrentQuery()) return;
      const data = parseInventoryPage(res?.data, query.page, query.size, 'CLAIMED');
      const lastPage = Math.max(1, Math.ceil(data.totalCount / query.size));
      if (pagination.page > lastPage) {
        pagination.page = lastPage;
        void fetchClaimedDevices();
        return;
      }
      claimedDevices.value = data.items;
      pagination.total = data.totalCount;
      claimedCounts.total = data.totalCount;
      claimedCounts.online = data.onlineCount;
      claimedCounts.offline = data.offlineCount;
      lastClaimedQueryKey = queryKey;
      staleSnapshot.claimed = false;
    } catch (cause: unknown) {
      if (!isCurrentQuery()) return;
      const reason = errorDetails(cause).message || '加载终端列表失败';
      if (lastClaimedQueryKey === queryKey && claimedDevices.value.length) {
        errors.claimed = `当前筛选结果刷新失败，以下保留的是最近一次成功读取的快照：${reason}`;
        staleSnapshot.claimed = true;
      } else {
        claimedDevices.value = [];
        claimedCounts.total = 0;
        claimedCounts.online = 0;
        claimedCounts.offline = 0;
        pagination.total = 0;
        lastClaimedQueryKey = null;
        errors.claimed = reason;
        staleSnapshot.claimed = false;
      }
      if (isAuthorizationFailure(cause)) {
        claimedDevices.value = [];
        claimedCounts.total = 0;
        claimedCounts.online = 0;
        claimedCounts.offline = 0;
        pagination.total = 0;
        lastClaimedQueryKey = null;
        staleSnapshot.claimed = false;
      }
    } finally {
      if (isCurrentQuery()) loading.claimed = false;
    }
  }

  async function fetchUnclaimedDevices() {
    const requestId = ++unclaimedRequestId;
    const query = { page: unclaimedPagination.page - 1, size: unclaimedPagination.size };
    const queryKey = JSON.stringify(query);
    const isCurrentQuery = () => requestId === unclaimedRequestId &&
      query.page === unclaimedPagination.page - 1 && query.size === unclaimedPagination.size;
    loading.unclaimed = true;
    errors.unclaimed = '';
    staleSnapshot.unclaimed = false;
    try {
      const res = await getUnclaimedDevices({ page: query.page, size: query.size });
      if (!isCurrentQuery()) return;
      const data = parseInventoryPage(res?.data, query.page, query.size, 'UNCLAIMED');
      const lastPage = Math.max(1, Math.ceil(data.totalCount / query.size));
      if (unclaimedPagination.page > lastPage) {
        unclaimedPagination.page = lastPage;
        void fetchUnclaimedDevices();
        return;
      }
      unclaimedDevices.value = data.items;
      unclaimedPagination.total = data.totalCount;
      unclaimedCounts.total = data.totalCount;
      unclaimedCounts.online = data.onlineCount;
      unclaimedCounts.offline = data.offlineCount;
      lastUnclaimedQueryKey = queryKey;
      staleSnapshot.unclaimed = false;
    } catch (cause: unknown) {
      if (!isCurrentQuery()) return;
      const reason = errorDetails(cause).message || '加载未认领设备失败';
      if (lastUnclaimedQueryKey === queryKey && unclaimedDevices.value.length) {
        errors.unclaimed = `当前分页刷新失败，以下保留的是最近一次成功读取的快照：${reason}`;
        staleSnapshot.unclaimed = true;
      } else {
        unclaimedDevices.value = [];
        unclaimedCounts.total = 0;
        unclaimedCounts.online = 0;
        unclaimedCounts.offline = 0;
        unclaimedPagination.total = 0;
        lastUnclaimedQueryKey = null;
        errors.unclaimed = reason;
        staleSnapshot.unclaimed = false;
      }
      if (isAuthorizationFailure(cause)) {
        unclaimedDevices.value = [];
        unclaimedCounts.total = 0;
        unclaimedCounts.online = 0;
        unclaimedCounts.offline = 0;
        unclaimedPagination.total = 0;
        lastUnclaimedQueryKey = null;
        staleSnapshot.unclaimed = false;
      }
    } finally {
      if (isCurrentQuery()) loading.unclaimed = false;
    }
  }

  async function refreshAll() {
    await Promise.all([fetchClaimedDevices(), fetchUnclaimedDevices()]);
  }

  // ── Actions ─────────────────────────────────────────────
  function resetAndFetch() {
    pagination.page = 1;
    fetchClaimedDevices();
  }

  function handlePagination(page: number, limit: number) {
    pagination.page = page;
    pagination.size = limit;
    fetchClaimedDevices();
  }

  function handleUnclaimedPagination(page: number, limit: number) {
    unclaimedPagination.page = page;
    unclaimedPagination.size = limit;
    fetchUnclaimedDevices();
  }

  async function submitClaim(deviceId: string, claimCode: string, deviceName?: string) {
    if (!deviceId || !claimCode) {
      ElMessage.warning('请填写设备 ID 和认领码');
      return;
    }
    loading.claim = true;
    try {
      await claimDevice(deviceId, {
        claimCode: claimCode.trim(),
        deviceName: deviceName?.trim() || undefined
      });
      ElMessage.success('设备认领成功');
      filters.status = '';
      filters.search = '';
      pagination.page = 1;
      await Promise.all([fetchClaimedDevices(), fetchUnclaimedDevices()]);
      return true;
    } catch (cause: unknown) {
      ElMessage.error(errorDetails(cause).message || '设备认领失败');
      return false;
    } finally {
      loading.claim = false;
    }
  }

  async function removeDevice(device: SduiDevice) {
    try {
      await ElMessageBox.confirm(
        `确认删除设备 ${device.name || device.deviceId}？`,
        '删除设备',
        { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
      );
    } catch {
      return;
    }
    loading.delete = true;
    try {
      await deleteDevice(device.deviceId);
      ElMessage.success('设备已删除');
      await fetchClaimedDevices();
    } catch (cause: unknown) {
      ElMessage.error(errorDetails(cause).message || '删除设备失败');
    } finally {
      loading.delete = false;
    }
  }

  return {
    claimedDevices,
    unclaimedDevices,
    loading,
    errors,
    staleSnapshot,
    filters,
    pagination,
    unclaimedPagination,
    claimedCounts,
    unclaimedCounts,
    onlineCount,
    offlineCount,
    fetchClaimedDevices,
    fetchUnclaimedDevices,
    refreshAll,
    resetAndFetch,
    handlePagination,
    handleUnclaimedPagination,
    submitClaim,
    removeDevice
  };
}

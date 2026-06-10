import { ref, reactive } from 'vue';
import {
  getDeviceList,
  getUnclaimedDevices,
  getDeviceTypes,
  claimDevice,
  deleteDevice
} from '@/api/sdui';
import { ElMessage, ElMessageBox } from 'element-plus';

export function useDeviceList() {
  // ── State ──────────────────────────────────────────────
  const claimedDevices = ref<SduiDevice[]>([]);
  const unclaimedDevices = ref<SduiDevice[]>([]);
  const deviceTypes = ref<DeviceTypeInfo[]>([]);

  const loading = reactive({
    claimed: false,
    unclaimed: false,
    types: false,
    claim: false,
    delete: false
  });

  const filters = reactive({
    status: '',
    board: '',
    search: '',
    sortBy: 'lastSeenAt',
    sortDir: 'DESC' as 'DESC' | 'ASC'
  });

  const pagination = reactive({
    page: 1,
    size: 12,
    total: 0
  });

  // ── Computed helpers ────────────────────────────────────
  function onlineCount(list: SduiDevice[]) {
    return list.filter((d) => d.status === 'ONLINE').length;
  }

  function offlineCount(list: SduiDevice[]) {
    return list.filter((d) => d.status !== 'ONLINE').length;
  }

  // ── Fetch ───────────────────────────────────────────────
  async function fetchClaimedDevices() {
    loading.claimed = true;
    try {
      const params: Record<string, unknown> = {
        page: pagination.page - 1,
        size: pagination.size,
        registrationStatus: 'CLAIMED',
        sortBy: filters.sortBy,
        sortDir: filters.sortDir
      };
      if (filters.status) params.status = filters.status;
      if (filters.board) params.board = filters.board;
      if (filters.search) params.search = filters.search;

      const res = await getDeviceList(params);
      const data = res?.data as SduiDeviceListResponse | undefined;
      claimedDevices.value = (data?.items || []) as SduiDevice[];
      pagination.total = data?.totalCount ?? data?.total ?? claimedDevices.value.length;
    } catch {
      claimedDevices.value = [];
      ElMessage.error('加载终端列表失败');
    } finally {
      loading.claimed = false;
    }
  }

  async function fetchUnclaimedDevices() {
    loading.unclaimed = true;
    try {
      const res = await getUnclaimedDevices();
      const data = res?.data;
      unclaimedDevices.value = Array.isArray(data) ? (data as SduiDevice[]) : [];
    } catch {
      unclaimedDevices.value = [];
      ElMessage.error('加载未认领设备失败');
    } finally {
      loading.unclaimed = false;
    }
  }

  async function fetchDeviceTypes() {
    loading.types = true;
    try {
      const res = await getDeviceTypes();
      const data = res?.data as DeviceTypesResponse | undefined;
      deviceTypes.value = data?.types || [];
    } finally {
      loading.types = false;
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
      await refreshAll();
      return true;
    } catch {
      ElMessage.error('设备认领失败');
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
      fetchClaimedDevices();
    } catch {
      ElMessage.error('删除设备失败');
    } finally {
      loading.delete = false;
    }
  }

  return {
    claimedDevices,
    unclaimedDevices,
    deviceTypes,
    loading,
    filters,
    pagination,
    onlineCount,
    offlineCount,
    fetchClaimedDevices,
    fetchUnclaimedDevices,
    fetchDeviceTypes,
    refreshAll,
    resetAndFetch,
    handlePagination,
    submitClaim,
    removeDevice
  };
}

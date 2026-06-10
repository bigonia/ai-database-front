import { ref, reactive } from 'vue';
import { getDeviceDetail, updateDevice } from '@/api/sdui';
import { ElMessage } from 'element-plus';

export function useDeviceDetail() {
  const detail = ref<SduiDeviceDetailResponse | null>(null);
  const loading = reactive({
    detail: false,
    saving: false
  });

  async function fetchDetail(deviceId: string) {
    loading.detail = true;
    try {
      const res = await getDeviceDetail(deviceId);
      detail.value = (res?.data || null) as SduiDeviceDetailResponse | null;
    } catch {
      detail.value = null;
      ElMessage.error('加载设备详情失败');
    } finally {
      loading.detail = false;
    }
  }

  async function saveDeviceInfo(deviceId: string, data: { name?: string; notes?: string }) {
    if (!data.name?.trim() && data.notes === undefined) {
      ElMessage.warning('名称和备注至少填写一个');
      return false;
    }
    loading.saving = true;
    try {
      await updateDevice(deviceId, data);
      ElMessage.success('设备信息已更新');
      if (detail.value) {
        if (data.name !== undefined) detail.value.name = data.name;
        if (data.notes !== undefined) detail.value.notes = data.notes;
      }
      return true;
    } catch {
      ElMessage.error('更新设备信息失败');
      return false;
    } finally {
      loading.saving = false;
    }
  }

  function clearDetail() {
    detail.value = null;
  }

  return {
    detail,
    loading,
    fetchDetail,
    saveDeviceInfo,
    clearDetail
  };
}

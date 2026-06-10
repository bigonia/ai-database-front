import { ref, reactive } from 'vue';
import { getDeviceConnectionLog } from '@/api/sdui';
import { ElMessage } from 'element-plus';

export function useConnectionLog() {
  const connectionData = ref<ConnectionLog | null>(null);
  const connectionPagination = reactive({
    page: 0,
    size: 20
  });

  const loading = ref(false);

  async function fetchConnectionLog(deviceId: string) {
    loading.value = true;
    try {
      const res = await getDeviceConnectionLog(deviceId, {
        page: connectionPagination.page,
        size: connectionPagination.size
      });
      connectionData.value = (res?.data || null) as ConnectionLog | null;
    } catch {
      connectionData.value = null;
      ElMessage.error('加载连接日志失败');
    } finally {
      loading.value = false;
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
    fetchConnectionLog,
    handleConnectionPage
  };
}

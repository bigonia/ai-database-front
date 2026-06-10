import { computed, ref } from 'vue';
import { getDeviceList } from '@/api/sdui';
import { normalizeDeviceOptions } from '../normalize';
import type { DebugDeviceOption } from '../types';

export function useDebugDeviceContext() {
  const devices = ref<DebugDeviceOption[]>([]);
  const selectedDeviceId = ref('');
  const loading = ref(false);

  const selectedDevice = computed(() => devices.value.find((item) => item.deviceId === selectedDeviceId.value) || null);

  async function fetchDevices() {
    loading.value = true;
    try {
      const response = await getDeviceList({ page: 0, size: 100, registrationStatus: 'CLAIMED' });
      devices.value = normalizeDeviceOptions(response);
      if (!selectedDeviceId.value && devices.value.length) {
        selectedDeviceId.value = devices.value[0].deviceId;
      }
    } finally {
      loading.value = false;
    }
  }

  function setSelectedDevice(deviceId: string) {
    selectedDeviceId.value = deviceId;
  }

  return {
    devices,
    selectedDeviceId,
    selectedDevice,
    loading,
    fetchDevices,
    setSelectedDevice
  };
}

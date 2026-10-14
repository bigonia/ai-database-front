export interface SduiDeviceOption {
  deviceId: string;
  name?: string;
  status?: string;
  capabilitySyncState?: string | null;
  online?: boolean;
  board?: string;
  registrationStatus?: string;
}

export interface SduiDeviceInventoryPage {
  totalCount: number;
  page: number;
  size: number;
  items: SduiDeviceOption[];
}

export interface DeviceBusinessOrder {
  deviceId: string;
  primaryInstanceId: string | null;
  instanceOrder: string[];
  instanceLabels: Record<string, { businessName: string; deploymentSerial: number }>;
}

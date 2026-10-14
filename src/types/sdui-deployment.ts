export interface DeploymentFrozen {
  deploymentId: string;
  businessId: string;
  localDeviceId: string;
  targetDeviceIds: string[];
  triggers: string[];
  credential?: string | null;
  initialFlowKey?: string | null;
  initialRunId?: string | null;
  initialRunDuplicate: boolean;
}

export interface DeploymentPreflight {
  deploymentId: string;
  deployable: number;
  blocked: number;
  blocks: string[];
  devices: Array<{
    deviceId: string;
    role: 'local' | 'target' | string;
    online: boolean;
    willDeploy: boolean;
    blockingReason: string | null;
  }>;
}

export interface DeploymentStatus {
  deploymentId: string;
  businessId: string;
  businessName: string;
  deploymentSerial: number;
  status: 'active' | 'stopped';
  slotBindings: { local: string; target?: string | null };
  deviceStatuses: Record<string, { status: string; error: string | null; online: boolean; installing: boolean }>;
  deviceIds: string[];
  deployedAt: string | null;
  stoppedAt: string | null;
}

export interface DeploymentBusinessSnapshot {
  deploymentId: string;
  businessId: string;
  available: boolean;
  sourceAvailable: boolean;
  differsFromSource: boolean;
  definition: Record<string, unknown>;
}

export interface DeploymentPage {
  items: DeploymentStatus[];
  page: number;
  size: number;
  totalElements: number;
}

export interface DeploymentOperationResult {
  deploymentId: string;
  online?: number;
  offline: number;
  succeeded: number;
  failed: number;
  devices: Array<{
    deviceId: string;
    role: 'local' | 'target' | string;
    status: string;
    error: string | null;
  }>;
}

export interface DeploymentCredential {
  deploymentId: string;
  businessId: string;
  deviceId: string;
  triggers: string[];
  endpoint: string;
  credentialSource: string;
}

export interface DeploymentCredentialExport {
  deploymentId: string;
  businessId: string;
  deviceId: string;
  triggers: string[];
  endpoint: string;
  tenantId: string;
  credential: string;
}

export interface BusinessExportProjection {
  businessId: string;
  name: string;
  description: string;
  tenantId: string;
  authentication: string;
  instructions: string;
  instances: Array<{
    deviceId: string;
    method: string;
    endpoint: string;
    resultMethod: string;
    resultEndpoint: string;
    credential: string;
    triggers: Array<{ name: string; flowKey: string; values: Array<{ name: string; type: string; description?: string; required: boolean }> }>;
  }>;
}

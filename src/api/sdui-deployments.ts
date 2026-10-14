import sduiRequest from '@/api/sdui-request';
import { runSduiOperation } from '@/utils/sdui-log';
import type {
  BusinessExportProjection,
  DeploymentBusinessSnapshot,
  DeploymentCredentialExport,
  DeploymentFrozen,
  DeploymentOperationResult,
  DeploymentPage,
  DeploymentPreflight
} from '@/types/sdui-deployment';

const BASE = '/api/v1/sdui';

export function deployBusiness(businessId: string, bindings: { expectedRevision: number; localDeviceId: string; targetDeviceId?: string }): Promise<{ data: { deployment: DeploymentFrozen; installation: DeploymentOperationResult } }> {
  return runSduiOperation('business.deployment.deploy', { businessId, ...bindings }, () =>
    sduiRequest({ url: `${BASE}/businesses/${encodeURIComponent(businessId)}/deployments`, method: 'post', data: { expectedRevision: bindings.expectedRevision, localDeviceId: bindings.localDeviceId, targetDeviceIds: bindings.targetDeviceId ? [bindings.targetDeviceId] : [] }}, { timeout: 180000 }));
}

export function getDeploymentPreflight(deploymentId: string): Promise<{ data: DeploymentPreflight }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/preflight`, method: 'get' }, { timeout: 60000 });
}

export function installDeployment(deploymentId: string): Promise<{ data: DeploymentOperationResult }> {
  return runSduiOperation('business.deployment.install', { deploymentId }, () =>
    sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/install`, method: 'post' }, { timeout: 120000 }));
}

export function uninstallDeployment(deploymentId: string) {
  return runSduiOperation('business.deployment.uninstall', { deploymentId }, () =>
    sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/uninstall`, method: 'post' }, { timeout: 120000 }));
}

export function getDeployment(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}`, method: 'get' });
}

export function getDeploymentSnapshot(deploymentId: string): Promise<{ data: DeploymentBusinessSnapshot }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/snapshot`, method: 'get' }) as Promise<{ data: DeploymentBusinessSnapshot }>;
}

export function deleteDeployment(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}`, method: 'delete' });
}

export function listDeployments(page = 0, size = 20, businessId?: string): Promise<{ data: DeploymentPage }> {
  return sduiRequest({ url: `${BASE}/deployments`, method: 'get', params: { page, size, businessId }});
}

export function getDeploymentCredential(deploymentId: string) {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/credential`, method: 'get' });
}

export function exportDeploymentCredential(deploymentId: string): Promise<{ data: DeploymentCredentialExport }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/credential/export`, method: 'post' });
}

export function getDeploymentExport(deploymentId: string): Promise<{ data: BusinessExportProjection }> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/export`, method: 'get' });
}

export function getBusinessExport(businessId: string) {
  return sduiRequest({ url: `${BASE}/ai/apps/${encodeURIComponent(businessId)}/export`, method: 'get' });
}

export function installDeploymentDevice(deploymentId: string, deviceId: string): Promise<{data: DeploymentOperationResult}> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/devices/${encodeURIComponent(deviceId)}/install`, method: 'post' });
}

export function uninstallDeploymentDevice(deploymentId: string, deviceId: string): Promise<{data: DeploymentOperationResult}> {
  return sduiRequest({ url: `${BASE}/deployments/${encodeURIComponent(deploymentId)}/devices/${encodeURIComponent(deviceId)}/uninstall`, method: 'post' });
}

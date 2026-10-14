interface DeploymentExportContext {
  deploymentId: string;
  businessId: string;
  businessName: string;
  status: string;
  slotBindings: { local: string };
}

interface DeploymentTemplate {
  businessId: string;
  tenantId: string;
  instructions: string;
  instances: Array<{ deviceId: string; credential: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface ExportedCredential {
  deploymentId: string;
  businessId: string;
  deviceId: string;
  endpoint: string;
  tenantId: string;
  credential: string;
  triggers: string[];
}

export function createDeploymentExportController(options: {
  getDeployment: () => DeploymentExportContext | null;
  getDeploymentId: () => string;
  getGeneration: () => number;
  isBusy: () => boolean;
  confirm: () => Promise<unknown>;
  isCancellation: (cause: unknown) => boolean;
  message: (cause: unknown) => string;
  readTemplate: (deploymentId: string) => Promise<unknown>;
  rotateCredential: (deploymentId: string) => Promise<unknown>;
  dataOf: (response: unknown) => unknown;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setCredential: (value: unknown) => void;
  setBusinessExport: (value: unknown) => void;
  setVisible: (value: boolean) => void;
  notifySuccess: (message: string) => void;
}) {
  let requestId = 0;

  async function exportIntegration() {
    const deployment = options.getDeployment();
    const requestedDeploymentId = options.getDeploymentId();
    if (!deployment || deployment.deploymentId !== requestedDeploymentId || deployment.status !== 'active' || options.isBusy()) return;
    options.setLoading(true);
    options.setError('');
    try {
      await options.confirm();
    } catch (cause: unknown) {
      if (!options.isCancellation(cause)) options.setError(options.message(cause) || '导出已取消');
      options.setLoading(false);
      return;
    }

    const currentRequestId = ++requestId;
    const generation = options.getGeneration();
    const isCurrent = () => currentRequestId === requestId && generation === options.getGeneration() &&
      requestedDeploymentId === options.getDeploymentId();
    options.setLoading(true);
    options.setError('');
    options.setCredential(null);
    options.setBusinessExport(null);
    try {
      const template = options.dataOf(await options.readTemplate(requestedDeploymentId)) as DeploymentTemplate | null;
      if (!isCurrent()) return;
      if (!template || template.businessId !== deployment.businessId || !Array.isArray(template.instances) ||
        typeof template.tenantId !== 'string' || typeof template.instructions !== 'string' ||
        template.instances.some(instance => !instance || typeof instance !== 'object' ||
          typeof instance.deviceId !== 'string' || typeof instance.credential !== 'string')) {
        throw new Error('部署导出模板响应格式无效');
      }
      const instance = template.instances.find(candidate => candidate.deviceId === deployment.slotBindings.local);
      if (!instance) throw new Error('导出模板中没有当前部署的本机实例，请检查部署快照');

      const exported = options.dataOf(await options.rotateCredential(requestedDeploymentId)) as ExportedCredential | null;
      if (!isCurrent()) return;
      const expectedEndpoint = `/api/v1/sdui/businesses/${encodeURIComponent(deployment.businessId)}/triggers/{triggerName}`;
      if (!exported || exported.deploymentId !== deployment.deploymentId ||
        exported.businessId !== deployment.businessId || exported.deviceId !== deployment.slotBindings.local ||
        exported.endpoint !== expectedEndpoint || typeof exported.tenantId !== 'string' ||
        typeof exported.credential !== 'string' || !exported.credential.startsWith('xc_') ||
        !Array.isArray(exported.triggers) || !exported.triggers.length ||
        !exported.triggers.every(name => typeof name === 'string' && name.length > 0)) {
        throw new Error('密钥轮换接口响应与当前部署不匹配');
      }
      options.setCredential(exported);
      options.setBusinessExport({
        ...template,
        name: deployment.businessName,
        tenantId: exported.tenantId,
        instances: [{ ...instance, credential: exported.credential }]
      });
      options.setVisible(true);
      options.notifySuccess('新密钥已生成，旧密钥已撤销');
    } catch (cause: unknown) {
      if (isCurrent()) options.setError(options.message(cause) || '生成集成模板失败');
    } finally {
      if (currentRequestId === requestId) options.setLoading(false);
    }
  }

  function invalidate() {
    requestId++;
    options.setLoading(false);
  }

  return { exportIntegration, invalidate };
}

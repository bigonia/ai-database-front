export function createDeploymentRecordLoader<T>(options: {
  getDeploymentId: () => string;
  getPage: () => number;
  pageSize: number;
  read: (deploymentId: string, page: number, pageSize: number) => Promise<unknown>;
  parse: (record: unknown) => T;
  belongsToDeployment: (record: T, deploymentId: string) => boolean;
  setRecords: (records: T[]) => void;
  setTotal: (total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  getErrorMessage: (cause: unknown) => string;
}) {
  let requestId = 0;

  async function loadRecords(isCurrent: () => boolean = () => true) {
    const currentRequestId = ++requestId;
    const deploymentId = options.getDeploymentId();
    options.setLoading(true);
    try {
      const response = await options.read(deploymentId, options.getPage(), options.pageSize);
      if (currentRequestId !== requestId || deploymentId !== options.getDeploymentId() || !isCurrent()) return;
      const data = response !== null && typeof response === 'object' && !Array.isArray(response)
        ? (response as { data?: unknown }).data
        : undefined;
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
        (data as Record<string, unknown>).deploymentId !== deploymentId ||
        !Array.isArray((data as Record<string, unknown>).runs) ||
        !Number.isInteger((data as Record<string, unknown>).totalElements)) {
        throw new Error('执行记录格式无效');
      }
      const page = (data as { runs: unknown[]; totalElements: number }).runs.map(options.parse);
      if (page.some(record => !options.belongsToDeployment(record, deploymentId))) {
        throw new Error('执行记录不属于此部署');
      }
      options.setRecords(page);
      options.setTotal((data as { totalElements: number }).totalElements);
      options.setError('');
    } catch (cause: unknown) {
      if (currentRequestId === requestId && isCurrent()) {
        options.setError(options.getErrorMessage(cause) || '执行记录读取失败');
      }
    } finally {
      if (currentRequestId === requestId && isCurrent()) options.setLoading(false);
    }
  }

  function invalidate() {
    requestId++;
    options.setLoading(false);
  }

  return { loadRecords, invalidate };
}

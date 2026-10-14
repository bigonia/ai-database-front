export interface BusinessRun {
  runId: string;
  businessId: string;
  deploymentId: string;
  deviceId: string;
  flowKey: string;
  triggerSource: string;
  invocationId: string;
  status: 'passed' | 'failed' | 'running';
  stoppedAtIndex: number | null;
  stoppedAtAction: string | null;
  error: string | null;
  stepSummaries: Array<{
    index: number;
    action: string;
    target: string | null;
    status: 'ok' | 'failed';
    detail: Record<string, unknown>;
    error?: string | null;
  }>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RecentBusinessRuns {
  deviceId: string;
  count: number;
  runs: BusinessRun[];
}

export type DebugTransferResult<T = undefined> =
  | { kind: 'stale' }
  | { kind: 'failure'; message: string }
  | { kind: 'success'; value: T };

function failureMessage(value: unknown, fallback: string): string {
  return value !== null && typeof value === 'object' && 'error' in value &&
    typeof value.error === 'string' && value.error ? value.error : fallback;
}

function accepted(value: unknown): boolean {
  return value !== null && typeof value === 'object' && 'ok' in value && value.ok === true;
}

export async function uploadDebugImageTransfer(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  prepareFrame: () => Promise<Blob>;
  openIfNeeded: boolean;
  openSession: () => Promise<unknown>;
  onSessionOpened: () => void;
  sendFrame: (frame: Blob) => Promise<unknown>;
  completeSession: () => Promise<unknown>;
}): Promise<DebugTransferResult> {
  try {
    const frame = await options.prepareFrame();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (options.openIfNeeded) {
      const opened = await options.openSession();
      if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
      if (!accepted(opened)) return { kind: 'failure', message: failureMessage(opened, '无法打开图片传输') };
      options.onSessionOpened();
    }
    const sent = await options.sendFrame(frame);
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!accepted(sent)) return { kind: 'failure', message: failureMessage(sent, '图片帧上传失败') };
    const completed = await options.completeSession();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!accepted(completed)) return { kind: 'failure', message: failureMessage(completed, '图片已上传，但终端未确认完成显示') };
    return { kind: 'success', value: undefined };
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error && error.message ? error.message : '图片上传失败' };
  }
}

export async function sendDebugCanvasTransfer(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  openSession: () => Promise<unknown>;
  onSessionOpened: () => void;
  frames: Iterable<Uint8Array>;
  interval: number;
  frameInterval: number;
  shouldStop: () => boolean;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
  sendFrame: (frame: Uint8Array) => Promise<unknown>;
  onFrameSent: (sentCount: number) => void;
}): Promise<DebugTransferResult<{ sentCount: number; stopped: boolean }>> {
  try {
    const opened = await options.openSession();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!accepted(opened)) return { kind: 'failure', message: failureMessage(opened, '无法打开 Canvas 会话') };
    options.onSessionOpened();
    let sentCount = 0;
    let lastSendAt = 0;
    for (const frame of options.frames) {
      if (options.shouldStop()) break;
      if (sentCount > 0) {
        const remaining = options.interval - (options.now() - lastSendAt);
        if (remaining > 0) await options.wait(remaining);
      }
      if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
      if (options.shouldStop()) break;
      lastSendAt = options.now();
      const result = await options.sendFrame(frame);
      if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
      if (!accepted(result)) return { kind: 'failure', message: failureMessage(result, 'Canvas 帧提交失败') };
      sentCount++;
      options.onFrameSent(sentCount);
    }
    if (sentCount > 0) await options.wait(options.frameInterval + 60);
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'success', value: { sentCount, stopped: options.shouldStop() }};
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error && error.message ? error.message : 'Canvas 发送失败' };
  }
}

export async function completeDebugViewTransfer(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  completeSession: () => Promise<unknown>;
}): Promise<DebugTransferResult> {
  try {
    const result = await options.completeSession();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!accepted(result)) return { kind: 'failure', message: failureMessage(result, '设备拒绝完成视图') };
    return { kind: 'success', value: undefined };
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'failure', message: error instanceof Error && error.message ? error.message : '完成视图失败' };
  }
}

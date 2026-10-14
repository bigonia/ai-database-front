import { parseRequestResult } from '@/sdui/debugRequests';
import type { DebugRequestResult } from '@/types/sdui-debug';

export type DebugRecordingResult = { text: string; artifactId: string; error: string };
export type DebugRecordingOperation<T> =
  | { kind: 'stale' }
  | { kind: 'failure'; message: string }
  | { kind: 'success'; value: T };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function sendDebugRecordingCommand(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  send: () => Promise<unknown>;
  onResult: (result: DebugRequestResult) => Promise<void>;
}): Promise<DebugRecordingOperation<DebugRequestResult>> {
  try {
    const result = parseRequestResult(await options.send());
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    await options.onResult(result);
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!result.ok) return { kind: 'failure', message: result.error || '设备拒绝录音命令' };
    return { kind: 'success', value: result };
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'failure', message: errorMessage(error, '录音操作失败') };
  }
}

export async function loadDebugRecordingResult(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  read: () => Promise<unknown>;
}): Promise<DebugRecordingOperation<DebugRecordingResult>> {
  try {
    const value = await options.read();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('录音结果响应结构无效');
    }
    const result = value as Record<string, unknown>;
    return {
      kind: 'success',
      value: {
        text: typeof result.text === 'string' ? result.text : '',
        artifactId: typeof result.artifactId === 'string' ? result.artifactId : '',
        error: (typeof result.error === 'string' && result.error) ||
          (typeof result.transcriptionError === 'string' && result.transcriptionError) || ''
      }
    };
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return { kind: 'failure', message: errorMessage(error, '录音结果读取失败') };
  }
}

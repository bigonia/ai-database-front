export type DebugAudioReceipt = { bytesSent?: number; framesSent?: number };
export type DebugAudioOperation =
  | { kind: 'stale' }
  | { kind: 'failure'; message: string }
  | { kind: 'success'; receipt: DebugAudioReceipt };

export function encodeDebugPcm16(samples: Float32Array): ArrayBuffer {
  const pcm = new ArrayBuffer(samples.length * 2);
  const view = new DataView(pcm);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
  }
  return pcm;
}

export async function convertDebugAudioToPcm(blob: Blob): Promise<ArrayBuffer> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.ceil(decoded.duration * 22050);
    const offline = new OfflineAudioContext(1, frames, 22050);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeDebugPcm16(rendered.getChannelData(0));
  } finally {
    await context.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function sendDebugAudioCommand(options: {
  deviceId: string;
  isCurrent: (deviceId: string) => boolean;
  send: () => Promise<unknown>;
  failureMessage: string;
}): Promise<DebugAudioOperation> {
  try {
    const response = await options.send();
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    if (!isRecord(response) || response.ok !== true) {
      return {
        kind: 'failure',
        message: isRecord(response) && typeof response.error === 'string' && response.error
          ? response.error
          : options.failureMessage
      };
    }
    return {
      kind: 'success',
      receipt: {
        ...(typeof response.bytesSent === 'number' ? { bytesSent: response.bytesSent } : {}),
        ...(typeof response.framesSent === 'number' ? { framesSent: response.framesSent } : {})
      }
    };
  } catch (error) {
    if (!options.isCurrent(options.deviceId)) return { kind: 'stale' };
    return {
      kind: 'failure',
      message: error instanceof Error && error.message ? error.message : options.failureMessage
    };
  }
}

export function formatDebugAudioReceipt(label: string, receipt: DebugAudioReceipt): string {
  return `${label}：发送 ${receipt.bytesSent ?? 0} 字节 / ${receipt.framesSent ?? 0} 帧`;
}

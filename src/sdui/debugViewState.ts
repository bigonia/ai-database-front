import type { DebugViewState } from '@/types/sdui-debug';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDimensions(spec: UnknownRecord): boolean {
  return Number.isInteger(spec.width) && Number.isInteger(spec.height) && spec.width === spec.height &&
    [16, 32, 64, 128].includes(Number(spec.width)) && [2, 4, 16].includes(Number(spec.paletteSize));
}

export function parseDebugViewState(value: unknown, expectedDeviceId: string): DebugViewState {
  if (!isRecord(value) || value.deviceId !== expectedDeviceId || typeof value.online !== 'boolean' ||
    !(value.mode == null || ['none', 'section', 'image', 'canvas'].includes(String(value.mode))) ||
    ![value.imageBytesReceived, value.canvasFramesReceived, value.canvasFramesRejected]
      .every(count => Number.isSafeInteger(count) && Number(count) >= 0)) throw new Error('主视图状态响应结构无效');
  const imageSpec = value.imageSpec;
  if (imageSpec != null && (!isRecord(imageSpec) || !validDimensions(imageSpec) ||
    !Number.isSafeInteger(imageSpec.expectedBytes) || Number(imageSpec.expectedBytes) <= 0 ||
    Number(imageSpec.expectedBytes) !== Math.ceil(Number(imageSpec.width) * Number(imageSpec.height) *
      (Number(imageSpec.paletteSize) === 2 ? 1 : Number(imageSpec.paletteSize) === 4 ? 2 : 4) / 8))) {
    throw new Error('图片会话规格结构无效');
  }
  const canvasSpec = value.canvasSpec;
  if (canvasSpec != null && (!isRecord(canvasSpec) || !validDimensions(canvasSpec) ||
    !Number.isSafeInteger(canvasSpec.maxFps) || Number(canvasSpec.maxFps) < 0)) throw new Error('Canvas 视图会话规格结构无效');
  if (value.mode === 'image' && (!imageSpec || canvasSpec != null ||
    Number(value.imageBytesReceived) > Number((imageSpec as UnknownRecord).expectedBytes))) {
    throw new Error('图片视图会话规格或接收计数无效');
  }
  if (value.mode === 'canvas' && (!canvasSpec || imageSpec != null)) throw new Error('Canvas 视图会话规格无效');
  if (value.mode !== 'image' && imageSpec != null || value.mode !== 'canvas' && canvasSpec != null) {
    throw new Error('非活动视图携带了活动会话规格');
  }
  return value as unknown as DebugViewState;
}

// 图片 / Canvas 帧传输共用的纯函数与契约。
// 图片面板与画板组件都依赖这里的规格校验和位打包，保证两条链路口径一致。

export interface FrameCapabilities {
  viewModes: string[] | null;
  resolutions: number[] | null;
  maxBytes: number | null;
  maxPaletteColors: number | null;
  colorBits: number[] | null;
  maxFps: number | null;
}

export interface CanvasSessionSpec {
  width: number;
  height: number;
  maxFps: number;
  paletteSize: number;
}

export const FRAME_SIZES: number[] = [16, 32, 64, 128];
export const FRAME_PLATFORM_MAX_BYTES = 8192;

export const DEFAULT_PALETTE_COLORS: string[] = [
  '#ffffff', '#000000', '#ff0000', '#0000ff', '#00ff00', '#ffff00', '#00ffff', '#ff00ff',
  '#808080', '#c0c0c0', '#800000', '#008000', '#000080', '#808000', '#008080', '#800080'
];

export function rgbHexTo565(hex: string): number {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3);
}

export function colorFrom565(value: number): { r: number; g: number; b: number } {
  return {
    r: ((value >> 11) & 31) * 255 / 31,
    g: ((value >> 5) & 63) * 255 / 63,
    b: (value & 31) * 255 / 31
  };
}

export function paletteBits(count: number): number {
  return count === 2 ? 1 : count === 4 ? 2 : count === 16 ? 4 : 0;
}

export function packPixelIndexes(indexes: Uint8Array, bits: number): Blob {
  const packed = new Uint8Array(Math.ceil(indexes.length * bits / 8));
  indexes.forEach((index, pixel) => {
    const bitOffset = pixel * bits;
    packed[bitOffset >> 3] |= index << (8 - bits - (bitOffset & 7));
  });
  return new Blob([packed], { type: 'application/octet-stream' });
}

export interface FrameSpecInput {
  mode: 'image' | 'canvas';
  palette: number[];
  width: number;
  height: number;
  capabilities: FrameCapabilities | null;
}

export type FrameSpecResult =
  | { error: string }
  | { palette: number[]; bits: number; byteLength: number };

export function validateFrameSpec(input: FrameSpecInput): FrameSpecResult {
  const { mode, palette, width, height, capabilities } = input;
  const bits = paletteBits(palette.length);
  if (!FRAME_SIZES.includes(width) || width !== height) {
    return { error: '宽高必须相同，且为 16、32、64 或 128' };
  }
  if (!bits) {
    return { error: '调色板必须包含 2、4 或 16 个 RGB565 色值' };
  }
  if (palette.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) {
    return { error: '每个调色板值必须是 0～65535 的整数' };
  }
  const byteLength = Math.ceil(width * height * bits / 8);
  if (byteLength > FRAME_PLATFORM_MAX_BYTES) {
    return { error: `帧超过平台 ${FRAME_PLATFORM_MAX_BYTES} 字节上限` };
  }
  if (capabilities) {
    if (capabilities.viewModes && !capabilities.viewModes.includes(mode)) {
      return { error: `设备未声明支持 ${mode === 'image' ? '图片' : 'Canvas'} 模式` };
    }
    if (capabilities.resolutions && !capabilities.resolutions.includes(width)) {
      return { error: `设备未声明支持 ${width}×${width} 分辨率` };
    }
    if (capabilities.maxPaletteColors !== null && palette.length > capabilities.maxPaletteColors) {
      return { error: `设备最多支持 ${capabilities.maxPaletteColors} 种调色板颜色` };
    }
    if (capabilities.maxBytes !== null && byteLength > capabilities.maxBytes) {
      return { error: `当前帧需要 ${byteLength} 字节，超过设备上限 ${capabilities.maxBytes} 字节` };
    }
    if (mode === 'canvas' && capabilities.colorBits && !capabilities.colorBits.includes(bits)) {
      return { error: `设备未声明支持 ${bits} 位 Canvas 色深` };
    }
  }
  return { palette, bits, byteLength };
}

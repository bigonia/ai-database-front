export type ImageFitMode = 'contain' | 'cover';
export type ImageSourceRect = { x: number; y: number; width: number; height: number };

type RgbColor = { r: number; g: number; b: number };

export function debugRgbFrom565(value: number): RgbColor {
  return { r: ((value >> 11) & 31) * 255 / 31, g: ((value >> 5) & 63) * 255 / 63, b: (value & 31) * 255 / 31 };
}

export function packDebugImagePixels(pixels: Uint8ClampedArray, width: number, height: number, bits: number, palette565: number[]): Uint8Array {
  const palette = palette565.map(debugRgbFrom565);
  const indexes = new Uint8Array(width * height);
  for (let pixel = 0; pixel < indexes.length; pixel++) {
    const offset = pixel * 4;
    const alpha = pixels[offset + 3] / 255;
    const red = pixels[offset] * alpha + 255 * (1 - alpha);
    const green = pixels[offset + 1] * alpha + 255 * (1 - alpha);
    const blue = pixels[offset + 2] * alpha + 255 * (1 - alpha);
    let best = 0;
    let bestDistance = Infinity;
    palette.forEach((color, index) => {
      const dr = red - color.r;
      const dg = green - color.g;
      const db = blue - color.b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    indexes[pixel] = best;
  }
  const packed = new Uint8Array(Math.ceil(indexes.length * bits / 8));
  indexes.forEach((index, pixel) => {
    const bitOffset = pixel * bits;
    packed[bitOffset >> 3] |= index << (8 - bits - (bitOffset & 7));
  });
  return packed;
}

export function getDebugFrameIndexError(bytes: Uint8Array, bits: number, paletteCount: number, pixelCount: number): string {
  const mask = (1 << bits) - 1;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const bitOffset = pixel * bits;
    const byteIndex = bitOffset >> 3;
    const shift = 8 - bits - (bitOffset & 7);
    const index = (bytes[byteIndex] >> shift) & mask;
    if (index >= paletteCount) return `第 ${pixel + 1} 个像素的索引 ${index} 超出调色板范围（0～${paletteCount - 1}）`;
  }
  return '';
}

export function getDebugImageSourceRect(options: {
  bitmapWidth: number;
  bitmapHeight: number;
  targetWidth: number;
  targetHeight: number;
  fitMode: ImageFitMode;
  zoom: number;
  x: number;
  y: number;
}): ImageSourceRect {
  const baseScale = options.fitMode === 'cover'
    ? Math.max(options.targetWidth / options.bitmapWidth, options.targetHeight / options.bitmapHeight)
    : Math.min(options.targetWidth / options.bitmapWidth, options.targetHeight / options.bitmapHeight);
  const scale = baseScale * options.zoom;
  const width = options.targetWidth / scale;
  const height = options.targetHeight / scale;
  const maxX = Math.max(0, options.bitmapWidth - width);
  const maxY = Math.max(0, options.bitmapHeight - height);
  return {
    x: Math.max(0, Math.min(maxX, options.x)),
    y: Math.max(0, Math.min(maxY, options.y)),
    width: Math.min(options.bitmapWidth, width),
    height: Math.min(options.bitmapHeight, height)
  };
}

export function getDebugImageCropReset(options: {
  bitmapWidth: number;
  bitmapHeight: number;
  targetWidth: number;
  targetHeight: number;
  fitMode: ImageFitMode;
}): { zoom: number; x: number; y: number; size: number } {
  const scale = options.fitMode === 'cover'
    ? Math.max(options.targetWidth / options.bitmapWidth, options.targetHeight / options.bitmapHeight)
    : Math.min(options.targetWidth / options.bitmapWidth, options.targetHeight / options.bitmapHeight);
  const sourceWidth = Math.min(options.bitmapWidth, options.targetWidth / scale);
  const sourceHeight = Math.min(options.bitmapHeight, options.targetHeight / scale);
  return {
    zoom: 1,
    x: (options.bitmapWidth - sourceWidth) / 2,
    y: (options.bitmapHeight - sourceHeight) / 2,
    size: Math.min(sourceWidth, sourceHeight)
  };
}

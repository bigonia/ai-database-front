export type DebugPixelPoint = { x: number; y: number };
export type DebugPixelChange = { index: number; before: number; after: number };

export function * debugPixelPlaybackFrames(
  pixelCount: number,
  changes: readonly DebugPixelChange[],
  frameCount: number
): Generator<Uint8Array> {
  const pixels = new Uint8Array(pixelCount);
  yield pixels.slice();
  const count = Math.min(changes.length, Math.max(1, Math.floor(frameCount)));
  let cursor = 0;
  for (let frame = 1; frame <= count; frame++) {
    const end = Math.ceil(frame * changes.length / count);
    while (cursor < end) {
      const change = changes[cursor++];
      pixels[change.index] = change.after;
    }
    yield pixels.slice();
  }
}

export function createDebugCanvasPlaybackPlan(options: {
  pixels: Uint8Array;
  changes: readonly DebugPixelChange[];
  process: boolean;
  fps: number;
  seconds: number;
}) {
  const frameBudget = Math.max(1, Math.floor(options.fps * options.seconds));
  const updateCount = options.process ? Math.min(options.changes.length, frameBudget) : 0;
  return {
    frameBudget,
    updateCount,
    frames: options.process
      ? debugPixelPlaybackFrames(options.pixels.length, options.changes, frameBudget)
      : [options.pixels],
    totalFrames: options.process ? updateCount + 1 : 1,
    interval: options.process && updateCount > 0 ? options.seconds * 1000 / updateCount : 1000 / options.fps
  };
}

export function getDebugPixelPosition(options: {
  clientX: number;
  clientY: number;
  bounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  size: number;
}): DebugPixelPoint | null {
  const { bounds, size } = options;
  if (options.clientX < bounds.left || options.clientX >= bounds.right ||
    options.clientY < bounds.top || options.clientY >= bounds.bottom) return null;
  return {
    x: Math.max(0, Math.min(size - 1, Math.floor((options.clientX - bounds.left) * size / bounds.width))),
    y: Math.max(0, Math.min(size - 1, Math.floor((options.clientY - bounds.top) * size / bounds.height)))
  };
}

function paintDebugPixel(pixels: Uint8Array, size: number, brushSize: number, color: number, point: DebugPixelPoint, changes: DebugPixelChange[]): void {
  const radius = Math.floor(brushSize / 2);
  for (let dy = -radius; dy < brushSize - radius; dy++) {
    for (let dx = -radius; dx < brushSize - radius; dx++) {
      const x = point.x + dx;
      const y = point.y + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const index = y * size + x;
      const before = pixels[index];
      if (before === color) continue;
      changes.push({ index, before, after: color });
      pixels[index] = color;
    }
  }
}

export function paintDebugPixelLine(
  pixels: Uint8Array,
  size: number,
  brushSize: number,
  color: number,
  from: DebugPixelPoint,
  to: DebugPixelPoint,
  changes: DebugPixelChange[]
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let step = 0; step <= steps; step++) {
    paintDebugPixel(pixels, size, brushSize, color, {
      x: Math.round(from.x + dx * step / steps),
      y: Math.round(from.y + dy * step / steps)
    }, changes);
  }
}

export function undoDebugPixelStroke(pixels: Uint8Array, stroke: readonly DebugPixelChange[]): void {
  for (let index = stroke.length - 1; index >= 0; index--) {
    pixels[stroke[index].index] = stroke[index].before;
  }
}

export function packDebugPixelIndexes(indexes: Uint8Array, bits: number): Uint8Array {
  const packed = new Uint8Array(Math.ceil(indexes.length * bits / 8));
  indexes.forEach((index, pixel) => {
    const bitOffset = pixel * bits;
    packed[bitOffset >> 3] |= index << (8 - bits - (bitOffset & 7));
  });
  return packed;
}

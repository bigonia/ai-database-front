export interface PixelChange {
  index: number;
  before: number;
  after: number;
}

// Each update contains real pixel changes, in drawing order; idle time is never recorded.
export function* pixelPlaybackFrames(
  pixelCount: number,
  changes: readonly PixelChange[],
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

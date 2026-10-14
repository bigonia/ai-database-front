type UnknownRecord = Record<string, unknown>;

export interface DebugFrameCapabilities {
  viewModes: string[] | null;
  resolutions: number[] | null;
  maxBytes: number | null;
  maxPaletteColors: number | null;
  colorBits: number[] | null;
  maxFps: number | null;
}

export interface DebugDeviceCapabilities {
  sectionTypes: string[];
  frame: DebugFrameCapabilities;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseDebugDeviceCapabilities(value: unknown, supportedFrameSizes: number[]): DebugDeviceCapabilities {
  const schema = isRecord(value) ? value : null;
  const surface = schema && isRecord(schema.surface) ? schema.surface : null;
  const ui = surface && isRecord(surface.ui) ? surface.ui : null;
  const canvas = surface && isRecord(surface.canvas) ? surface.canvas : null;
  const image = surface && isRecord(surface.image) ? surface.image : null;
  const declaredResolutions = canvas?.resolutions;
  const resolutions = Array.isArray(declaredResolutions)
    ? supportedFrameSizes.filter(size => declaredResolutions.includes(`${size}x${size}`))
    : null;
  const colorBits = Array.isArray(canvas?.colorBits)
    ? canvas.colorBits.map(Number).filter((item): item is 1 | 2 | 4 => [1, 2, 4].includes(item))
    : null;
  return {
    sectionTypes: Array.isArray(ui?.sectionTypes) ? ui.sectionTypes.filter((item): item is string => typeof item === 'string') : [],
    frame: {
      viewModes: Array.isArray(ui?.viewModes) ? ui.viewModes.filter((item): item is string => typeof item === 'string') : null,
      resolutions,
      maxBytes: Number.isInteger(image?.maxBytes) ? Number(image?.maxBytes) : null,
      maxPaletteColors: Number.isInteger(image?.maxPaletteColors) ? Number(image?.maxPaletteColors) : null,
      colorBits,
      maxFps: Number.isInteger(canvas?.maxFps) ? Number(canvas?.maxFps) : null
    }
  };
}

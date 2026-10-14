type UnknownRecord = Record<string, unknown>;

interface TelemetryShape {
  wifi: UnknownRecord | null;
  memory: UnknownRecord | null;
  temperature: UnknownRecord | null;
  power: UnknownRecord | null;
  uptimeS: number | null;
  lastHeartbeatAt: string | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isTelemetrySnapshot(value: unknown): value is TelemetryShape | null {
  if (value === null) return true;
  if (!isRecord(value) || !(value.uptimeS === null || Number.isInteger(value.uptimeS)) ||
    !isNullableString(value.lastHeartbeatAt)) return false;

  if (value.wifi !== null && (!isRecord(value.wifi) ||
    !isNullableNumber(value.wifi.rssi) || !isNullableString(value.wifi.ip))) return false;
  const memory = value.memory;
  if (memory !== null && (!isRecord(memory) ||
    !['freeHeapInternal', 'largestHeapInternal', 'freeHeapDma', 'largestHeapDma', 'freeHeapPsram',
      'largestHeapPsram', 'freeHeapTotal', 'fragInternalPct', 'fragDmaPct', 'fragPsramPct']
      .every((key) => isNullableNumber(memory[key])))) return false;
  if (value.temperature !== null && (!isRecord(value.temperature) ||
    !isNullableNumber(value.temperature.celsius))) return false;
  const power = value.power;
  if (power !== null && (!isRecord(power) ||
    !['supported', 'charging', 'extPowerPresent', 'extPowerCtrl', 'extPowerOn']
      .every((key) => power[key] === null || typeof power[key] === 'boolean') ||
    !['batteryMv', 'batteryPct'].every((key) => isNullableNumber(power[key])))) return false;
  return true;
}

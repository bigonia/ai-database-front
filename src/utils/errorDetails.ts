interface ErrorDetails {
  message?: string;
  code?: unknown;
  apiResponse?: { code?: unknown };
  response?: {
    status?: number;
    data?: { reason?: string };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function errorDetails(value: unknown): ErrorDetails {
  if (value instanceof Error) return { message: value.message };
  if (!isRecord(value)) return {};
  const details: ErrorDetails = {};
  if (typeof value.message === 'string') details.message = value.message;
  if (typeof value.code === 'string' || typeof value.code === 'number') details.code = value.code;
  if (isRecord(value.apiResponse)) {
    details.apiResponse = { code: value.apiResponse.code };
  }
  if (isRecord(value.response)) {
    const response: NonNullable<ErrorDetails['response']> = {};
    if (typeof value.response.status === 'number') response.status = value.response.status;
    if (isRecord(value.response.data) && typeof value.response.data.reason === 'string') {
      response.data = { reason: value.response.data.reason };
    }
    details.response = response;
  }
  return details;
}

export function isMessageBoxCancellation(value: unknown): boolean {
  return value === 'cancel' || value === 'close';
}

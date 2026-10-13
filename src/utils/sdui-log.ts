type SduiLogContext = Record<string, string | number | boolean | undefined>;

/** One concise browser log pair around an operator-visible SDUI action. Never pass payloads or credentials. */
export async function runSduiOperation<T>(
  operation: string,
  context: SduiLogContext,
  task: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const details = Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
  console.info('[SDUI]', operation, 'started', details);
  try {
    const result = await task();
    console.info('[SDUI]', operation, 'completed', { ...details, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[SDUI]', operation, 'failed', {
      ...details,
      durationMs: Date.now() - startedAt,
      reason: reason.slice(0, 240)
    });
    throw error;
  }
}

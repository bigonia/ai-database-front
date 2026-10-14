export function createRunPolling(options: {
  isActive: () => boolean;
  getRunId: () => string;
  getGeneration: () => number;
  isRunning: () => boolean;
  load: () => void;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (timer: number) => void;
  delay?: number;
}) {
  let timer: number | undefined;

  function clear() {
    if (timer === undefined) return;
    options.clearTimer(timer);
    timer = undefined;
  }

  function schedule(expectedRunId: string, generation: number) {
    clear();
    if (!options.isActive() || !options.isRunning() || expectedRunId !== options.getRunId() ||
      generation !== options.getGeneration()) return;
    timer = options.setTimer(() => {
      timer = undefined;
      if (options.isActive() && expectedRunId === options.getRunId() &&
        generation === options.getGeneration()) options.load();
    }, options.delay ?? 2000);
  }

  return { clear, schedule };
}

import { recoveryDelay, transientReadFailure } from '../../utils/recovery';

/** A scene owns the request: retry transient failures, stop on blur/account change. */
export function recoverGameSecret<T>(load: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void, failed: () => void) {
  let disposed = false, failures = 0;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | null = null;
  const attempt = async () => {
    if (disposed) return;
    const current = new AbortController(); controller = current;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; current.abort(); }, 10000);
    try {
      const value = await load(current.signal);
      if (!disposed && !current.signal.aborted) accept(value);
    } catch (error) {
      if (disposed) return;
      failed();
      if (timedOut || transientReadFailure(error)) timer = setTimeout(() => { void attempt(); }, recoveryDelay(++failures, 1000, 15000));
    } finally {
      clearTimeout(timeout);
      if (controller === current) controller = null;
    }
  };
  timer = setTimeout(() => { void attempt(); }, 0);
  return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
}

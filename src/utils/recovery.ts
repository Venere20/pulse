/** Spread reconnections across devices and cap the wait. Healthy polling keeps
 * its existing five-second safety net; repeated network failures slow it down. */
export function recoveryDelay(attempt: number, base = 1000, cap = 30000, random = Math.random) {
  const exponential = Math.min(cap, base * 2 ** Math.min(10, Math.max(0, attempt - 1)));
  return Math.min(cap, Math.round(exponential * (0.85 + 0.3 * random())));
}
export function gamePollDelay(failures: number, random = Math.random) {
  return failures === 0 ? 5000 : recoveryDelay(failures, 10000, 60000, random);
}
export function transientReadFailure(error: unknown) {
  const value = error as { status?: number; code?: string; message?: string; name?: string } | null;
  if (value?.name === 'AbortError') return false;
  if ([408, 429, 500, 502, 503, 504, 520].includes(value?.status ?? 0)) return true;
  if (value?.status && value.status >= 400) return false;
  return /fetch|network|connection|timeout|timed out|offline|rete|connessione/i.test(value?.message ?? '');
}

export type SavePhase = 'idle' | 'saving' | 'saved' | 'failed' | 'uncertain';
export function uncertainWrite(error: unknown) { const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error); return /fetch|network|timeout|timed out|connection|connessione/i.test(message); }
export function createSaveTracker() {
  let owner = ''; let sequence = 0; const listeners = new Set<() => void>();
  const states = new Map<string, { pending: Set<number>; latest: number; phase: SavePhase }>();
  const get = (id: string) => { let state = states.get(id); if (!state) { state = { pending: new Set(), latest: 0, phase: 'idle' }; states.set(id, state); } return state; };
  const emit = () => listeners.forEach(fn => fn());
  return {
    setOwner(id: string) { owner = id; },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    snapshot(id: string): SavePhase { const state = get(id); return state.pending.size ? 'saving' : state.phase; },
    start() { const token = { owner, id: ++sequence }; get(owner).pending.add(token.id); emit(); return token; },
    finish(token: { owner: string; id: number }, phase: SavePhase) { const state = get(token.owner); state.pending.delete(token.id); if (token.id >= state.latest) { state.latest = token.id; state.phase = phase; } emit(); },
  };
}
export const saveTracker = createSaveTracker();
/** Preserve Supabase's result/error contract; don't retry ambiguous writes automatically. */
export async function trackResult<T>(action: () => PromiseLike<T>): Promise<T> {
  const token = saveTracker.start();
  try { const result = await action(); const error = (result as { error?: unknown } | null)?.error; saveTracker.finish(token, error ? uncertainWrite(error) ? 'uncertain' : 'failed' : 'saved'); return result; }
  catch (error) { saveTracker.finish(token, uncertainWrite(error) ? 'uncertain' : 'failed'); throw error; }
}

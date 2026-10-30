export interface DataStore<T> { getSnapshot: () => T; subscribe: (fn: () => void) => () => void; publish: (value: T) => void }
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a); if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => Object.hasOwn(b, key) && Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
export function createDataStore<T>(initial: T): DataStore<T> {
  let current = initial; const listeners = new Set<() => void>();
  return { getSnapshot: () => current, subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    publish(value) { if (shallowEqual(current, value)) return; current = value; for (const fn of listeners) fn(); } };
}
export function selectedSnapshot<T, S>(store: DataStore<T>, select: (value: T) => S) {
  let initialized = false; let source: T; let result: S;
  return () => {
    const next = store.getSnapshot(); if (initialized && next === source) return result;
    const selection = select(next); source = next;
    if (!initialized || !shallowEqual(result, selection)) result = selection;
    initialized = true; return result;
  };
}
export function sameJSON(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a); if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => Object.hasOwn(b, key) && sameJSON((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
/** Preserve unchanged rows and lists after a server refresh. Composite-key rows
 * without id are compared by position; their order is established by the query. */
export function reconcileRows<T>(previous: T[], next: T[]): T[] {
  const byId = new Map(previous.flatMap(row => { const id = (row as { id?: string }).id; return id ? [[id, row] as const] : []; }));
  const rows = next.map((row, i) => { const id = (row as { id?: string }).id; const old = id ? byId.get(id) : previous[i]; return sameJSON(old, row) ? old! : row; });
  return rows.length === previous.length && rows.every((row, i) => row === previous[i]) ? previous : rows;
}

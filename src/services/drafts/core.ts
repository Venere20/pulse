export interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function draftKey(owner: string, scope: string, field: string) { return JSON.stringify([owner, scope, field]); }
function compatible(initial: unknown, value: unknown): boolean {
  if (initial == null) return value == null || typeof value === 'string';
  if (Array.isArray(initial)) return Array.isArray(value) && value.length <= 1000 && value.every(v => typeof v === 'string' || (v && typeof v === 'object' && typeof v.start_date === 'string' && typeof v.end_date === 'string'));
  if (typeof initial === 'object') { if (!value || typeof value !== 'object' || Array.isArray(value)) return false; const fields = Object.entries(initial); return fields.length ? fields.every(([key, expected]) => compatible(expected, (value as Record<string, unknown>)[key])) : Object.values(value).every(v => typeof v === 'string'); }
  return typeof value === typeof initial && (typeof value !== 'number' || Number.isFinite(value));
}
export function createDraftStore(storage: DraftStorage, delay = 300) {
  const values = new Map<string, unknown>(); const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const errors = new Set<string>(); const persisted = new Set<string>(); const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  const write = (key: string) => {
    const timer = pending.get(key); if (timer) clearTimeout(timer); pending.delete(key);
    try { const serialized = JSON.stringify({ v: 1, key, at: Date.now(), value: values.get(key) }); if (serialized.length >= 100000) throw new Error('Bozza troppo grande'); storage.setItem(key, serialized); errors.delete(key); persisted.add(key); }
    catch { errors.add(key); } emit();
  };
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    get<T>(key: string, initial: T): T {
      if (!values.has(key)) {
        let value = initial;
        try { const raw = storage.getItem(key); if (raw && raw.length < 100000) { const saved = JSON.parse(raw); if (saved.v === 1 && saved.key === key && Date.now() - saved.at < 30 * 86400000 && compatible(initial, saved.value)) { value = saved.value; persisted.add(key); } } }
        catch { errors.add(key); }
        values.set(key, value);
      }
      return values.get(key) as T;
    },
    set<T>(key: string, value: T) { values.set(key, value); const old = pending.get(key); if (old) clearTimeout(old); pending.set(key, setTimeout(() => write(key), delay)); emit(); },
    clear(key: string) { const timer = pending.get(key); if (timer) clearTimeout(timer); pending.delete(key); values.delete(key); try { storage.removeItem(key); errors.delete(key); persisted.delete(key); } catch { errors.add(key); } emit(); },
    clearIfUnchanged(owner: string, scope: string, fields: Record<string, unknown>): void {
      if (!Object.entries(fields).every(([field, value]) => JSON.stringify(values.get(draftKey(owner, scope, field))) === JSON.stringify(value))) return;
      for (const field of Object.keys(fields)) this.clear(draftKey(owner, scope, field));
    },
    flush() { for (const key of [...pending.keys()]) write(key); },
    status(owner: string) { const owned = (key: string) => { try { return JSON.parse(key)[0] === owner; } catch { return false; } }; return [...errors].some(owned) ? 'error' : [...pending.keys()].some(owned) ? 'saving' : [...persisted].some(owned) ? 'saved' : 'idle'; },
  };
}

import { reconcileRows } from '../state/dataStore';
import { throwIfAborted } from '../utils/abort';

export interface ReadSpec { owner: string; table: string; column?: string; value?: string | null; order: string; maxRows: number }
export function readKey(spec: ReadSpec) { return JSON.stringify([spec.owner, spec.table, spec.column ?? null, spec.value ?? null, spec.order, spec.maxRows]); }
function canceled() { const error = new Error('Lettura superata'); error.name = 'AbortError'; return error; }
interface Job { controller: AbortController; users: number; started: boolean; version: number; promise: Promise<unknown[]> }
interface Entry { spec: ReadSpec; version: number; rows?: unknown[]; previous?: unknown[]; complete?: boolean; at?: number; current?: Job; next?: Job }

/** In-memory, account-scoped rows. A brief fresh snapshot deduplicates adjacent
 * mounts; resume/reconnect and mutations still revalidate against the server. */
export function createFeatureReadCache(now = Date.now, capacity = 80) {
  const entries = new Map<string, Entry>(); const jobs = new Set<Job>(); let epoch = 0;
  function start(entry: Entry, key: string, load: (signal: AbortSignal) => Promise<unknown[]>, after?: Job): Job {
    const generation = epoch;
    const job: Job = { controller: new AbortController(), users: 0, started: false, version: entry.version, promise: undefined! };
    jobs.add(job);
    job.promise = (after ? after.promise.catch(() => undefined) : Promise.resolve()).then(async () => {
      throwIfAborted(job.controller.signal);
      if (generation !== epoch) throw canceled();
      job.started = true; job.version = entry.version;
      if (entry.next === job) { entry.next = undefined; entry.current = job; }
      const rows = await load(job.controller.signal);
      throwIfAborted(job.controller.signal);
      if (generation !== epoch || job.version !== entry.version) throw canceled();
      const stable = reconcileRows(entry.rows ?? entry.previous ?? [], rows);
      if (entries.get(key) === entry) { entry.rows = stable; entry.previous = undefined; entry.complete = true; entry.at = now(); }
      return stable;
    });
    const finish = () => { jobs.delete(job); if (entry.current === job) entry.current = undefined; if (entry.next === job) entry.next = undefined; };
    void job.promise.then(finish, finish);
    return job;
  }
  function lease<T>(job: Job, signal: AbortSignal): Promise<T[]> {
    job.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return false; done = true;
        signal.removeEventListener('abort', abort); job.controller.signal.removeEventListener('abort', abort);
        job.users--; if (!job.users) job.controller.abort(); return true;
      };
      const abort = () => { if (release()) reject(canceled()); };
      signal.addEventListener('abort', abort, { once: true }); job.controller.signal.addEventListener('abort', abort, { once: true });
      void job.promise.then(rows => { if (release()) resolve(rows as T[]); }, error => { if (release()) reject(error); });
      if (signal.aborted || job.controller.signal.aborted) abort();
    });
  }
  return {
    peek<T>(spec: ReadSpec): T[] | undefined { return entries.get(readKey(spec))?.rows as T[] | undefined; },
    complete(spec: ReadSpec): boolean { return entries.get(readKey(spec))?.complete ?? false; },
    get<T>(spec: ReadSpec, load: (signal: AbortSignal) => Promise<T[]>, signal: AbortSignal, fresh = false): Promise<T[]> {
      throwIfAborted(signal);
      const key = readKey(spec); let entry = entries.get(key);
      if (!entry) { entry = { spec, version: 0 }; entries.set(key, entry); }
      if (!fresh && entry.complete && entry.rows && entry.at != null && now() - entry.at < 200 && !entry.current && !entry.next) return Promise.resolve(entry.rows as T[]);
      let job = entry.next;
      if (!job || job.controller.signal.aborted) {
        const current = entry.current;
        if (current && !current.controller.signal.aborted) {
          if (fresh && current.started || current.started && current.version !== entry.version) {
            job = start(entry, key, load, current); entry.next = job;
          } else job = current;
        } else { job = start(entry, key, load); entry.current = job; }
      }
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return lease<T>(job, signal);
    },
    invalidate(owner: string, table: string) {
      for (const entry of entries.values()) if (entry.spec.owner === owner && entry.spec.table === table) { entry.version++; if (entry.rows) entry.previous = entry.rows; entry.rows = undefined; entry.at = undefined; }
    },
    update<T>(spec: ReadSpec, change: (rows: T[]) => T[]): T[] {
      const key = readKey(spec);
      let entry = entries.get(key);
      const before = (entry?.rows ?? entry?.previous ?? []) as T[];
      const rows = reconcileRows(before, change(before));
      if (rows === before && entry?.rows) return rows;
      // A server-confirmed mutation/event supersedes older in-flight snapshots.
      // Other filters on this table must be revalidated, not guessed locally.
      for (const item of entries.values()) if (item.spec.owner === spec.owner && item.spec.table === spec.table) {
        item.version++; item.current?.controller.abort(); item.next?.controller.abort();
        if (item.rows) item.previous = item.rows;
        item.rows = undefined; item.at = undefined;
      }
      if (!entry) { entry = { spec, version: 0 }; entries.set(key, entry); }
      entry.rows = rows; entry.previous = undefined; entry.at = now();
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return rows;
    },
    clear() { epoch++; for (const job of jobs) job.controller.abort(); entries.clear(); },
  };
}
export const featureReadCache = createFeatureReadCache();

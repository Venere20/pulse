import { throwIfAborted } from '../utils/abort';

export const ROW_PAGE_SIZE = 500;
interface PageResult<T> { data: T[] | null; error: { message: string; code?: string } | null; status?: number }
/** Stable ordering is supplied by the caller. Keep the whole small metadata
 * history for search/statistics, without relying on the server's default cap. */
export async function readPagedRows<T>(load: (from: number, to: number) => PromiseLike<PageResult<T>>,
  signal: AbortSignal, keys: readonly string[] = ['id'], maxRows = Infinity): Promise<PageResult<T>> {
  const rows: T[] = [], seen = new Set<string>();
  for (let offset = 0; ; offset += ROW_PAGE_SIZE) {
    throwIfAborted(signal);
    const result = await load(offset, Math.min(offset + ROW_PAGE_SIZE - 1, maxRows - 1));
    throwIfAborted(signal);
    if (result.error) return { ...result, data: null };
    const page = result.data ?? []; let added = 0;
    for (const row of page) {
      const values = keys.map(key => (row as Record<string, unknown>)[key]);
      const identity = values.some(value => value == null) ? null : JSON.stringify(values);
      if (identity && seen.has(identity)) continue;
      if (identity) seen.add(identity);
      rows.push(row); added++;
    }
    if (page.length < ROW_PAGE_SIZE || offset + ROW_PAGE_SIZE >= maxRows) return { ...result, data: rows };
    if (offset && !added) return { data: null, error: { code: 'PAGING_STALLED', message: 'Il server non ha avanzato nella lettura dello storico. Riprova.' } };
  }
}

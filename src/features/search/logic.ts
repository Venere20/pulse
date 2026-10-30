export type SearchKind = 'memory' | 'fridge' | 'bucket' | 'story';
export interface SearchEntry { id: string; kind: SearchKind; title: string; text: string; day: string; path: string; normalized: string }
export function normalizeSearch(text: string) { return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim(); }
export function searchIndex(
 visits: { id: string; title: string; start_date: string; location?: string | null; notes?: string | null; memory_notes?: string | null }[],
 notes: { id: string; body: string; created_at: string; removed_at: string | null }[],
 wishes: { id: string; title: string; created_at: string }[],
 moments: { id: string; title: string; day: string; body: string }[],
): SearchEntry[] {
 const rows = [
  ...visits.map(v => ({ id: v.id, kind: 'memory' as const, title: v.title, text: [v.location, v.notes, v.memory_notes].filter(Boolean).join(' · '), day: v.start_date, path: `/visit/${v.id}` })),
  ...notes.filter(n => !n.removed_at).map(n => ({ id: n.id, kind: 'fridge' as const, title: 'Un post-it sul frigo', text: n.body, day: n.created_at, path: '/frigo' })),
  ...wishes.map(w => ({ id: w.id, kind: 'bucket' as const, title: w.title, text: '', day: w.created_at, path: '/bucket' })),
  ...moments.map(m => ({ id: m.id, kind: 'story' as const, title: m.title, text: m.body, day: m.day, path: '/storia' })),
 ];
 return rows.map(row => ({ ...row, normalized: normalizeSearch(`${row.title} ${row.text}`) }));
}
export function searchEntries(index: SearchEntry[], query: string, kind: SearchKind | 'all' = 'all') {
 const needle = normalizeSearch(query).slice(0, 120); if (needle.length < 2) return [];
 const tokens = needle.split(' ');
 return index.filter(row => (kind === 'all' || row.kind === kind) && tokens.every(token => row.normalized.includes(token)))
  .sort((a, b) => Number(normalizeSearch(b.title).includes(needle)) - Number(normalizeSearch(a.title).includes(needle)) || b.day.localeCompare(a.day) || a.title.localeCompare(b.title, 'it') || a.id.localeCompare(b.id));
}
export function searchExcerpt(text: string, query: string) {
 const token = normalizeSearch(query).split(' ')[0]; const at = normalizeSearch(text).indexOf(token); const start = Math.max(0, at - 35);
 return `${start ? '…' : ''}${text.slice(start, start + 160)}${text.length > start + 160 ? '…' : ''}`;
}

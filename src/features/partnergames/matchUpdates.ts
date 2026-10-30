import type { PartnerGameKey, PartnerMatch } from './usePartnerGame';

/** Public, server-confirmed rows only; an older RPC/event cannot undo a newer
 * revision. Keep the same timestamp/ID ordering as the history query. */
export function isPartnerMatch(value: unknown, game: PartnerGameKey, userId: string): value is PartnerMatch {
  const next = value as PartnerMatch | null;
  return !!next && typeof next.id === 'string' && next.game === game &&
    [next.player_a, next.player_b].includes(userId) && Number.isInteger(next.revision) && next.revision >= 0 &&
    !!next.state && typeof next.state === 'object' && !Array.isArray(next.state) &&
    typeof next.created_at === 'string' && Number.isFinite(Date.parse(next.created_at)) &&
    ['setup', 'playing', 'won', 'draw', 'cancelled'].includes(next.status);
}
function subMilliseconds(date: string) { return Number(((date.match(/\.(\d+)/)?.[1] ?? '') + '000000').slice(3, 6)); }
export function mergePartnerMatch(rows: PartnerMatch[], value: unknown, game: PartnerGameKey, userId: string): PartnerMatch[] {
  if (!isPartnerMatch(value, game, userId)) return rows;
  const next = value;
  const current = rows.find(row => row.id === next.id);
  if (current && current.revision >= next.revision) return rows;
  return [...rows.filter(row => row.id !== next.id), next]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || subMilliseconds(b.created_at) - subMilliseconds(a.created_at) || a.id.localeCompare(b.id))
    .slice(0, 20);
}

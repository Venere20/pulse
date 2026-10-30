export interface PulseDay { day: string; count: number; sender_ids?: string[] }
const stamp = (day: string) => Date.parse(day.slice(0, 10) + 'T00:00:00Z');
/** A missed calendar day pauses the streak; two complete missed days reset it. */
export function pulseStreak(history: PulseDay[], today: string) {
  const senders = new Map<string, Set<string>>();
  for (const row of history) {
    const day = row.day.slice(0, 10);
    if (!Number.isFinite(stamp(day)) || day > today) continue;
    const ids = senders.get(day) ?? new Set<string>();
    for (const id of row.sender_ids ?? []) if (typeof id === 'string' && id) ids.add(id);
    senders.set(day, ids);
  }
  const completed = [...senders].filter(([, ids]) => ids.size === 2).map(([day]) => day).sort();
  let count = 0, best = 0, previous: string | null = null;
  const events: { day: string; value: number }[] = [];
  for (const day of completed) {
    if (previous && (stamp(day) - stamp(previous)) / 86400000 > 2) count = 0;
    count++; best = Math.max(best, count); previous = day; events.push({ day, value: count });
  }
  const gap = previous ? Math.round((stamp(today) - stamp(previous)) / 86400000) : Infinity;
  return { current: gap <= 2 ? count : 0, best, frozen: gap === 2, todayComplete: completed.includes(today),
    todaySenderIds: [...(senders.get(today) ?? [])], lastCompleteDay: previous, events };
}

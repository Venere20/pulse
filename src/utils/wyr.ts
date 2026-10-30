import { WYR, WyrQuestion } from '../data/wyrQuestions';
import { WyrAnswer } from '../types/games';

const DAY_MS = 86400000;

/** Domanda del giorno, uguale per entrambi (dipende solo dalla data YYYY-MM-DD). */
export const wyrForDay = (day: string): WyrQuestion & { id: number } => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / DAY_MS);
  const id = ((dayNumber % WYR.length) + WYR.length) % WYR.length;
  return { id, ...WYR[id] };
};

export interface WyrStats {
  days: number; // giorni in cui hanno risposto entrambi
  matches: number; // di cui con la stessa scelta
  percent: number; // sintonia 0-100
}

export const computeWyrStats = (answers: WyrAnswer[], me: string, partner: string): WyrStats => {
  const mine = new Map<string, WyrAnswer>();
  for (const a of answers) if (a.user_id === me) mine.set(a.day.slice(0, 10), a);

  let days = 0;
  let matches = 0;
  for (const b of answers) {
    if (b.user_id !== partner) continue;
    const a = mine.get(b.day.slice(0, 10));
    if (!a) continue;
    days++;
    if (a.choice === b.choice) matches++;
  }
  return { days, matches, percent: days ? Math.round((matches / days) * 100) : 0 };
};

import { deepTalkDecks } from '../data/deepTalkDecks';
export function mondayOf(day: string): string { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export function deckForWeek(week: string) { const weeks = Math.floor((Date.parse(week) - Date.parse('2026-01-05')) / (7 * 86400000)); return deepTalkDecks[((weeks % 12) + 12) % 12]; }

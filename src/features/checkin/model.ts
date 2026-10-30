export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  origin: string;
  destination: string;
  minutes: number;
  grace_minutes: number;
  note: string;
  quick_start: boolean;
  favorite: boolean;
  position: number;
}

export function arrivalAt(departure: number, minutes: number) {
  return new Date(departure + minutes * 60000);
}

export function defaultCheckinGrace(minutes?: number) {
  return Number.isInteger(minutes) ? Math.max(5, Math.min(30, minutes!)) : 10;
}

export function canExtendCheckin(checkin: { status: string; extensions: number; due_at: string; departed_at?: string | null; created_at: string }, extra: number, now: number) {
  const started = Date.parse(checkin.departed_at ?? checkin.created_at);
  const due = Date.parse(checkin.due_at);
  return ['active', 'alerted'].includes(checkin.status) && checkin.extensions < 5 && [15, 30, 60].includes(extra) &&
    Number.isFinite(started) && Number.isFinite(due) && Math.max(due, now) + extra * 60000 <= started + 12 * 3600000;
}

export function validateJourney(minutes: number, grace: number, departure: number, now: number) {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) throw new Error('La durata deve essere tra 5 e 720 minuti.');
  if (!Number.isInteger(grace) || grace < 5 || grace > 30) throw new Error('Il margine deve essere tra 5 e 30 minuti.');
  if (!Number.isFinite(departure) || departure > now + 24 * 3600000 || departure < now - 12 * 3600000) throw new Error('Scegli una partenza nelle ultime 12 ore o nelle prossime 24 ore.');
  if (arrivalAt(departure, minutes).getTime() <= now) throw new Error('L’arrivo previsto deve essere ancora nel futuro.');
}

export function sortedRoutes(routes: SavedRoute[]) {
  return [...routes].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.position - b.position || a.name.localeCompare(b.name, 'it'));
}

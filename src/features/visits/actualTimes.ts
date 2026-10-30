import { romeDay, romeMoment } from '../../utils/together';

export function visitTimeFields(value: string | null | undefined, fallbackDay: string) {
  const at = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(at)) return { day: fallbackDay, hour: '12:00' };
  return {
    day: romeDay(at),
    hour: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at),
  };
}

/** Actual confirmations describe events that already happened, in Rome time. */
export function visitActualTimes(startDay: string, startHour: string, endDay: string, endHour: string, hasEnd: boolean, now: number) {
  const start = romeMoment(startDay, startHour);
  if (!Number.isFinite(start)) throw new Error('Scegli una data e un’ora di inizio valide (HH:MM).');
  if (start > now) throw new Error('L’inizio effettivo non può essere nel futuro. Per programmare un incontro modifica le date previste.');
  const end = hasEnd ? romeMoment(endDay, endHour) : null;
  if (end !== null && !Number.isFinite(end)) throw new Error('Scegli una data e un’ora di fine valide (HH:MM).');
  if (end !== null && end < start) throw new Error('La fine non può precedere l’inizio dell’incontro.');
  if (end !== null && end > now) throw new Error('La fine effettiva non può essere nel futuro.');
  return { p_start: new Date(start).toISOString(), p_end: end === null ? null : new Date(end).toISOString() };
}

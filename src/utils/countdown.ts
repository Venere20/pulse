import { TimeLeft } from '../types/travel';
import { romeMoment } from './together';

/** Momento di inizio incontro: data di inizio + orario di arrivo (se indicato, es. "18:30"), altrimenti mezzanotte. */
export const visitStartMoment = (startDate: string, arrivalTime?: string | null): Date => {
  let time='00:00';
  const m = (arrivalTime || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (m) {
    const h = Math.min(23, Number(m[1]));
    const min = Math.min(59, Number(m[2]));
    time=`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  return new Date(romeMoment(startDate,time));
};

export const timeLeftUntil = (target: Date, now: number = Date.now()): TimeLeft & { done: boolean } => {
  const diff = Math.max(0, target.getTime() - now);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: diff === 0,
  };
};

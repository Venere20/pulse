import { DailyAnswer } from '../types/travel';
import { TRIVIA, TriviaQuestion } from '../data/triviaQuestions';
import { addDaysStr, dateOnly } from './dates';

const dayNumber = (day: string) => {
  const [y, m, d] = dateOnly(day).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
};

// Passo 7 è coprimo con 60: nessuna domanda si ripete prima di aver girato tutto il mazzo
export const questionForDay = (day: string): TriviaQuestion => TRIVIA[(dayNumber(day) * 7) % TRIVIA.length];

/** Ordine di visualizzazione delle opzioni (indici originali), uguale per entrambi i partner. */
export const optionOrder = (questionId: number): number[] => {
  const order = [0, 1, 2, 3];
  let seed = (questionId + 1) * 2654435761;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

export interface GameStats {
  myPoints: number;
  partnerPoints: number;
  daysPlayedTogether: number;
  bothCorrect: number;
  streak: number;
}

export const computeGameStats = (answers: DailyAnswer[], myId: string, partnerId: string, today: string): GameStats => {
  const byDay = new Map<string, { me?: DailyAnswer; partner?: DailyAnswer }>();
  answers.forEach((a) => {
    const day = dateOnly(a.day);
    const entry = byDay.get(day) || {};
    if (a.user_id === myId) entry.me = a;
    if (a.user_id === partnerId) entry.partner = a;
    byDay.set(day, entry);
  });

  let myPoints = 0;
  let partnerPoints = 0;
  let together = 0;
  let bothCorrect = 0;
  byDay.forEach((entry) => {
    if (!entry.me || !entry.partner) return; // i punti contano solo a risposte sbloccate
    together++;
    const q = TRIVIA[entry.me.question_id];
    if (!q) return;
    const meOk = entry.me.choice === q.answer;
    const partnerOk = entry.partner.choice === q.answer;
    if (meOk) myPoints++;
    if (partnerOk) partnerPoints++;
    if (meOk && partnerOk) {
      bothCorrect++;
      myPoints++;
      partnerPoints++; // bonus di squadra
    }
  });

  // Serie di giorni consecutivi in cui avete risposto entrambi (oggi non ancora giocato non spezza la serie)
  let streak = 0;
  let cursor = byDay.get(today)?.me && byDay.get(today)?.partner ? today : addDaysStr(today, -1);
  while (true) {
    const e = byDay.get(cursor);
    if (e?.me && e?.partner) {
      streak++;
      cursor = addDaysStr(cursor, -1);
    } else break;
  }

  return { myPoints, partnerPoints, daysPlayedTogether: together, bothCorrect, streak };
};

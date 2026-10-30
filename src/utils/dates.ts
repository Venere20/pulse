export const pad = (n: number) => String(n).padStart(2, '0');

export const localDateStr = (d: Date = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dateOnly = (s?: string | null) => (s ?? '').slice(0, 10);

export const parseLocalDate = (s: string) => {
  const [y, m, d] = dateOnly(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDaysStr = (s: string, days: number) => {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
};

export const daysBetween = (fromStr: string, toStr: string) =>
  Math.round((parseLocalDate(toStr).getTime() - parseLocalDate(fromStr).getTime()) / 86400000);

export const formatDateIt = (s?: string | null) => {
  if (!s) return '';
  const d = parseLocalDate(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('it-IT');
};

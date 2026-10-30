export const DATE_PICKER_MIN = '1900-01-01';
export const DATE_PICKER_MAX = '2199-12-31';
export function validPickerDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function clampPickerDate(value: string, min: string, max: string): string {
  return value < min ? min : value > max ? max : value;
}
export function movePickerMonth(month: string, amount: number): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function pickerMonthCells(month: string): (string | null)[][] {
  const date = new Date(`${month}-01T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, i) => i < offset || i >= offset + count ? null : `${month}-${String(i - offset + 1).padStart(2, '0')}`);
  return Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
export function formatPickerDate(day: string): string {
  return validPickerDate(day) ? new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Scegli una data';
}

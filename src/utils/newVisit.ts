/** Validate retrospective visits separately from upcoming plans. */
export function visitDateError(start: string | null, end: string | null, concluded: boolean, today: string): string | null {
  if (!start) return 'Scegli le date dell’incontro';
  const last = end || start;
  if (last < start) return 'La fine non può precedere l’inizio dell’incontro';
  if (concluded && last > today) return 'Un incontro già concluso non può avere date future';
  if (!concluded && start < today) return 'Per un incontro nel passato scegli «Già concluso»';
  return null;
}

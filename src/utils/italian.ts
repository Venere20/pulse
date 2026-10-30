/** Etichetta numerica con accordo al singolare e formattazione italiana. */
export function countLabel(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString('it-IT')} ${Math.abs(value) === 1 ? singular : plural}`;
}

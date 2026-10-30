import { packingCategories } from './rules';
type Category = keyof typeof packingCategories;
export function packingCategory(label: string, stored?: string, suggest = true): Category {
  if (stored && stored !== 'other' && Object.hasOwn(packingCategories, stored)) return stored as Category;
  if (!suggest) return 'other';
  const text = label.toLocaleLowerCase('it-IT');
  const matches: [Category, RegExp][] = [
    ['documents', /passaport|document|bigliett|patente|prenotazion|tessera/],
    ['health', /farmac|medicin|cerott|antidolor|integrator|termometr|insulin/],
    ['electronics', /caricator|cavo|power.?bank|telefono|cuffi|tablet|computer|adattator|fotocamer/],
    ['hygiene', /spazzolin|dentifric|shampoo|bagnoschiuma|deodorant|rasoi|sapone|crema|pettin|assorbent/],
    ['clothes', /magliett|pantalon|calzin|mutand|intimo|scarpe|giacca|felpa|pigiama|costume|cappell|sciarpa/],
  ];
  return matches.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}
export function packingGroups<T extends { label: string; category: string; checked: boolean }>(items: T[], suggest = true) {
  return Object.entries(packingCategories).map(([id, title]) => {
    const rows = items.filter(item => packingCategory(item.label, item.category, suggest) === id);
    return { id, title, items: rows, checked: rows.filter(item => item.checked).length };
  });
}

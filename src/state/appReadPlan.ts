export const APP_TABLES = ['visits', 'trip_expenses', 'settlements', 'bucket_list', 'visit_bucket_items', 'couple_settings', 'users', 'pulse_logs', 'daily_answers'] as const;
export type AppTable = typeof APP_TABLES[number];
export function appReadPlan(requested?: readonly string[], initialized = true): AppTable[] {
  if (!initialized || !Array.isArray(requested)) return [...APP_TABLES];
  const wanted = new Set(requested);
  // Concluding a visit may complete linked wishes. Read the current links with
  // the visit; the already loaded bucket stays available in the shared snapshot.
  if (wanted.has('visits')) wanted.add('visit_bucket_items');
  return APP_TABLES.filter(table => wanted.has(table));
}

import { useCallback, useMemo, useState } from 'react';

/** Only mount the next group of cards/images. Keep the complete metadata list
 * available to filtering, search and statistics. A new filter starts at page one. */
export function useProgressiveItems<T>(items: readonly T[], scope = 'all', pageSize = 12) {
  const [page, setPage] = useState({ scope, limit: pageSize });
  // Reset on every scope transition, including a return to a previously
  // expanded filter without pressing Show more in the intermediate filter.
  if (page.scope !== scope) setPage({ scope, limit: pageSize });
  const limit = page.scope === scope ? page.limit : pageSize;
  const visible = useMemo(() => items.slice(0, limit), [items, limit]);
  const showMore = useCallback(() => setPage(previous => ({ scope, limit: (previous.scope === scope ? previous.limit : pageSize) + pageSize })), [scope, pageSize]);
  return { visible, count: visible.length, total: items.length, hasMore: limit < items.length, showMore };
}

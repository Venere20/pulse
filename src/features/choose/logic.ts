import type { BucketItem } from '../../types/bucket';
export interface BucketPreference { id: string; bucket_item_id: string; user_id: string; vote: string }
export interface BucketDetail { id: string; estimated_budget: number | null; estimated_minutes: number | null }
export function chooseCandidates(items: BucketItem[], preferences: BucketPreference[], details: BucketDetail[], users: string[], category: string, budget: number | null, minutes: number | null) {
  return items.filter(item => {
    const detail = details.find(r => r.id === item.id);
    return !item.is_completed && (category === 'all' || item.category === category)
      && (budget === null || (detail?.estimated_budget != null && Number(detail.estimated_budget) <= budget))
      && (minutes === null || (detail?.estimated_minutes != null && detail.estimated_minutes <= minutes))
      && !preferences.some(r => r.bucket_item_id === item.id && users.includes(r.user_id) && r.vote === 'no');
  }).map(item => ({ item, score: users.reduce((sum, user) => sum + (preferences.find(r => r.bucket_item_id === item.id && r.user_id === user)?.vote === 'yes' ? 1 : 0), 0) }));
}
export function pickCandidate(candidates: ReturnType<typeof chooseCandidates>, random = Math.random) {
  if (!candidates.length) return null;
  const best = Math.max(...candidates.map(c => c.score)); const pool = candidates.filter(c => c.score === best);
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))].item;
}

export type BucketCategory = 'place' | 'restaurant' | 'experience' | 'goal';

export interface BucketItem {
  id: string;
  title: string;
  category: BucketCategory;
  is_completed: boolean;
  created_by: string;
  created_at: string;
  completed_at?: string | null;
}

export const CATEGORIES: { id: BucketCategory; label: string; emoji: string }[] = [
  { id: 'place', label: 'Luoghi', emoji: '✈️' },
  { id: 'restaurant', label: 'Ristoranti', emoji: '🍝' },
  { id: 'experience', label: 'Esperienze', emoji: '🎟️' },
  { id: 'goal', label: 'Traguardi', emoji: '🏆' },
];

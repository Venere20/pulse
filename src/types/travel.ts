export type VisitStatus = 'planned' | 'concluded';

export interface Visit {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  location?: string | null;
  meeting_point?: string | null;
  meeting_lat?: number | null;
  meeting_lon?: number | null;
  transport?: string | null;
  notes?: string | null;
  arrival_time?: string | null;
  hotel?: string | null;
  status?: VisitStatus;
  timing_mode?: 'scheduled' | 'manual';
  started_at?: string | null;
  ended_at?: string | null;
  is_adult?: boolean;
  travel_km?: number | null;
  journey_plan?: import('../features/journeys/model').JourneyPlan | null;
  journey_totals?: { version: 1; total_m: number; shared_m: number; out_m: number; back_m: number; meeting_point?: string | null } | null;
  travel_preferences?: Record<string, import('../features/journeys/model').TravelMode[]>;
  cover_photo_settings?: import('../features/memories/photoLayout').PhotoLayout | null;
  memory_notes?: string | null;
  memory_photos?: string[] | null;
  memory_photo_settings?: import('../features/memories/photoLayout').PhotoLayouts | null;
  cover_source?: 'personal' | 'destination' | 'default' | null;
  cover_storage_path?: string | null;
  cover_remote_url?: string | null;
  cover_attribution?: string | null;
  created_by: string;
}

export const EXPENSE_CATEGORIES = [
  { id: 'Cibo', emoji: '🍝', color: '#FF7A59' },
  { id: 'Trasporti', emoji: '🚆', color: '#4DA3FF' },
  { id: 'Alloggio', emoji: '🏨', color: '#B07CFF' },
  { id: 'Spostamenti', emoji: '🚕', color: '#2EC4B6' },
  { id: 'Attività', emoji: '🎟️', color: '#FFC947' },
  { id: 'Altro', emoji: '📌', color: '#9AA0A6' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['id'];

export interface Expense {
  id: string;
  visit_id?: string | null;
  date: string;       // YYYY-MM-DD
  title: string;
  amount: number;
  paid_by: string;
  category?: ExpenseCategory | string | null;
  created_at?: string;
}

export interface Settlement {
  id: string;
  visit_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  created_at?: string;
}

export interface DailyAnswer {
  id: string;
  day: string; // YYYY-MM-DD
  question_id: number;
  user_id: string;
  choice: number; // indice nell'ordine originale delle opzioni
  created_at?: string;
}

export interface VisitBucketLink {
  visit_id: string;
  bucket_item_id: string;
}

export interface DayDetails {
  date: string;
  visit?: Visit;
  expenses: Expense[];
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

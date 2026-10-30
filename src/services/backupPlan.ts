/** User-visible archives only: never credentials, delivery queues or upload reservations. */
export const EXTENDED_BACKUP_TABLES = [
  'story_moments', 'anniversaries', 'monthly_reflections', 'fridge_notes', 'fridge_reactions', 'fridge_reads',
  'partner_reminders', 'remote_dates', 'care_requests', 'emotional_states', 'call_log',
  'date_proposals', 'date_options', 'date_votes', 'date_proposal_wishes', 'bucket_preferences', 'bucket_details',
  'packing_defaults', 'packing_lists', 'packing_items', 'packing_progress',
  'canvas_drawings', 'canvas_current', 'badge_awards', 'badge_reads', 'feature_preferences',
  'safe_checkins', 'checkin_events', 'checkin_routes', 'partner_games', 'food_preferences',
] as const;
export const BACKUP_KEYS: Record<string, string[]> = {
  visit_bucket_items: ['visit_id', 'bucket_item_id'], couple_settings: ['user_id'], wyr_answers: ['day', 'user_id'],
  deep_talk_marks: ['week_start', 'q_index', 'user_id'], deep_talk_answers: ['week_start', 'q_index', 'user_id'],
  capsule_contents: ['capsule_id'], fridge_reactions: ['note_id', 'user_id'], fridge_reads: ['user_id'],
  date_votes: ['option_id', 'user_id'], packing_progress: ['visit_id', 'owner_id'],
  date_proposal_wishes: ['proposal_id', 'bucket_item_id'],
  badge_awards: ['badge_id'], badge_reads: ['user_id'], feature_preferences: ['user_id'],
};

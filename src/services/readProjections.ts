// Full export still reads '*'. Screen reads omit the bulky itinerary geometry/legs.
export const VISIT_SUMMARY_COLUMNS = 'id,title,start_date,end_date,location,meeting_point,meeting_lat,meeting_lon,transport,notes,arrival_time,hotel,status,timing_mode,started_at,ended_at,travel_km,journey_totals,travel_preferences,memory_notes,memory_photos,memory_photo_settings,cover_source,cover_storage_path,cover_remote_url,cover_attribution,cover_photo_settings,is_adult,created_by';
export const FEATURE_PROJECTIONS: Record<string, string> = {
  badge_defs: 'id,family,tier,title,description,emoji,metric,threshold,hidden,sort',
  badge_awards: 'badge_id,earned_on,awarded_at',
  badge_reads: 'user_id,last_seen_at',
};

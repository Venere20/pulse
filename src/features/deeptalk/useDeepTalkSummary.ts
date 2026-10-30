import { useAppDataFields } from '../../state/AppData';
import { mondayOf } from '../../utils/deepTalk';
import { useFeatureRows } from '../useFeatureRows';

export function useDeepTalkSummary() {
  const { today, userId, partnerId } = useAppDataFields(['partnerId', 'today', 'userId']);
  const week = mondayOf(today);
  const data = useFeatureRows<{ user_id: string; q_index: number; status: string }>(
    'deep_talk_marks', { column: 'week_start', value: week },
  );
  const answered = data.rows.filter(mark => mark.user_id === userId && mark.status === 'answered').length;
  const pending = data.rows.some(mark => mark.user_id === partnerId && mark.status === 'answered' &&
    !data.rows.some(own => own.user_id === userId && own.q_index === mark.q_index && own.status === 'answered'));
  return { pending, answered, loading: data.loading, error: data.error };
}

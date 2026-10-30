import { useAppDataFields } from '../../state/AppData';
import { useFeatureRows } from '../useFeatureRows';
import { Anniversary, isAnniversaryToday } from './logic';
export function useCelebrations() {
  const d = useAppDataFields(['today']); const data = useFeatureRows<Anniversary>('anniversaries');
  return { ...data, today: data.rows.filter(a => isAnniversaryToday(a, d.today)) };
}

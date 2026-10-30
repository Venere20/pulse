import { trackResult } from '../services/saveState';
import React from 'react';
import { Switch, View } from 'react-native';
import { supabase } from '../config/supabase';
import { useAppDataFields } from '../state/AppData';
import { Card, Chip, T } from '../ui/primitives';
import { useFeatureRows } from './useFeatureRows';
import { useFeatureAction } from './FeatureFrame';
interface Preferences {
    user_id: string;
    checkin_grace_minutes: number;
    checkin_notify_start: boolean;
    fridge_preview: boolean;
    badges_enabled: boolean;
    canvas_haptics: boolean;
}
export function PreferencesSection() {
    const d = useAppDataFields(['userId']);
    const data = useFeatureRows<Preferences>('feature_preferences', { column: 'user_id', value: d.userId }, '');
    const { busy, run } = useFeatureAction();
    const pref = data.rows[0] ?? { user_id: d.userId, checkin_grace_minutes: 10, checkin_notify_start: true, fridge_preview: true, badges_enabled: true, canvas_haptics: true };
    const save = (patch: Partial<Preferences>) => run(async () => { const r = await trackResult(() => supabase.from('feature_preferences').upsert({ ...pref, ...patch, user_id: d.userId, updated_at: new Date().toISOString() })); if (r.error)
        throw new Error(r.error.message); }, data.refresh);
    return <Card><T v="title">Funzioni per due</T>{data.error && <T tone="danger">{data.error}</T>}
  {([{ key: 'checkin_notify_start', label: 'Avvisa il partner quando avvio un check-in' }, { key: 'fridge_preview', label: 'Mostra anteprima dei post-it nelle notifiche' }, { key: 'badges_enabled', label: 'Celebrazioni e notifiche dei traguardi' }, { key: 'canvas_haptics', label: 'Vibrazione nella lavagna' }] as const).map(o => <View key={o.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12 }}><Switch value={pref[o.key]} disabled={busy} onValueChange={value => save({ [o.key]: value })} accessibilityLabel={o.label}/><T style={{ flex: 1 }}>{o.label}</T></View>)}
  <T tone="muted" style={{ marginTop: 12 }}>Margine predefinito dei nuovi check-in. I tragitti salvati mantengono il proprio margine.</T><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{[5, 10, 15, 30].map(m => <Chip key={m} label={`${m} minuti`} selected={pref.checkin_grace_minutes === m} onPress={() => { if (!busy)
        void save({ checkin_grace_minutes: m }); }}/>)}</View>
 </Card>;
}

import React from 'react';
import { View } from 'react-native';
import { Input, T } from '../../ui/primitives';
import { DateField } from '../../ui/DateField';
export function MomentFields({ day, time, onDay, onTime }: { day: string; time: string; onDay: (s: string) => void; onTime: (s: string) => void }) {
  return <View style={{ gap: 8 }}><DateField label="Data" value={day} onChange={onDay} /><Input label="Ora (HH:MM)" value={time} onChangeText={onTime} placeholder="20:00" maxLength={5} /><T v="caption" tone="muted">Orario di Roma, anche se siete in fusi diversi.</T></View>;
}

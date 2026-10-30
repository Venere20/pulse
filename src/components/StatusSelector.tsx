import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { STATUS_OPTIONS, UserStatus } from '../types/status';
import { Card, Chip, T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  myStatus: UserStatus | null;
  partnerStatus: UserStatus | null;
  onChange: (s: UserStatus | null,minutes?:number) => void;
}

export const StatusSelector: React.FC<Props> = ({ myStatus, partnerStatus, onChange }) => {
  const { s } = useTheme();
  const [minutes,setMinutes]=useState<number|undefined>(undefined);
  const partner = STATUS_OPTIONS.find((o) => o.id === partnerStatus);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, marginBottom: s.md }}>
        <Text style={{ fontSize: 32 }}>{partner ? partner.emoji : '💭'}</Text>
        <View style={{ flex: 1 }}>
          <T tone="muted">Stato del partner</T>
          <T v="title">{partner ? partner.label : 'Stato non impostato'}</T>
        </View>
      </View>
      <T tone="muted" style={{ marginBottom: s.sm }}>Il tuo stato</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
        {STATUS_OPTIONS.map((o) => (
          <Chip key={o.id} label={`${o.emoji} ${o.label}`} selected={myStatus === o.id} onPress={() => onChange(myStatus===o.id?null:o.id,minutes)} />
        ))}
      </View>
      <T tone="muted" style={{marginTop:s.md}}>Durata (tocca lo stato attivo per nasconderlo)</T>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:s.sm}}>
       {([{value:undefined,label:'Automatica'},{value:30,label:'30 min'},{value:120,label:'2 ore'},{value:720,label:'12 ore'},{value:1440,label:'1 giorno'},{value:10080,label:'7 giorni'}]).map(o=><Chip key={o.label} label={o.label} selected={minutes===o.value} onPress={()=>setMinutes(o.value)}/>)}
      </View>
    </Card>
  );
};

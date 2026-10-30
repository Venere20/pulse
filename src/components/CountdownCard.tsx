import { countLabel } from '../utils/italian';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Visit } from '../types/travel';
import { visitStartMoment, timeLeftUntil } from '../utils/countdown';
import { formatDateIt } from '../utils/dates';
import { togetherState } from '../utils/together';
import { Card, T } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { CityTempsBadge } from './CityTempsBadge';
import { useTheme } from '../theme/ThemeProvider';
import { VisitCover } from './VisitCover';

interface Props {
  visit: Visit | null;
  distanceKm: number | null;
  myCity?: string | null;
  partnerCity?: string | null;
  onPress: () => void;
  onCreate: () => void;
  manualTogether?:boolean;
}

const Tile: React.FC<{ value: number; label: string; strong?: boolean }> = ({ value, label, strong }) => {
  const { c, r, s } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: s.md,
        borderRadius: r.md,
        backgroundColor: strong ? c.primary : c.surfaceAlt,
      }}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <T v="h1" tone={strong ? 'onPrimary' : 'default'} style={{ fontVariant: ['tabular-nums'] }}>{String(value).padStart(2, '0')}</T>
      <T tone={strong ? 'onPrimary' : 'muted'}>{label}</T>
    </View>
  );
};

/** Countdown live (giorni, ore, minuti) verso il prossimo incontro: widget principale della home. */
export const CountdownCard: React.FC<Props> = ({ visit, distanceKm, myCity, partnerCity, onPress, onCreate,manualTogether }) => {
  const { s } = useTheme();
  const [now, setNow] = useState(()=>Date.now());

  useEffect(() => {
    if(!visit) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visit]);
  if(manualTogether&&!togetherState(visit?[visit]:[],null,now).active)return <Card accent><T v="h2">❤️ Siete insieme</T><T tone="muted">Godetevi questo tempo. Lo stato Insieme si può modificare qui sotto.</T></Card>;

  if (!visit) {
    return (
      <Card accent>
        <View style={{ alignItems: 'flex-end' }}>
          <CityTempsBadge myCity={myCity} partnerCity={partnerCity} />
        </View>
        <View style={{ alignItems: 'center', gap: s.sm, paddingVertical: s.md }}>
          <Icon name="calendar" size={32} color="#FF4D85" />
          <T v="title">Nessun incontro in programma</T>
          <T tone="muted" style={{ textAlign: 'center' }}>Scegliete le date e iniziate il conto alla rovescia.</T>
          <TouchableOpacity accessibilityRole="button" onPress={onCreate} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T tone="primary" bold>+ Pianifica un incontro</T>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }

  const start = visitStartMoment(visit.start_date, visit.arrival_time);
  const left = timeLeftUntil(start, now);
  const together=togetherState([visit],null,now);
  const started = together.active;

  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Apri incontro ${visit.title}`} activeOpacity={0.9} onPress={onPress}>
      <Card accent>
        <View style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden' }}><VisitCover visit={visit} height={130} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s.sm }}>
          <View style={{ flex: 1 }}>
            <T tone="primary" bold>{started ? 'Siete insieme' : 'Prossimo incontro'}</T>
            <T v="h2" style={{ marginTop: 2 }}>{visit.title}</T>
          </View>
          <CityTempsBadge myCity={started?visit.location:myCity} partnerCity={started?visit.location:partnerCity} />
        </View>
        <T tone="muted" style={{ marginBottom: s.md }}>
          {formatDateIt(visit.start_date)}
          {visit.end_date !== visit.start_date ? ` → ${formatDateIt(visit.end_date)}` : ''}
          {visit.meeting_point || visit.location ? ` · ${visit.meeting_point || visit.location}` : ''}
        </T>

        {started ? (
          <View style={{ alignItems: 'center', paddingVertical: s.md }}>
            <T v="h1">❤️ Giorno {together.dayIndex}{visit.timing_mode === 'manual' ? ' insieme' : ` di ${together.dayCount}`}</T>
            {together.elapsedMs!==null&&<T tone="muted">Insieme da {countLabel(Math.floor(together.elapsedMs/3600000), "ora", "ore")}{together.remainingMs !== null ? ` · ancora ${countLabel(Math.ceil(together.remainingMs/3600000), "ora", "ore")}` : ''}</T>}
          </View>
        ) : visit.timing_mode === 'manual' ? (
          <T tone="muted" style={{ textAlign: 'center', marginVertical: s.md }}>In attesa del vostro arrivo. Apri l’incontro e premi «Sono arrivato/a» per iniziare.</T>
        ) : (
          <View style={{ flexDirection: 'row', gap: s.sm }}>
            <Tile value={left.days} label={left.days === 1 ? "giorno" : "giorni"} strong />
            <Tile value={left.hours} label={left.hours === 1 ? "ora" : "ore"} />
            <Tile value={left.minutes} label={left.minutes === 1 ? "minuto" : "minuti"} />
            <Tile value={left.seconds} label={left.seconds === 1 ? "secondo" : "secondi"} />
          </View>
        )}

        {!started && distanceKm != null && (
          <T tone="muted" style={{ marginTop: s.md, textAlign: 'center' }}>
            Ora vi separano <T bold>{distanceKm} km</T>
          </T>
        )}
      </Card>
    </TouchableOpacity>
  );
};

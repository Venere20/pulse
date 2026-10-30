import React from 'react';
import { useAppDataFields } from '../../state/AppData';
import { Card, T } from '../../ui/primitives';
import { useBadges } from './Badges';
export function PulseStreakCard() {
  const { metrics, loading, error, serverDay } = useBadges();
  const d = useAppDataFields(['names','userId','partnerId']);
  const s = metrics.pulseStreak;
  return <Card><T v="title">{s.frozen ? '❄️' : '🔥'} La vostra streak · {s.current} {s.current === 1 ? 'giorno' : 'giorni'}</T>
    <T tone="muted">{loading || !serverDay ? 'In attesa del giorno italiano dal server…' : error ? 'Conteggio da aggiornare. Riprova dalla schermata Traguardi.' : s.todayComplete ? 'Oggi vi siete cercati entrambi. Giornata completata!' : s.frozen ? 'Un giorno saltato: conteggio congelato. Inviate entrambi un Pulse oggi per continuare.' : 'Per completare oggi serve almeno un Pulse da ciascuno.'}</T>
    {!loading && !error && serverDay && <><T>Tu: {s.todaySenderIds.includes(d.userId) ? '✓ Pulse inviato' : 'da inviare'} · {d.names[d.partnerId] || 'Partner'}: {s.todaySenderIds.includes(d.partnerId) ? '✓ Pulse inviato' : 'da inviare'}</T><T tone="muted">Un giorno saltato non aumenta il conteggio. Due giorni consecutivi saltati lo azzerano, al termine del secondo giorno.</T></>}
  </Card>;
}

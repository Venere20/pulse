import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ProgressBar, T } from '../../ui/primitives';
import { BottomSheet } from '../../ui/layout';
import { FeatureFrame } from '../FeatureFrame';
import { useBadges } from './Badges';
import { BadgeDef } from './metrics';
export function BadgesScreen() {
    const b = useBadges();
    const [family, setFamily] = useState('all');
    const [detail, setDetail] = useState<BadgeDef | null>(null);
    const families = Array.from(new Set(b.defs.map(d => d.family)));
    const upcoming = b.defs.filter(d => d.metric && d.threshold && !b.awards.some(a => a.badge_id === d.id) && (b.metrics.totals[d.metric] ?? 0) / Number(d.threshold) >= 0.2)
        .sort((x, y) => (b.metrics.totals[y.metric!] ?? 0) / Number(y.threshold) - (b.metrics.totals[x.metric!] ?? 0) / Number(x.threshold))[0];
    const progress = (d: BadgeDef) => d.metric && d.threshold ? Math.min(1, (b.metrics.totals[d.metric] ?? 0) / Number(d.threshold)) : 0;
    const detailAward = b.awards.find(a => a.badge_id === detail?.id);
    const total = b.defs.length + Math.max(0, 2 - b.defs.filter(d => d.hidden).length);
    return <FeatureFrame title={`Traguardi · ${b.awards.length}/${total}`} error={b.error} loading={b.loading} onRefresh={b.refresh}>
  {upcoming && <Card accent><T v="title">Prossimo: {upcoming.title}</T><T>{Math.round(b.metrics.totals[upcoming.metric!] ?? 0)} / {upcoming.threshold}</T><ProgressBar value={progress(upcoming)}/></Card>}
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label="Tutti" selected={family === 'all'} onPress={() => setFamily('all')}/>{families.map(f => <Chip key={f} label={f === 'shared_km' ? 'Km insieme' : f === 'pulse_streak' ? 'Streak Pulse' : f} selected={family === f} onPress={() => setFamily(f)}/>)}</View>
  {b.defs.filter(d => family === 'all' || family === d.family).map(def => { const award = b.awards.find(a => a.badge_id === def.id); return <Card key={def.id}><T v="h2">{award ? def.emoji : '🔒'} {def.title}</T><T tone="muted">Livello {def.tier} · {'★'.repeat(def.tier)}</T>{award ? <T tone="success">Raggiunto il {award.earned_on}</T> : <><T>{Math.round(b.metrics.totals[def.metric ?? ''] ?? 0)} / {def.threshold}</T><ProgressBar value={progress(def)}/></>}<Button variant="ghost" label="Dettagli" onPress={() => setDetail(def)}/></Card>; })}
  {family === 'all' && b.defs.filter(d => d.hidden).length < 2 && <Card><T v="title">❓ Traguardi segreti</T><T tone="muted">Sorprese ancora da scoprire: {2 - b.defs.filter(d => d.hidden).length}.</T></Card>}
  <BottomSheet visible={!!detail} title={detail?.title ?? 'Traguardo'} onClose={() => setDetail(null)}><T>{detail?.description}</T>{detailAward ? <T tone="success">Raggiunto il {detailAward.earned_on}</T> : <T tone="muted">Soglia: {detail?.threshold}. I traguardi ottenuti restano nella vostra storia.</T>}</BottomSheet>
 </FeatureFrame>;
}

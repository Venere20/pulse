import { countLabel } from '../utils/italian';
import { useScreenActive } from '../hooks/useActivity';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, T } from '../ui/primitives';
import { useAppDataFields } from '../state/AppData';
import { useBadges } from './badges/Badges';
import { useFeatureRows } from './useFeatureRows';
import { togetherState } from '../utils/together';
export function HomeFeatureLinks() {
    const active = useScreenActive();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { if (!active) return; const update = () => setNow(Date.now()); const initial = setTimeout(update, 0); const timer = setInterval(update, 60000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [active]);
    const d = useAppDataFields(['myStatus', 'userId', 'visits']);
    const proposals = useFeatureRows<{
        status: string;
    }>('date_proposals');
    const fridge = useFeatureRows<{
        created_by: string;
        updated_at: string;
        removed_at: string | null;
    }>('fridge_notes', undefined, 'updated_at');
    const reads = useFeatureRows<{
        seen_at: string;
    }>('fridge_reads', { column: 'user_id', value: d.userId }, '');
    const capsules = useFeatureRows<{
        recipient_id: string;
        status: string;
        read_at: string | null;
        unlock_kind: string;
        unlock_at: string | null;
    }>('time_capsules');
    const count = proposals.rows.filter(p => p.status === 'open').length;
    const unseen = fridge.rows.filter(n => !n.removed_at && n.created_by !== d.userId && n.updated_at > (reads.rows[0]?.seen_at ?? '2000-01-01')).length;
    const ready = capsules.rows.filter(c => c.recipient_id === d.userId && !c.read_at && (c.status === 'open' || (c.status === 'sealed' && c.unlock_kind === 'date' && Date.parse(c.unlock_at ?? '') <= now))).length;
    const together = togetherState(d.visits, d.myStatus, now);
    return <><Card><T v="title">Piccole cose per voi</T><View style={{ gap: 8, marginTop: 8 }}><Button variant="secondary" label="🔎 Cerca nei vostri ricordi" onPress={() => router.push('/ricerca')}/><Button variant="secondary" label="🔔 I tuoi avvisi" onPress={() => router.push('/avvisi')}/><Button variant="secondary" label="💞 Per noi · gesti, appuntamenti e ricordi" onPress={() => router.push('/per-noi')}/><Button variant="secondary" label={`📅 Proposte di date${count ? ` · ${countLabel(count, 'aperta', 'aperte')}` : ''}`} onPress={() => router.push('/proposte')}/><Button variant="secondary" label={`📝 Il nostro frigo${unseen ? ` · ${unseen} novità` : ''}`} onPress={() => router.push('/frigo')}/><Button variant="secondary" label="🛡️ Check-in di arrivo" onPress={() => router.push('/checkin')}/><Button variant="secondary" label="🎨 Disegniamo insieme" onPress={() => router.push('/canvas')}/></View></Card>
  {ready > 0 && <Card accent><T v="title">💌 {countLabel(ready, 'capsula da aprire', 'capsule da aprire')}</T><Button label="Scopri la sorpresa" onPress={() => router.push('/capsule')}/></Card>}
  {together.active && <Card accent><T v="title">❤️ Il vostro tempo insieme</T>{!together.visit && <T tone="muted">Hai impostato lo stato «Insieme».</T>}<View style={{ gap: 8 }}>{together.visit && <Button label="Registra una spesa" onPress={() => router.push(`/visit/${together.visit!.id}?tab=expenses`)}/>}<Button variant="secondary" label="Giocate insieme" onPress={() => router.push('/game')}/></View></Card>}
 </>;
}
export function MemoriesFeatureLinks() { const badges = useBadges(); return <View style={{ gap: 8 }}><Button variant="secondary" label="📖 La nostra storia" onPress={() => router.push('/storia')}/><Button variant="secondary" label="🗓️ Il nostro mese" onPress={() => router.push('/riepilogo')}/><Button variant="secondary" label="📊 Statistiche" onPress={() => router.push('/statistiche')}/><Button variant="secondary" label={`🏅 Traguardi${badges.enabled && badges.unseen.length ? ' · nuovi' : ''}`} onPress={() => router.push('/badge')}/><Button variant="secondary" label="💌 Capsule del tempo" onPress={() => router.push('/capsule')}/></View>; }
export function ProposalLink() { return <Button variant="secondary" label="📅 Proponi le date al partner" onPress={() => router.push('/proposte')}/>; }

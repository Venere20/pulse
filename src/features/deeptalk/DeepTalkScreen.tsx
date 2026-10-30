import { useScreenActive } from '../../hooks/useActivity';
import { useDraftField } from '../drafts/useDraftField';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AppData, useAppDataFields } from '../../state/AppData';
import { deepTalkDecks } from '../../data/deepTalkDecks';
import { deckForWeek, mondayOf } from '../../utils/deepTalk';
import { confirmAction } from '../../utils/confirm';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { useDeepTalkState } from './useDeepTalkState';

export function DeepTalkScreen() {
    const active = useScreenActive();
    const d = useAppDataFields(['userId', 'partnerId', 'today']);
    const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
    // A retained/background scene must not display previously permitted bodies
    // when it resumes. Preserve the chosen week, remount private state fresh.
    if (!active) return <FeatureFrame title="Deep Talk" loading><></></FeatureFrame>;
    return <DeepTalkContent key={`${d.userId}:${d.partnerId}`} d={d} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek}/>;
}
function DeepTalkContent({ d, selectedWeek, setSelectedWeek }: {
    d: Pick<AppData, 'userId' | 'partnerId' | 'today'>;
    selectedWeek: string | null;
    setSelectedWeek: (week: string) => void;
}) {
    const { busy, run } = useFeatureAction();
    const week = selectedWeek ?? mondayOf(d.today);
    const { marks, answers, error, loading, refresh, act } = useDeepTalkState(d.userId, d.partnerId, week, true);
    const deck = deepTalkDecks.find(v => v.id === marks.find(m => m.week_start === week)?.deck_id) ?? deckForWeek(week);
    const [drafts, setDrafts] = useDraftField<Record<string, string>>('deeptalk', 'answers', {});
    const weeks = Array.from(new Set([mondayOf(d.today), ...marks.map(m => m.week_start)])).sort().reverse();
    const editable = week <= d.today && Date.parse(week) >= Date.parse(d.today) - 14 * 86400000;
    return <FeatureFrame title="Deep Talk" error={error} loading={loading} onRefresh={refresh}>
  <Card><T v="h2">{deck.title}</T><T tone="muted">Settimana del {week}. Non c’è una risposta giusta. Saltare va bene.</T><T tone="muted">Le risposte restano private finché non rispondete entrambi. Sono conservate nel database, senza cifratura end-to-end.</T></Card>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{weeks.map(w => <Chip key={w} label={w} selected={w === week} onPress={() => setSelectedWeek(w)}/>)}</View>
  {deck.questions.map((question, q) => {
            const mine = marks.find(m => m.week_start === week && m.q_index === q && m.user_id === d.userId);
            const partner = marks.find(m => m.week_start === week && m.q_index === q && m.user_id === d.partnerId);
            const unlocked = mine?.status === 'answered' && partner?.status === 'answered';
            const own = answers.find(a => a.week_start === week && a.q_index === q && a.user_id === d.userId);
            const other = answers.find(a => a.week_start === week && a.q_index === q && a.user_id === d.partnerId);
            const key = `${d.userId}:${week}:${q}`;
            const draft = drafts[key] ?? own?.body ?? '';
            const action = (a: string, body?: string) => run(() => act(q, deck.id, a, body));
            return <Card key={`${week}:${q}`}><T v="title">{q + 1} · {question}</T>
    <T tone="muted" accessibilityLiveRegion="polite">{unlocked ? '💞 Sbloccata' : mine?.status === 'answered' ? '✓ Inviata, in attesa' : mine?.status === 'skipped' ? 'Saltata da te' : partner?.status === 'answered' ? 'Il partner ha risposto' : 'Da rispondere'}{partner?.status === 'skipped' ? ' · Saltata dal partner' : ''}</T>
    {unlocked ? <><T bold>Tu</T><T>{own?.body}</T><T bold>Partner</T><T>{other?.body ?? 'Caricamento…'}</T><View style={{ flexDirection: 'row', gap: 8 }}>{[['heart', '❤️'], ['hug', '🤗'], ['think', '🤔']].map(([r, label]) => <Chip key={r} label={label} selected={other?.reaction === r} onPress={() => action('react', r)}/>)}</View>
     <T tone="muted">Spunto a voce: quale esempio concreto ti viene in mente?</T><Button label={mine.discussed_at ? '✓ Ne avete parlato' : 'Ne abbiamo parlato'} disabled={busy || !!mine.discussed_at} onPress={() => action('discussed')}/>
    </> : editable ? <><Input label={question} value={draft} onChangeText={value => { setDrafts(v => ({ ...v, [key]: value })); }} maxLength={600} multiline/><T tone="faint">{draft.length}/600</T><Button label={own ? 'Modifica risposta' : 'Invia risposta'} disabled={busy || !draft.trim()} onPress={() => action('answer', draft)}/>{!own && <Button variant="ghost" label="Preferisco saltare" disabled={busy} onPress={() => action('skip')}/>}</> : <><T>{own?.body}</T><T tone="muted">Finestra di risposta terminata.</T></>}
    {mine && <Button variant="ghost" label="Elimina la mia risposta" disabled={busy} onPress={() => run(async () => { if (await confirmAction('Elimina risposta', 'La risposta del partner tornerà privata e la tua verrà eliminata.', 'Elimina')) {
                if (!await act(q, deck.id, 'delete')) return;
                
                setDrafts(v => { const next = { ...v }; delete next[key]; return next; });
            } })}/>}
   </Card>;
        })}
 </FeatureFrame>;
}

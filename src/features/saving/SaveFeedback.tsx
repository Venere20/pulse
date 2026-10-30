import React, { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../state/Auth';
import { T } from '../../ui/primitives';
import { drafts } from '../drafts/useDraftField';
import { saveTracker } from '../../services/saveState';
const labels = { idle: '', saving: 'Salvataggio online in corso…', saved: 'Ultima operazione salvata online ✓', failed: 'Operazione non salvata: correggi o riprova.', uncertain: 'Invio da verificare: controlla i dati quando torna la connessione, prima di inviare di nuovo.' };
export function SaveOwnerSync() { const { profile } = useAuth(); useEffect(() => { saveTracker.setOwner(profile?.id ?? ''); return () => saveTracker.setOwner(''); }, [profile?.id]); return null; }
export function SaveFeedback() {
  const { profile } = useAuth(); const owner = profile?.id ?? '';
  const phase = useSyncExternalStore(saveTracker.subscribe, () => saveTracker.snapshot(owner), () => 'idle' as const);
  const local = useSyncExternalStore(drafts.subscribe, () => drafts.status(owner), () => 'idle');
  if (!profile || (phase === 'idle' && local === 'idle')) return null;
  return <View style={{ gap: 4, paddingVertical: 4 }} accessibilityLiveRegion="polite">
    {phase !== 'idle' && <T v="caption" tone={phase === 'failed' || phase === 'uncertain' ? 'danger' : 'muted'}>{labels[phase]}</T>}
    {local !== 'idle' && <T v="caption" tone={local === 'error' ? 'danger' : 'muted'}>{local === 'saving' ? 'Conservo la bozza…' : local === 'error' ? 'Bozza non salvata sul dispositivo: non chiudere il modulo.' : 'Bozza conservata su questo dispositivo'}</T>}
  </View>;
}

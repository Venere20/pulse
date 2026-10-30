import { countLabel } from '../utils/italian';
import { trackResult } from '../services/saveState';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../config/supabase';
import { useAppDataFields } from '../state/AppData';
import { useAuth } from '../state/Auth';
import { exportBackup, BackupResult } from '../services/backup';
import { pickBackupFile, restoreBackup, RestoreSummary } from '../services/restore';
import { registerWebPush, needsIosInstall } from '../services/notification';
import { Screen, Header } from '../ui/layout';
import { Button, Card, Chip, Input, SectionTitle, T } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { confirmAction } from '../utils/confirm';
import { PreferencesSection } from '../features/PreferencesSection';
import { FoodPreferencesSection } from '../features/food/FoodPreferencesSection';

export const SettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {

  const { s, isDark } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['myCity', 'names', 'partnerCity', 'refresh', 'userId']);
  const auth = useAuth();
  const [cityDraft, setCity] = useState<string|null>(null);
  const [nameDraft, setMyName] = useState<string|null>(null);
  const city=cityDraft??d.myCity;
  const myName=nameDraft??d.names[d.userId]??'';
  const [savingProfile, setSavingProfile] = useState(false);
  const [withPhotos, setWithPhotos] = useState(true);
  const [withDeepTalk,setWithDeepTalk]=useState(false);
  const [withCapsules,setWithCapsules]=useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<BackupResult | null>(null);
  const [restored, setRestored] = useState<RestoreSummary | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);


  const saveProfile = async () => {
    if (!city.trim()) return toast.error('Scrivi la tua città');
    setSavingProfile(true);
    const cityRes = await trackResult(() => supabase.from('couple_settings').upsert({ user_id: d.userId, city: city.trim() }, { onConflict: 'user_id' }));
    let nameErr = null as string | null;
    if (myName.trim() && myName.trim() !== d.names[d.userId]) {
      const { error } = await trackResult(() => supabase.from('users').update({ name: myName.trim() }).eq('id', d.userId));
      if (error) nameErr = error.message;
    }
    setSavingProfile(false);
    if (cityRes.error) return toast.error("Impossibile aggiornare la città: " + cityRes.error.message);
    if (nameErr) return toast.error("Impossibile aggiornare il nome: " + nameErr);
    toast.success('Profilo salvato');
    d.refresh(['couple_settings', 'users']);
  };

  const backup = async () => {
    setExporting(true);
    setResult(null);
    try {
      const res = await exportBackup({ userId: d.userId, includePhotos: withPhotos,includeDeepTalk:withDeepTalk,includeCapsules:withCapsules,onProgress: setProgress });
      setResult(res);
      toast.success('Backup creato');
    } catch (e: any) {
      toast.error(e?.message || 'Backup non riuscito');
    } finally {
      setExporting(false);
      setProgress('');
    }
  };

  const restore = async () => {
    try {
      const text = await pickBackupFile();
      if (!text) return;
      const ok = await confirmAction(
        'Ripristina backup',
        'Verranno aggiunti solo i dati che mancano: niente di ciò che esiste già viene sovrascritto. Continuare?',
        'Ripristina'
      );
      if (!ok) return;
      setRestoring(true);
      setRestored(null);
      const res = await restoreBackup(text, setProgress);
      setRestored(res);
      toast.success('Ripristino completato');
      d.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Ripristino non riuscito');
    } finally {
      setRestoring(false);
      setProgress('');
    }
  };

  const enablePush = async () => {
    setEnablingPush(true);
    const res = await registerWebPush(d.userId);
    setEnablingPush(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  const changePassword = async () => {
    if (!auth.email) return;
    const err = await auth.sendPasswordReset(auth.email);
    if (err) toast.error(err);
    else toast.success('Ti abbiamo inviato il link per cambiare la password');
  };

  const logout = async () => {
    const ok = await confirmAction('Esci', 'Uscire da questo dispositivo? Finché non riaccedi non riceverai più le notifiche qui.', 'Esci');
    if (!ok) return;
    await auth.signOut();
  };

  const iosInstall = needsIosInstall();

  return (
    <Screen header={<Header title="Impostazioni" onBack={onBack} />}>
      <Card>
        <SectionTitle title="Il tuo profilo" />
        <View style={{ gap: s.md }}>
          <Input label="Il tuo nome (compare nei report PDF e nei conti)" placeholder="Es. Giovanni" value={myName} onChangeText={setMyName} />
          <Input label="La tua città" placeholder="Es. Napoli" value={city} onChangeText={setCity} />
          <T tone="muted">Città del partner: <T bold>{d.partnerCity || 'non ancora impostata'}</T></T>
          <Button label="Salva profilo" onPress={saveProfile} loading={savingProfile} variant="secondary" />
        </View>
      </Card>

      <FoodPreferencesSection />

      <Card>
        <SectionTitle title="Account" />
        <View style={{ gap: s.md }}>
          <T tone="muted">Accesso come <T bold>{auth.email || '—'}</T></T>
          <Button label="Cambia password" icon="lock" variant="secondary" onPress={changePassword} />
          <Button label="Esci da questo dispositivo" variant="danger" onPress={logout} />
        </View>
      </Card>

      {Platform.OS === 'web' && (
        <Card accent={iosInstall}>
          <SectionTitle title="Notifiche" />
          {iosInstall ? (
            <View style={{ gap: s.sm }}>
              <T bold>Prima installa l&apos;app sul tuo iPhone</T>
              <T tone="muted">1. In Safari tocca il pulsante Condividi (il quadrato con la freccia).</T>
              <T tone="muted">2. Scegli &quot;Aggiungi alla schermata Home&quot; e conferma.</T>
              <T tone="muted">3. Apri Pulse dall&apos;icona sulla Home e torna qui per attivare le notifiche.</T>
              <T tone="faint">Senza questo passaggio iOS non permette alle web app di ricevere notifiche.</T>
            </View>
          ) : (
            <Button label="Abilita notifiche" icon="message" onPress={enablePush} loading={enablingPush} />
          )}
        </Card>
      )}

      <Card>
        <SectionTitle title="Backup dei dati" />
        <T tone="muted" style={{ marginBottom: s.md }}>
          Incontri, spese, desideri, storia, ricorrenze e gli altri contenuti condivisi in un unico file. Con le foto include anche quelle della storia e le copertine personali. Deep Talk e capsule si aggiungono con le opzioni qui sotto.
        </T>
        <View style={{ flexDirection: 'row', gap: s.sm, marginBottom: s.md }}>
          <Chip label="Con le foto" selected={withPhotos} onPress={() => setWithPhotos(true)} />
          <Chip label="Senza foto" selected={!withPhotos} onPress={() => setWithPhotos(false)} />
        </View>
        <View style={{flexDirection:'row',gap:s.sm,flexWrap:'wrap',marginBottom:s.md}}>
          <Chip label={`${withDeepTalk?'✓ ':''}Archivio Deep Talk`} selected={withDeepTalk} onPress={()=>setWithDeepTalk(v=>!v)}/>
          <Chip label={`${withCapsules?'✓ ':''}Archivio capsule`} selected={withCapsules} onPress={()=>setWithCapsules(v=>!v)}/>
        </View>
        <T tone="muted">Il file contiene testi privati leggibili: conservalo con cura. Le sezioni aggiuntive, come preferenze alimentari, frigo, ricorrenze, Deep Talk e capsule, sono conservate come archivio e non vengono ripristinate automaticamente.</T>
        <Button label={exporting ? progress || 'Preparo il file...' : 'Scarica il backup'} icon="download" onPress={backup} loading={exporting} disabled={restoring} />
        {result && (
          <View style={{ marginTop: s.md, gap: 2 }}>
            <T tone="success" bold>{result.fileName} · {result.sizeMb} MB</T>
            <T tone="muted">
              {countLabel(result.rows.visits ?? 0, 'incontro', 'incontri')}, {countLabel(result.rows.trip_expenses ?? 0, 'spesa', 'spese')}, {countLabel(result.rows.bucket_list ?? 0, 'desiderio', 'desideri')}, {result.photos} foto
            </T>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: '#8884', marginVertical: s.lg }} />

        <T tone="muted" style={{ marginBottom: s.md }}>
          Ripristina i dati principali e i tuoi momenti della storia mancanti, senza sovrascrivere quelli presenti. I momenti del partner devono essere ripristinati dal suo account. Gli altri archivi restano consultabili nel file.
        </T>
        <Button label={restoring ? progress || 'Ripristino...' : 'Ripristina da file'} icon="refresh" variant="secondary" onPress={restore} loading={restoring} disabled={exporting} />
        {restored && (
          <T tone="success" bold style={{ marginTop: s.md }}>
            Elementi ripristinati: {countLabel(restored.inserted.visits ?? 0, 'incontro', 'incontri')}, {countLabel(restored.inserted.trip_expenses ?? 0, 'spesa', 'spese')}, {countLabel(restored.inserted.bucket_list ?? 0, 'desiderio', 'desideri')}, {restored.photos} foto
          </T>
        )}
        {restored && <T tone="muted">{countLabel(restored.inserted.story_moments ?? 0, 'momento ripristinato', 'momenti ripristinati')}. {restored.archiveOnly > 0 ? 'Alcune sezioni sono conservate nel file soltanto come archivio.' : ''} {restored.skippedStory > 0 ? 'I momenti del partner non sono stati modificati: deve ripristinarli dal proprio account.' : ''}</T>}
      </Card>

      <Card>
        <SectionTitle title="Perle di Giovi" />
        <T tone="muted" style={{ marginBottom: s.md }}>Uno spazio per i vostri testi, protetto da una password condivisa.</T>
        <Button label="Apri Perle di Giovi" icon="lock" variant="secondary" onPress={() => router.push('/perle-di-giovi')} />
      </Card>
      <PreferencesSection/>
      <Card>
        <SectionTitle title="Aspetto" />
        <T tone="muted">Tema attivo: {isDark ? 'scuro' : 'chiaro'}.</T>
      </Card>
    </Screen>
  );
};

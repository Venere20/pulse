import { UnsplashCover, searchVisitCovers, selectVisitCover } from '../services/unsplashCovers';
import { VisitCoverCredit } from '../components/VisitCoverCredit';
import { VisitCoverEditor } from '../components/VisitCoverEditor';
import { journeyDistance, TRAVEL_MODES } from '../features/journeys/model';
import { JourneySection } from '../features/journeys/JourneySection';
import { VisitAdultBadge } from '../components/VisitAdultBadge';
import { VisitActualTimesEditor } from '../features/visits/VisitActualTimesEditor';
import * as ImagePicker from 'expo-image-picker';
import { uploadVisitCover, removeVisitCover } from '../services/visitCovers';
import { trackResult, uncertainWrite } from '../services/saveState';
import { VisitCover } from '../components/VisitCover';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, TouchableOpacity, View } from 'react-native';
import { PackingSection } from '../features/packing/PackingSection';
import { supabase } from '../config/supabase';
import { Visit } from '../types/travel';
import { useAppDataFields, isConcluded } from '../state/AppData';
import { getCityCoordinates } from '../utils/geo';
import { computeVisitLegs, formatDuration, VisitLegs } from '../utils/routing';
import { fetchTripWeather, WeatherResult } from '../utils/weather';
import { daysBetween, formatDateIt } from '../utils/dates';
import { confirmAction } from '../utils/confirm';
import { openDirections } from '../utils/maps';
import * as NotificationService from '../services/notification';
import { InteractiveMapPicker } from '../components/InteractiveMapPicker';
import { WeatherCard } from '../components/WeatherCard';
import { ExpensesSection } from '../components/ExpensesSection';
import { MemoryEditor } from '../components/MemoryCard';
import { TravelOptions } from '../components/TravelOptions';
import { Screen, Header, SegmentedTabs, BottomSheet, IconButton } from '../ui/layout';
import { Button, Card, Chip, EmptyState, Input, SectionTitle, Skeleton, T, Row } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { useScreenActive } from '../hooks/useActivity';
import { VisitLifecycleCard } from '../features/visits/VisitLifecycleCard';
import { togetherState } from '../utils/together';
import { useVisitClock } from '../hooks/useVisitClock';

type Tab = 'overview' | 'trip' | 'expenses' | 'memories' | 'packing';
const TRANSPORTS = TRAVEL_MODES;

interface Props {
  visitId: string;
  initialTab?: Tab;
  onBack: () => void;
}

export const VisitDetailScreen: React.FC<Props> = ({ visitId, initialTab = 'overview', onBack }) => {

  const { c, s } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['bucket', 'expenses', 'loaded', 'myCity', 'partnerCity', 'partnerId', 'refresh', 'settlements', 'today', 'userId', 'visitBucket', 'visits']);
  const activeScreen = useScreenActive();
  const now = useVisitClock();
  const visit = d.visits.find((v) => v.id === visitId);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);
  const coverPending = useRef(false);
  const coverRead = useRef<AbortController | null>(null);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashSaving, setUnsplashSaving] = useState(false);
  const [unsplashPhotos, setUnsplashPhotos] =
    useState<UnsplashCover[]>([]);
  const [showUnsplash, setShowUnsplash] = useState(false);
  const [selectedUnsplash, setSelectedUnsplash] = useState<UnsplashCover | null>(null);
  const [wishOpen, setWishOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', location: '', meetingPoint: '', arrival: '', hotel: '', transport: '', notes: '', isAdult: false });
  const [wishSel, setWishSel] = useState<string[]>([]);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [legs, setLegs] = useState<VisitLegs | null>(null);

  useEffect(() => {
    const reads = coverRead;
    return () => {
      if (reads.current) { reads.current.abort(); reads.current = null; coverPending.current = false; setUnsplashLoading(false); }
    };
  }, [visitId, d.userId, activeScreen]);

  const place = visit ? visit.meeting_point || visit.location || '' : '';
  const coords = visit && visit.meeting_lat != null && visit.meeting_lon != null ? { lat: visit.meeting_lat, lon: visit.meeting_lon } : null;
  const concluded = visit ? isConcluded(visit, d.today) : false;

  const linkedIds = useMemo(() => d.visitBucket.filter((l) => l.visit_id === visitId).map((l) => l.bucket_item_id), [d.visitBucket, visitId]);
  const linkedItems = useMemo(() => d.bucket.filter((b) => linkedIds.includes(b.id)), [d.bucket, linkedIds]);
  const doneWishes = linkedItems.filter((b) => b.is_completed).map((b) => b.title);

  // Meteo e distanze usano le coordinate salvate: niente geocodifica a ogni apertura
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (!activeScreen || !visit || !place || concluded) {
      return;
    }
    const pending=setTimeout(()=>setWeatherLoading(true),0);
    fetchTripWeather(place, visit.start_date, visit.end_date, coords, controller.signal).then((w) => {
      if (alive) {
        clearTimeout(pending);
        setWeather(w);
        setWeatherLoading(false);
      }
    }).catch(() => { if (alive) setWeatherLoading(false); });
    return () => {
      alive = false; controller.abort();
      clearTimeout(pending);
    };
  }, [place, visit?.start_date, visit?.end_date, coords?.lat, coords?.lon, concluded, activeScreen]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (!activeScreen || tab !== 'trip' || !place || visit?.journey_totals || visit?.journey_plan) {
      return;
    }
    computeVisitLegs(d.myCity, d.partnerCity, place, coords, controller.signal).then((l) => alive && setLegs(l)).catch(() => {});
    return () => {
      alive = false; controller.abort();
    };
  }, [place, coords?.lat, coords?.lon, d.myCity, d.partnerCity, activeScreen, tab, visit?.journey_totals, visit?.journey_plan]);


  if (!visit && !d.loaded) {
    return (
      <Screen header={<Header title="Incontro" onBack={onBack} />}>
        <Skeleton height={120} />
        <Skeleton height={200} />
      </Screen>
    );
  }

  if (!visit) {
    return (
      <Screen header={<Header title="Incontro" onBack={onBack} />}>
        <EmptyState icon="calendar" title="Incontro non trovato" hint="Potrebbe essere stato eliminato." action={<Button label="Torna indietro" onPress={onBack} />} />
      </Screen>
    );
  }

  const choosePersonalCover = async () => {
    if (coverPending.current) return;

    coverPending.current = true;
    setCoverSaving(true);

    let uploadedPath: string | null = null;
    let writeUncertain = false;
    let saved = false;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets.length) return;

      uploadedPath = await uploadVisitCover(
        visit.id,
        result.assets[0],
      );

      const { error } = await trackResult(() =>
        supabase
          .from('visits')
          .update({
            cover_source: 'personal',
            cover_storage_path: uploadedPath,
            cover_remote_url: null,
            cover_attribution: null,
          })
          .eq('id', visit.id),
      );

      if (error) throw new Error(error.message);

      saved = true;
      toast.success('Copertina aggiornata ❤️');
      setCoverOpen(false);
      await d.refresh(['visits']);
    } catch (error) {
      writeUncertain = uncertainWrite(error);

      // Se il salvataggio potrebbe essere riuscito,
      // NON cancelliamo la nuova immagine.
      if (uploadedPath && !saved && !writeUncertain) {
        try {
          await removeVisitCover(uploadedPath);
        } catch {
          // La pulizia potrà essere eseguita in seguito.
        }
      }

      toast.error(
        writeUncertain
          ? 'Salvataggio da verificare: controlla la copertina prima di riprovare.'
          : 'Impossibile aggiornare la copertina: ' +
              (error instanceof Error
                ? error.message
                : "Errore imprevisto"),
      );
    } finally {
      coverPending.current = false;
      setCoverSaving(false);
    }
  };

  const useDefaultCover = async () => {
    if (coverPending.current) return;

    coverPending.current = true;
    setCoverSaving(true);

    try {
      const { error } = await trackResult(() =>
        supabase
          .from('visits')
          .update({
            cover_source: 'default',
            cover_storage_path: null,
            cover_remote_url: null,
            cover_attribution: null,
          })
          .eq('id', visit.id),
      );

      if (error) throw new Error(error.message);

      toast.success('Copertina predefinita ripristinata');
      setCoverOpen(false);
      await d.refresh(['visits']);
    } catch (error) {
      toast.error(
        uncertainWrite(error)
          ? 'Salvataggio da verificare: controlla la copertina prima di riprovare.'
          : 'Impossibile ripristinare la copertina: ' +
              (error instanceof Error
                ? error.message
                : "Errore imprevisto"),
      );
    } finally {
      coverPending.current = false;
      setCoverSaving(false);
    }
  };

  const findDestinationPhotos = async () => {
    if (!activeScreen || coverPending.current || coverSaving) return;
    const controller = new AbortController(); coverRead.current = controller;
  
    coverPending.current = true;
    setUnsplashLoading(true);
    setShowUnsplash(true);
    setUnsplashPhotos([]);
    setSelectedUnsplash(null);
  
    try {
      const photos = await searchVisitCovers(visit.id, controller.signal);
      if (controller.signal.aborted || coverRead.current !== controller) return;
      setUnsplashPhotos(photos);
  
      if (photos.length === 0) {
        toast.error(
          'Nessuna fotografia trovata. Puoi usare la copertina grafica.',
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(
        error instanceof Error
          ? error.message
          : 'Ricerca non disponibile',
      );
    } finally {
      if (coverRead.current === controller) {
        coverRead.current = null; coverPending.current = false; setUnsplashLoading(false);
      }
    }
  };
  
  const confirmDestinationPhoto = async (
    photo: UnsplashCover,
  ) => {
    if (coverPending.current || coverSaving) return;
  
    coverPending.current = true;
    setUnsplashSaving(true);
  
    try {
      await selectVisitCover(visit.id, photo.id);
  
      // Il salvataggio è avvenuto sul server.
      // Se il refresh fallisce, non mostriamo
      // un messaggio di "salvataggio fallito".
      toast.success('Copertina della destinazione salvata');
      setCoverOpen(false);
      setShowUnsplash(false);
      setUnsplashPhotos([]);
    setSelectedUnsplash(null);
  
      try {
        await d.refresh(['visits']);
      } catch {
        toast.error(
          'Copertina salvata. Riapri l’incontro per aggiornare la visualizzazione.',
        );
      }
    } catch (error) {
      toast.error(
        'Salvataggio da verificare: ' +
          (error instanceof Error
            ? error.message
            : 'Controlla la connessione prima di riprovare.'),
      );
    } finally {
      coverPending.current = false;
      setUnsplashSaving(false);
    }
  };

  const expenses = d.expenses.filter((e) => e.visit_id === visit.id || (!e.visit_id && e.date >= visit.start_date && e.date <= visit.end_date));
  const settlements = d.settlements.filter((x) => x.visit_id === visit.id);

  const updateTravelKm = async (name: string, c2: { lat: number; lon: number } | null) => {
    if (visit.journey_totals || visit.journey_plan) return;
    if (!d.myCity || !d.partnerCity) return;
    const legsNew = await computeVisitLegs(d.myCity, d.partnerCity, name, c2);
    if (legsNew.totalKm != null) await trackResult(() => supabase.from('visits').update({ travel_km: legsNew.totalKm }).eq('id', visit.id));
  };

  const saveMeetingPoint = async (name: string, lat: number | null, lon: number | null) => {
    const { error } = await trackResult(() => supabase.from('visits').update({ meeting_point: name, meeting_lat: lat, meeting_lon: lon }).eq('id', visit.id));
    if (error) return toast.error('Impossibile salvare l’incontro: ' + error.message);
    toast.success(`Punto d'incontro: ${name}`);
    await updateTravelKm(name, lat != null && lon != null ? { lat, lon } : null);
    d.refresh(['visits']);
  };

  const openEdit = () => {
    setForm({
      title: visit.title,
      location: visit.location || '',
      meetingPoint: visit.meeting_point || '',
      arrival: visit.arrival_time || '',
      hotel: visit.hotel || '',
      transport: visit.transport || '',
      notes: visit.notes || '',
      isAdult: visit.is_adult ?? false,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!form.title.trim()) return toast.error('Il titolo è obbligatorio');
    setSaving(true);
    const payload: Record<string, any> = {
      title: form.title.trim(),
      is_adult: form.isAdult,
      location: form.location.trim() || null,
      meeting_point: form.meetingPoint.trim() || null,
      arrival_time: form.arrival.trim() || null,
      hotel: form.hotel.trim() || null,
      transport: form.transport || null,
      notes: form.notes.trim() || null,
    };
    let newCoords = coords;
    if (form.meetingPoint.trim() !== (visit.meeting_point || '')) {
      // punto cambiato a mano: salviamo le coordinate una volta sola
      newCoords = form.meetingPoint.trim() ? await getCityCoordinates(form.meetingPoint.trim()) : null;
      payload.meeting_lat = newCoords ? newCoords.lat : null;
      payload.meeting_lon = newCoords ? newCoords.lon : null;
    }
    const { error } = await trackResult(() => supabase.from('visits').update(payload).eq('id', visit.id));
    if (error) {
      setSaving(false);
      return toast.error('Impossibile aggiornare l’incontro: ' + error.message);
    }
    const target = payload.meeting_point || payload.location;
    if (target && form.meetingPoint.trim() !== (visit.meeting_point || '')) await updateTravelKm(target, newCoords);
    try {
      await NotificationService.scheduleVisitReminder({ ...visit, ...payload } as Visit, linkedItems.filter((b) => !b.is_completed).map((b) => b.title).slice(0, 2));
    } catch (e) {}
    setSaving(false);
    setEditOpen(false);
    toast.success('Incontro aggiornato');
    d.refresh(['visits']);
  };

  const openWishes = () => {
    setWishSel(linkedIds);
    setWishOpen(true);
  };

  const saveWishes = async () => {
    setSaving(true);
    const toAdd = wishSel.filter((id) => !linkedIds.includes(id));
    const toRemove = linkedIds.filter((id) => !wishSel.includes(id));
    if (toRemove.length) await trackResult(() => supabase.from('visit_bucket_items').delete().eq('visit_id', visit.id).in('bucket_item_id', toRemove));
    if (toAdd.length) {
      const { error } = await trackResult(() => supabase.from('visit_bucket_items').insert(toAdd.map((id) => ({ visit_id: visit.id, bucket_item_id: id }))));
      if (error) {
        setSaving(false);
        return toast.error('Errore: ' + error.message);
      }
    }
    setSaving(false);
    setWishOpen(false);
    toast.success('Desideri aggiornati');
    d.refresh(['visit_bucket_items']);
  };

  const remove = async () => {
    const ok = await confirmAction('Elimina incontro', `Eliminare "${visit.title}" con tutte le sue spese e i ricordi?`, 'Elimina');
    if (!ok) return;
    // Prima l'incontro: conguagli e desideri collegati si eliminano da soli (ON DELETE CASCADE). Le spese non hanno
    // un vincolo, quindi si eliminano dopo: se l'eliminazione dell'incontro fallisce non si perde niente.
    const { error } = await trackResult(() => supabase.from('visits').delete().eq('id', visit.id));
    if (error) return toast.error("Impossibile eliminare: " + error.message);
    const { error: expError } = await trackResult(() => supabase.from('trip_expenses').delete().eq('visit_id', visit.id));
    if (expError) toast.error('Incontro eliminato, ma non le sue spese: ' + expError.message);
    NotificationService.cancelVisitReminder(visit.id);
    toast.success('Incontro eliminato');
    d.refresh(['visits', 'trip_expenses', 'settlements']);
    onBack();
  };

  const days = daysBetween(d.today, visit.start_date);
  const ongoing = !!togetherState([visit], null, now).visit;

  const detailRow = (icon: any, label: string, value?: string | null) =>
    value ? (
      <Row gap={s.md} style={{ alignItems: 'flex-start' }}>
        <Icon name={icon} size={20} color={c.primary} />
        <View style={{ flex: 1 }}>
          <T tone="muted">{label}</T>
          <T>{value}</T>
        </View>
      </Row>
    ) : null;

  return (
    <Screen
      header={
        <Header
          title="Dettaglio incontro"
          onBack={onBack}
          right={
            <IconButton
              icon="edit"
              label="Modifica incontro"
              onPress={openEdit}
            />
          }
        />
      }
    >
      <View style={{ gap: s.md }}>
        {/* Copertina: riutilizza il componente esistente. */}
        <View
          style={{
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: c.surface,
          }}
        >
          <VisitCover visit={visit} height={176} />
        </View>
        <VisitCoverCredit visit={visit} />
        {(visit.cover_source === 'personal' || visit.cover_remote_url || (!visit.cover_source && visit.memory_photos?.[0])) && <Button label="Ritaglia e ruota la copertina" icon="edit" variant="secondary" small onPress={() => setCoverCropOpen(true)} />}
        <Button
          label="Cambia copertina"
          icon="edit"
          variant="secondary"
          small
          onPress={() => setCoverOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        />

        {/* Stato e countdown. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s.sm,
          }}
        >
          <View
            style={{
              backgroundColor: c.primarySoft,
              borderRadius: 999,
              paddingHorizontal: s.md,
              paddingVertical: s.sm,
            }}
          >
            <T tone="primary" v="caption" bold>
              {concluded
                ? 'INCONTRO CONCLUSO'
                : ongoing
                  ? 'SIETE INSIEME'
                  : visit.timing_mode === 'manual'
                    ? 'IN ATTESA DEL VOSTRO ARRIVO'
                  : days === 0
                    ? "VI VEDETE OGGI"
                    : days === 1
                      ? "VI VEDETE DOMANI"
                      : `VI VEDETE TRA ${days} GIORNI`}
            </T>
          </View>
        </View>

        {/* Titolo principale. */}
        <VisitAdultBadge visible={visit.is_adult} />
        <T
          v="h2"
          accessibilityRole="header"
          style={{ fontWeight: '800' }}
        >
          {visit.title}
        </T>

        {/* Date. */}
        <Row gap={s.sm}>
          <Icon name="calendar" size={18} color={c.textMuted} />
          <T tone="muted" v="caption" style={{ flex: 1 }}>
            {formatDateIt(visit.start_date)}
            {visit.end_date !== visit.start_date
              ? ` – ${formatDateIt(visit.end_date)}`
              : ''}
          </T>
        </Row>

        {/* Destinazione, quando disponibile. */}
        {!!visit.location && (
          <Row gap={s.sm}>
            <Icon name="mapPin" size={18} color={c.textMuted} />
            <T tone="muted" v="caption" style={{ flex: 1 }}>
              {visit.location}
            </T>
          </Row>
        )}
      </View>
      <VisitLifecycleCard visit={visit} today={d.today} now={now} onChanged={() => d.refresh(['visits', 'bucket_list'])} />
      {coverCropOpen && <VisitCoverEditor key={`${visit.cover_source}:${visit.cover_storage_path}:${visit.cover_remote_url}:${visit.memory_photos?.[0]}`} visit={visit} onClose={() => setCoverCropOpen(false)} onChanged={() => d.refresh(['visits'])} />}
      <VisitActualTimesEditor visit={visit} now={now} onChanged={() => d.refresh(['visits', 'bucket_list'])} />
      <SegmentedTabs<Tab>
        tabs={[
          { key: 'overview', label: 'Panoramica' },
          { key: 'trip', label: 'Viaggio' },
          { key: 'expenses', label: 'Spese' },
          { key: 'memories', label: 'Ricordi' },
          ...(!concluded
            ? [{ key: 'packing' as const, label: 'Valigia' }]
            : []),
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab==='packing'&&!concluded&&<PackingSection visit={visit}/>}

      {tab === 'overview' && (
        <View style={{ gap: s.lg }}>
          <T v="title" accessibilityRole="header">
            Organizziamo il nostro incontro
          </T>

          {/* Informazioni principali */}
          <Card padded={false} outlined={false}>
            <View style={{ padding: s.lg, gap: s.lg }}>
              {detailRow(
                'navigation',
                'Trasporto',
                visit.transport || 'Da organizzare',
              )}

              {detailRow(
                'clock',
                'Orario di arrivo',
                visit.arrival_time || 'Da definire',
              )}

              {detailRow(
                'home',
                'Alloggio',
                visit.hotel || 'Da definire',
              )}

              {detailRow(
                'mapPin',
                "Punto d'incontro",
                visit.meeting_point || visit.location || 'Da scegliere',
              )}
            </View>
          </Card>

          {/* Accessi rapidi alle sezioni già esistenti */}
          <View style={{ flexDirection: 'row', gap: s.sm }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Apri le spese"
              onPress={() => setTab('expenses')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                minHeight: 96,
                borderRadius: 14,
                backgroundColor: c.surface,
                padding: s.md,
                justifyContent: 'center',
                gap: s.sm,
              }}
            >
              <Icon name="navigation" size={22} color={c.primary} />
              <T bold>Spese</T>
              <T tone="muted" v="caption">
                Apri il riepilogo
              </T>
            </TouchableOpacity>

            {!concluded && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Apri la valigia"
                onPress={() => setTab('packing')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  minHeight: 96,
                  borderRadius: 14,
                  backgroundColor: c.surface,
                  padding: s.md,
                  justifyContent: 'center',
                  gap: s.sm,
                }}
              >
                <Icon name="checkSquare" size={22} color={c.primary} />
                <T bold>Valigia</T>
                <T tone="muted" v="caption">
                  Prepara la lista
                </T>
              </TouchableOpacity>
            )}

            {concluded && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Apri i ricordi"
                onPress={() => setTab('memories')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  minHeight: 96,
                  borderRadius: 14,
                  backgroundColor: c.surface,
                  padding: s.md,
                  justifyContent: 'center',
                  gap: s.sm,
                }}
              >
                <Icon name="heart" size={22} color={c.primary} />
                <T bold>Ricordi</T>
                <T tone="muted" v="caption">
                  Rivivi il momento
                </T>
              </TouchableOpacity>
            )}
          </View>

          {/* Informazioni aggiuntive, mai eliminate */}
          {(visit.notes || visit.travel_km) && (
            <Card outlined={false}>
              <View style={{ gap: s.md }}>
                {detailRow('message', 'Note', visit.notes)}

                {visit.travel_km
                  ? detailRow(
                      'compass',
                      'Km per vedervi',
                      `${Math.round(Number(visit.travel_km))} km (somma dei due viaggi di andata)`,
                    )
                  : null}
              </View>
            </Card>
          )}

          {/* Desideri collegati */}
          <Card outlined={false}>
            <SectionTitle
              title="Desideri da realizzare"
              right={
                <Button
                  small
                  variant="secondary"
                  label="Gestisci"
                  icon="star"
                  onPress={openWishes}
                />
              }
            />

            {linkedItems.length === 0 ? (
              <T tone="muted">
                Collega i vostri desideri a questo incontro.
                Potrete ritrovarli nei ricordi quando saranno realizzati.
              </T>
            ) : (
              <View style={{ gap: s.md }}>
                {linkedItems.map((wish) => (
                  <Row
                    key={wish.id}
                    gap={s.md}
                    style={{ minHeight: 40 }}
                  >
                    <Icon
                      name={wish.is_completed ? 'checkSquare' : 'star'}
                      size={20}
                      color={wish.is_completed ? c.success : c.primary}
                    />
                    <T style={{ flex: 1 }}>
                      {wish.title}
                    </T>
                    {wish.is_completed && (
                      <T tone="success" bold>
                        Fatto
                      </T>
                    )}
                  </Row>
                ))}
              </View>
            )}
          </Card>

          {/* Azione distruttiva separata dal contenuto principale */}
          <Button
            label="Elimina incontro"
            icon="trash"
            variant="danger"
            onPress={remove}
          />
        </View>
      )}

      {tab === 'trip' && (
        <>
          <Card>
            <SectionTitle title="Punto d'incontro" />
            <T v="body" bold>{place || 'Non ancora scelto'}</T>
            {coords && <T tone="faint">Coordinate salvate · {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}</T>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm, marginTop: s.md }}>
              <Button small label="Scegli sulla mappa" icon="map" onPress={() => setMapOpen(true)} />
              {place ? <Button small variant="secondary" label="Indicazioni" icon="navigation" onPress={() => openDirections(place, coords)} /> : null}
            </View>
          </Card>

          <JourneySection visit={visit} onChanged={() => d.refresh(['visits'])} onSelectMeeting={saveMeetingPoint} />

          <WeatherCard weather={weather} loading={weatherLoading} />

          {place && !journeyDistance(visit).verified ? (
            <Card>
              <SectionTitle title="Distanze dal punto d'incontro" />
              {(['mine', 'partner'] as const).map((who) => {
                const leg = legs?.[who];
                return (
                  <T key={who} style={{ marginBottom: 4 }}>
                    {who === 'mine' ? `Da ${d.myCity || 'casa tua'}` : `Dal partner (${d.partnerCity || '—'})`}:{' '}
                    <T bold>
                      {leg ? `${leg.km} km${leg.source === 'road' ? ` · ~${formatDuration(leg.minutes)} in auto` : " (linea d'aria)"}` : "Calcolo in corso…"}
                    </T>
                  </T>
                );
              })}
              {legs?.totalKm != null && <T tone="muted">Insieme fate {legs.totalKm} km per vedervi.</T>}
            </Card>
          ) : null}

          <TravelOptions
            myCity={d.myCity}
            partnerCity={d.partnerCity}
            meetingPoint={place}
            startDate={visit.start_date}
            endDate={visit.end_date}
            legs={legs}
          />
        </>
      )}

      {tab === 'expenses' && (
        <ExpensesSection visit={visit} userId={d.userId} partnerId={d.partnerId} expenses={expenses} settlements={settlements} onChanged={() => { void d.refresh(['trip_expenses', 'settlements']); }} />
      )}

      {tab === 'memories' &&
        (concluded ? (
          <MemoryEditor visit={visit} doneWishes={doneWishes} onChanged={() => { void d.refresh(['visits']); }} />
        ) : (
          <Card>
            <EmptyState icon="lock" title="Il diario si apre a fine incontro" hint="Quando l'incontro sarà concluso potrete aggiungere foto, un pensiero e vedere i desideri realizzati." />
          </Card>
        ))}

      <BottomSheet
        visible={coverOpen}
        title="Cambia copertina"
        onClose={() => {
          if (coverRead.current) { coverRead.current.abort(); coverRead.current = null; coverPending.current = false; setUnsplashLoading(false); }
          if (!coverPending.current) { setCoverOpen(false); setShowUnsplash(false); setUnsplashPhotos([]); setSelectedUnsplash(null); }
        }}
      >
        <View style={{ gap: s.lg }}>
          <T tone="muted">
            Scegli una fotografia solo per questo incontro.
            Le foto dei ricordi non verranno modificate.
          </T>

          <Button
            label="Scegli dalla galleria"
            icon="camera"
            onPress={choosePersonalCover}
            loading={coverSaving}
            disabled={coverSaving || unsplashLoading || unsplashSaving}
          />

          <Button
            label="Usa la copertina predefinita"
            icon="mapPin"
            variant="secondary"
            onPress={useDefaultCover}
            disabled={coverSaving || unsplashLoading || unsplashSaving}
          />

          <View style={{ gap: s.md }}>
            <Button
              label="Foto della destinazione"
              icon="mapPin"
              variant="secondary"
              loading={unsplashLoading}
              disabled={
                coverSaving ||
                unsplashLoading ||
                unsplashSaving
              }
              onPress={findDestinationPhotos}
            />
          
            {showUnsplash && (
              <View style={{ gap: s.md }}>
                <T tone="muted" v="caption">
                  Scegli una fotografia. La copertina attuale
                  non cambierà finché non confermi.
                </T>
          
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {unsplashPhotos.slice(0, 16).map((photo, index) => (
                    <View key={photo.id} style={{ width: '25%', padding: 3 }}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Anteprima ${index + 1}: ${photo.description || 'foto della destinazione'}`}
                        accessibilityState={{ selected: selectedUnsplash?.id === photo.id }}
                        disabled={unsplashSaving || unsplashLoading || coverSaving}
                        onPress={() => setSelectedUnsplash(photo)}
                        style={{ minHeight: 44, aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
                          backgroundColor: c.surfaceAlt, borderWidth: 2,
                          borderColor: selectedUnsplash?.id === photo.id ? c.primary : 'transparent' }}
                      >
                        <Image source={{ uri: photo.preview_url }} resizeMode="contain"
                          style={{ width: '100%', height: '100%' }} />
                      </TouchableOpacity>
                      <VisitCoverCredit credit={photo} compact />
                    </View>
                  ))}
                </View>
                {selectedUnsplash && (
                  <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 14, padding: s.md, gap: s.sm }}>
                    <Image source={{ uri: selectedUnsplash.image_url }} resizeMode="contain"
                      accessibilityLabel="Fotografia selezionata intera"
                      style={{ width: '100%', height: 220 }} />
                    <VisitCoverCredit credit={selectedUnsplash} />
                    <Button label="Usa questa fotografia" loading={unsplashSaving}
                      disabled={unsplashSaving || unsplashLoading || coverSaving}
                      onPress={() => confirmDestinationPhoto(selectedUnsplash)} />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={editOpen}
        title="Modifica incontro"
        onClose={() => setEditOpen(false)}
        footer={<Button label="Salva modifiche" onPress={saveEdit} loading={saving} />}
      >
        <Input label="Titolo" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} />
        <Chip label="Etichetta +18" selected={form.isAdult} onPress={() => setForm({ ...form, isAdult: !form.isAdult })} />
        <Input label="Luogo o città" value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} />
        <Input label="Punto d'incontro" value={form.meetingPoint} onChangeText={(t) => setForm({ ...form, meetingPoint: t })} />
        <Input label="Orario di arrivo" placeholder="Es. 18:30" value={form.arrival} onChangeText={(t) => setForm({ ...form, arrival: t })} />
        <Input label="Alloggio" value={form.hotel} onChangeText={(t) => setForm({ ...form, hotel: t })} />
        <T tone="muted">Trasporto</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
          {TRANSPORTS.map((t) => (
            <Chip key={t} label={t} selected={form.transport === t} onPress={() => setForm({ ...form, transport: form.transport === t ? '' : t })} />
          ))}
        </View>
        <Input label="Note" multiline value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      </BottomSheet>

      <BottomSheet
        visible={wishOpen}
        title="Desideri per questo incontro"
        onClose={() => setWishOpen(false)}
        footer={<Button label="Salva" onPress={saveWishes} loading={saving} />}
      >
        {d.bucket.filter((b) => !b.is_completed || linkedIds.includes(b.id)).length === 0 ? (
          <T tone="muted">La lista dei desideri è vuota. Aggiungi un desiderio nella sezione Desideri.</T>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
            {d.bucket
              .filter((b) => !b.is_completed || linkedIds.includes(b.id))
              .map((b) => (
                <Chip
                  key={b.id}
                  label={b.title}
                  icon={wishSel.includes(b.id) ? 'check' : undefined}
                  selected={wishSel.includes(b.id)}
                  onPress={() => setWishSel((w) => (w.includes(b.id) ? w.filter((x) => x !== b.id) : [...w, b.id]))}
                />
              ))}
          </View>
        )}
      </BottomSheet>

      <Modal visible={mapOpen} transparent animationType="fade" onRequestClose={() => setMapOpen(false)}>
        {mapOpen && (
          <InteractiveMapPicker
            myCity={d.myCity}
            partnerCity={d.partnerCity}
            currentMeetingPoint={place}
            onSelectLocation={(name, lat, lon) => {
              setMapOpen(false);
              saveMeetingPoint(name, lat, lon);
            }}
            onClose={() => setMapOpen(false)}
          />
        )}
      </Modal>
    </Screen>
  );
};

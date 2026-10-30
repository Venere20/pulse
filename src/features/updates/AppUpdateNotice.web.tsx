import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { useAppForeground } from '../../hooks/useActivity';
import { useAppDataFields } from '../../state/AppData';
import { saveTracker } from '../../services/saveState';
import { drafts } from '../drafts/useDraftField';
import { Button, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from '../../ui/Toast';
import { bootIdentity, fetchBootIdentity } from './webIdentity';
import { updateCanRestart, updateSafeRoute } from './updateSafety';
import { updateProtection } from './updateProtection';

export function AppUpdateNotice() {
  const active = useAppForeground(); const pathname = usePathname();
  const { userId } = useAppDataFields(['userId']); const { c, r, s } = useTheme(); const { width } = useWindowDimensions();
  const save = useSyncExternalStore(saveTracker.subscribe, () => saveTracker.snapshot(userId), () => 'idle' as const);
  const draft = useSyncExternalStore(drafts.subscribe, () => drafts.status(userId), () => 'idle');
  const protectedWork = useSyncExternalStore(updateProtection.subscribe, updateProtection.blocked, () => false);
  const [installed] = useState(() => typeof document === 'undefined' ? null : bootIdentity([...document.scripts].map(script => script.getAttribute('src') || script.getAttribute('data-demo-src') || ''), location.origin));
  const [available, setAvailable] = useState<string | null>(null); const [dismissed, setDismissed] = useState<string | null>(null);
  const [applying, setApplying] = useState(false); const verification = useRef<AbortController | null>(null);
  const mounted = useRef(true); const toast = useToast();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; verification.current?.abort(); }; }, []);
  useEffect(() => {
    if (!active || !installed) return;
    let live = true; let timer: ReturnType<typeof setTimeout>; let request: AbortController | null = null;
    const check = async () => {
      const controller = new AbortController(); request = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const identity = await fetchBootIdentity(location.origin, controller.signal);
        if (live && !controller.signal.aborted) setAvailable(identity && identity !== installed ? identity : null);
      } catch { /* Offline/missing deployment: keep the running app and try later. */ }
      finally { clearTimeout(timeout); if (request === controller) request = null; if (live) timer = setTimeout(() => { void check(); }, 600000); }
    };
    timer = setTimeout(() => { void check(); }, 5000);
    return () => { live = false; clearTimeout(timer); request?.abort(); verification.current?.abort(); };
  }, [active, installed]);
  if (!active || !available || available === dismissed || !updateSafeRoute(pathname)) return null;
  const canRestart = !applying && !protectedWork && updateCanRestart(pathname, save, draft);
  const apply = async () => {
    drafts.flush();
    if (verification.current || updateProtection.blocked() || !updateCanRestart(location.pathname, saveTracker.snapshot(userId), drafts.status(userId))) return;
    const controller = new AbortController(); verification.current = controller; setApplying(true);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const identity = await fetchBootIdentity(location.origin, controller.signal);
      if (!identity) throw new Error('Deployment unavailable');
      if (identity === installed) { if (mounted.current) setAvailable(null); return; }
      drafts.flush();
      if (!mounted.current || controller.signal.aborted || document.hidden || updateProtection.blocked() || !updateCanRestart(location.pathname, saveTracker.snapshot(userId), drafts.status(userId))) return;
      window.location.reload();
    } catch {
      if (mounted.current && !controller.signal.aborted) toast.error('Non riesco ad aggiornare ora. Riprova più tardi.');
    } finally {
      clearTimeout(timeout); if (verification.current === controller) verification.current = null;
      if (mounted.current) setApplying(false);
    }
  };
  const side = Math.max(s.lg, (width - 688) / 2);
  return <View accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: 84, left: side, right: side, zIndex: 50, backgroundColor: c.surface, borderColor: c.primary, borderWidth: 1, borderRadius: r.lg, padding: s.md, gap: s.sm }}>
    <T v="title">Nuova versione disponibile</T>
    <T tone="muted">Aggiorna Pulse quando ti è comodo.</T>
    {!canRestart && <T v="caption" tone="muted">Completa l’attività in corso o verifica il salvataggio prima di aggiornare.</T>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
      <Button label="Aggiorna Pulse" loading={applying} disabled={!canRestart} onPress={apply} />
      <Button label="Più tardi" variant="ghost" onPress={() => setDismissed(available)} />
    </View>
  </View>;
}

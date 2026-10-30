import { useScreenActive } from '../../hooks/useActivity';
import { trackResult } from '../../services/saveState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Surface, Drawing } from './Surface';
import * as Haptics from 'expo-haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { confirmAction } from '../../utils/confirm';
import { router } from 'expo-router';

import { useToast } from '../../ui/Toast';
import { CanvasPacket, Stroke, canvasColors, canvasPalette, validCanvasPacket } from './protocol';
import { CanvasTool, ShapeTool, canvasTools, canvasPoint, shapePoints, hasShapeSize } from './tools';
import { appendErasures, erasePortion, ERASER_RADIUS } from './eraser';
import { useUpdateProtection } from '../updates/useUpdateProtection';
import { Screen, Header, BottomSheet, IconButton } from '../../ui/layout';
import { Icon, IconName } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useInsets } from '../../ui/safeArea';
import { BoardSnapshot, createPersistentBoard } from './persistentBoard';
import { draftStorage } from '../../services/drafts/storage';
import { useDraftField } from '../drafts/useDraftField';
export { Drawing } from './Surface';
interface Saved {
    id: string;
    caption: string | null;
    strokes: Stroke[];
    created_at: string;
}
type Panel = 'colors' | 'brush' | 'width' | 'more' | 'save' | 'gallery' | 'help' | 'clearConfirm' | 'deleteConfirm' | null;
const panelTitles = {
    colors: 'Scegli un colore', brush: 'Pennello e strumenti', width: 'Spessore del tratto',
    more: 'Altre azioni', save: 'Salva nella galleria', gallery: 'Galleria condivisa', help: 'Come funziona',
    clearConfirm: 'Pulisci lavagna', deleteConfirm: 'Elimina disegno',
};
function ToolbarAction({ icon, label, onPress, selected = false, disabled }: {
    icon: IconName; label: string; onPress: () => void; selected?: boolean; disabled?: boolean;
}) {
    const { c, r } = useTheme();
    return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ selected, disabled: !!disabled }} disabled={disabled} onPress={onPress} activeOpacity={0.8}
        style={{ flex: 1, minWidth: 0, minHeight: 65, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: r.md, backgroundColor: selected ? c.primarySoft : c.surface }}>
        <Icon name={icon} size={22} color={c.primary} />
        <T numberOfLines={1} style={{ fontSize: 11, color: c.textMuted, fontWeight: '600' }}>{label}</T>
    </TouchableOpacity>;
}
function MenuAction({ icon, title, detail, onPress, destructive = false, disabled }: {
    icon: IconName; title: string; detail: string; onPress: () => void; destructive?: boolean; disabled?: boolean;
}) {
    const { c, r, s } = useTheme();
    return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, padding: s.md, minHeight: 60, borderRadius: r.md, backgroundColor: c.surfaceAlt }}>
        <Icon name={icon} size={22} color={destructive ? c.danger : c.primary} />
        <View style={{ flex: 1, gap: 3 }}><T bold tone={destructive ? 'danger' : 'default'}>{title}</T><T v="caption" tone="muted">{detail}</T></View>
        <Icon name="chevronRight" size={19} color={c.textFaint} />
    </TouchableOpacity>;
}
export function CanvasScreen() {

    const screenActive = useScreenActive();
    const d = useAppDataFields(['partnerId', 'userId']);
    const { c, s, r } = useTheme();
    const insets = useInsets();
    const { width: windowWidth } = useWindowDimensions();
    const [panel, setPanel] = useState<Panel>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [stage, setStage] = useState({ width: 0, height: 0 });
    const gallery = useFeatureRows<Saved>('canvas_drawings');
    const currentBoard = useFeatureRows<BoardSnapshot>('canvas_current', undefined, '');
    const boardRealtime = useRef(false);
    useEffect(() => {
        // A live subscription does not guarantee the initial REST snapshot loaded.
        // Keep recovery reads until a snapshot succeeds, and after read failures.
        boardRealtime.current = currentBoard.realtimeConnected && currentBoard.hasSnapshot && !currentBoard.error;
    }, [currentBoard.realtimeConnected, currentBoard.hasSnapshot, currentBoard.error]);
    const persistence = useMemo(() => createPersistentBoard(d.userId, d.partnerId, draftStorage, async op => {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
        try { return await featureRpc<BoardSnapshot>('apply_canvas_board', { p_epoch: op.epoch, p_action: op.action, p_stroke: op.action === 'erase' ? { erasures: op.erasures } : op.stroke ?? null, p_id: op.id ?? null }, false, controller.signal); }
        finally { clearTimeout(timeout); }
    }), [d.userId, d.partnerId]);
    const [durable, setDurable] = useState({ ready: false, pending: false, localSaved: true, error: '' });
    const boardEpoch = useRef<number | null>(null);
    const prefs = useFeatureRows<{
        canvas_haptics: boolean;
    }>('feature_preferences', { column: 'user_id', value: d.userId }, '');
    const { busy, run } = useFeatureAction();
    const toast = useToast();
    const [drawing, setDrawing] = useState(false);
    const drawingEnabled = panel === null;
    const [tool, setTool] = useState<CanvasTool>('draw');
    const pointCount = useRef(0);
    const renderCache = useRef(new Map<string, { source: Stroke; length: number; snapshot: Stroke }>());
    const renderTimer = useRef<number | null>(null);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [color, setColor] = useState<string>(canvasColors[0]);
    const [width, setWidth] = useState<3 | 6 | 12>(6);
    const [brush, setBrush] = useState<'ink' | 'neon'>('ink');
    const [ephemeral, setEphemeral] = useState(false);
    const [connected, setConnected] = useState(false);
    const [partnerOnline, setPartnerOnline] = useState(false);
    const [caption, setCaption] = useDraftField('canvas', 'caption', '');
    useUpdateProtection(drawing || durable.pending && !durable.localSaved);
    const board = useRef<Stroke[]>([]);
    const active = useRef<Stroke | null>(null);
    const shapeGesture = useRef<{ tool: ShapeTool; start: readonly number[]; stroke: Stroke } | null>(null);
    const erasing = useRef(false);
    const lastErasePoint = useRef<readonly number[] | null>(null);
    const eraseChanges = useRef(new Map<string, number[]>());
    const lastCheckpoint = useRef('');

    const channel = useRef<RealtimeChannel | null>(null);
    const outgoing = useRef<Omit<CanvasPacket, 'v' | 'author' | 'session' | 'seq'>[]>([]);
    const sequence = useRef(0);
    const tombstones = useRef(new Set<string>());
    const lastHaptic = useRef(0);
    const online = useRef(false);
    const sentOffset = useRef(0);
    const [session] = useState(() => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    const lastSend = useRef(0);
    const hapticsEnabled = useRef(true);
    useEffect(() => { hapticsEnabled.current = prefs.rows[0]?.canvas_haptics !== false; }, [prefs.rows]);
    const update = () => {
        if (renderTimer.current !== null) return;
        renderTimer.current = requestAnimationFrame(() => {
            renderTimer.current = null;
            pointCount.current = board.current.reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
            const next = board.current.map(stroke => {
                const cached = renderCache.current.get(stroke.id);
                if (cached?.source === stroke && cached.length === stroke.points.length) return cached.snapshot;
                const snapshot = { ...stroke, points: [...stroke.points] };
                renderCache.current.set(stroke.id, { source: stroke, length: stroke.points.length, snapshot }); return snapshot;
            });
            const ids = new Set(next.map(stroke => stroke.id)); for (const id of renderCache.current.keys()) if (!ids.has(id)) renderCache.current.delete(id);
            setStrokes(shapeGesture.current ? [...next, shapeGesture.current.stroke] : next);
        });
    };
    useEffect(() => {
        const sync = () => {
            const view = persistence.view();
            const changedEpoch = boardEpoch.current !== null && view.epoch !== null && boardEpoch.current !== view.epoch;
            boardEpoch.current = view.epoch;
            const removed = new Set(view.deleted_ids);
            const rows = new Map(view.strokes.map(s => [s.id, s]));
            if (!changedEpoch) for (const s of board.current) {
                if (!removed.has(s.id) && (s === active.current || s.ephemeral || !rows.has(s.id) || rows.get(s.id)!.points.length < s.points.length)) rows.set(s.id, s);
                else if (!removed.has(s.id) && s.erasures?.length && rows.has(s.id)) rows.set(s.id, appendErasures(rows.get(s.id)!, s.erasures));
            }
            else { eraseChanges.current.clear(); active.current = null; shapeGesture.current = null; erasing.current = false; outgoing.current = []; setDrawing(false); tombstones.current.clear(); }
            for (const id of removed) tombstones.current.add(id);
            board.current = [...rows.values()];
            setDurable({ ready: view.ready, pending: view.pending, localSaved: view.localSaved, error: view.error });
            update();
        };
        const unsubscribe = persistence.subscribe(sync); const initial = setTimeout(sync, 0);
        return () => { clearTimeout(initial); unsubscribe(); };
        // The controller owns the durable state; renderer refs stay live across callbacks.
    }, [persistence]);
    useEffect(() => { if (currentBoard.rows[0]) { persistence.receive(currentBoard.rows[0]); void persistence.flush(); } }, [currentBoard.rows, persistence]);
    const flushErasing = () => {
        const changes = [...eraseChanges.current]; eraseChanges.current.clear();
        for (const [id, cuts] of changes) {
            try { persistence.erase(id, cuts); }
            catch (error) { eraseChanges.current.set(id, [...cuts, ...(eraseChanges.current.get(id) ?? [])]); toast.error(error instanceof Error ? error.message : 'Cancellazione non salvata'); }
        }
    };
    const checkpoint = () => {
        const s = active.current;
        if (!s || s.ephemeral) return;
        const signature = s.id + ':' + s.points.length;
        if (signature === lastCheckpoint.current) return;
        try { persistence.put(s); lastCheckpoint.current = signature; }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Salvataggio della lavagna non riuscito'); }
    };
    const emit = (p: Omit<CanvasPacket, 'v' | 'author' | 'session' | 'seq'>) => { if (!online.current || outgoing.current.length >= 200) return false;
        outgoing.current.push(p); return true; };
    const replay = () => { for (const stroke of board.current.filter(s => s.author === d.userId)) {
        for (let i = 0; i < stroke.points.length; i += 200)
            emit({ kind: 'stroke', id: stroke.id, color: stroke.color, width: stroke.width, brush: stroke.brush, ephemeral: !!stroke.ephemeral, offset: i, points: stroke.points.slice(i, i + 200) });
        for (let i = 0; i < (stroke.erasures?.length ?? 0); i += 200) emit({ kind: 'erase', id: stroke.id, points: stroke.erasures!.slice(i, i + 200) });
    } };
    useEffect(() => {
        if (!screenActive) return;
        let disposed = false;
        const seen = new Map<string, number>();
        const rate = new Map<string, {
            time: number;
            count: number;
        }>();
        const ch = supabase.channel('canvas:couple', { config: { private: true, broadcast: { self: false }, presence: { key: d.userId } } });
        channel.current = ch;
        ch.on('broadcast', { event: 'draw' }, ({ payload }) => {
            if (!validCanvasPacket(payload, [d.userId, d.partnerId]) || payload.author === d.userId)
                return;
            const p = payload;
            const epoch = persistence.view().epoch;
            if (p.kind !== 'hello' && epoch !== null && (p.epoch !== undefined ? p.epoch !== epoch : epoch > 1)) return;
            const key = p.author + ':' + p.session;
            const prior = seen.get(key) ?? -1;
            if (p.seq <= prior)
                return;
            seen.set(key, p.seq);
            const now = Date.now();
            const r = rate.get(p.author);
            if (r && now - r.time < 1000) {
                if (++r.count > 25)
                    return;
            }
            else
                rate.set(p.author, { time: now, count: 1 });
            if (p.kind === 'hello') {
                replay();
                return;
            }
            if (p.kind === 'clear') {
                for (const id of p.ids ?? [])
                    tombstones.current.add(id);
                board.current = board.current.filter(s => !tombstones.current.has(s.id));
            }
            else if (p.kind === 'undo') {
                tombstones.current.add(p.id!);
                board.current = board.current.filter(s => s.id !== p.id);
            }
            else if (p.kind === 'erase') {
                board.current = board.current.map(stroke => stroke.id === p.id && stroke.author === p.author ? appendErasures(stroke, p.points!) : stroke);
            }
            else {
                if (tombstones.current.has(p.id!))
                    return;
                let stroke = board.current.find(s => s.id === p.id);
                if (p.offset === 0) {
                    if (!stroke && board.current.length >= 60)
                        return;
                    stroke = { id: p.id!, author: p.author, color: p.color!, width: p.width as 3 | 6 | 12, brush: p.brush as 'ink' | 'neon', points: [], ephemeral: p.ephemeral, expiresAt: p.ephemeral ? now + 10000 : undefined };
                    board.current = board.current.filter(s => s.id !== p.id);
                    board.current.push(stroke);
                }
                if (!stroke || stroke.points.length !== p.offset)
                    return;
                if (board.current.reduce((sum, s) => sum + s.points.length / 2, 0) + p.points!.length / 2 > 3000)
                    return;
                stroke.points.push(...p.points!);
                if (stroke.ephemeral)
                    stroke.expiresAt = now + 10000;
                if (hapticsEnabled.current && Platform.OS !== 'web' && now - lastHaptic.current > 1000) {
                    lastHaptic.current = now;
                    void Haptics.selectionAsync().catch(() => { });
                }
            }
            update();
        }).on('presence', { event: 'sync' }, () => setPartnerOnline(Object.keys(ch.presenceState()).includes(d.partnerId)))
            .subscribe(status => { const ready = status === 'SUBSCRIBED'; online.current = ready; if (!disposed)
            setConnected(ready); if (ready) {
            void ch.track({ user_id: d.userId });
            emit({ kind: 'hello' });
            replay();
        } });
        const flush = setInterval(() => { const packet = outgoing.current.shift(); if (packet && online.current)
            void ch.send({ type: 'broadcast', event: 'draw', payload: { ...packet, ...(persistence.view().epoch !== null ? { epoch: persistence.view().epoch } : {}), v: 1, author: d.userId, session, seq: ++sequence.current } }); }, 50);
        const durableFlush = setInterval(() => { checkpoint(); void persistence.flush(); }, 750);
        const durableRefresh = setInterval(() => { if (!boardRealtime.current) void currentBoard.refresh(); }, 10000);
        const fade = setInterval(() => { const now = Date.now(); const next = board.current.filter(s => !s.ephemeral || (s.expiresAt ?? 0) > now); if (next.length !== board.current.length) {
            board.current = next;
            update();
        } }, 500);
        const foreground=AppState.addEventListener('change',state=>{flushErasing();checkpoint();void persistence.flush();if(state==='active'){void currentBoard.refresh();if(online.current){emit({kind:'hello'});replay();}}else{shapeGesture.current=null;erasing.current=false;setDrawing(false);update();}});
        return () => { flushErasing();checkpoint();void persistence.flush();disposed = true; online.current = false; outgoing.current = []; foreground.remove();clearInterval(flush);clearInterval(durableFlush);clearInterval(durableRefresh); clearInterval(fade); if(renderTimer.current !== null)cancelAnimationFrame(renderTimer.current); renderTimer.current = null; void supabase.removeChannel(ch); };
        // Rejoin only when account changes. Board and transport queues are mutable session state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [d.userId, d.partnerId, session, screenActive, persistence]);
    const sendActive = (force = false) => { const now = Date.now(); if (!force && now - lastSend.current < 50)
        return; lastSend.current = now; const s = active.current; if (!s)
        return; for (let i = sentOffset.current; i < s.points.length; i += 200)
        { const points = s.points.slice(i, i + 200); if (!emit({ kind: 'stroke', id: s.id, color: s.color, width: s.width, brush: s.brush, ephemeral: !!s.ephemeral, offset: i, points })) break; sentOffset.current = i + points.length; } };
    const addPoint = (x: number, y: number) => {
        const s = active.current;
        if (!s)
            return;
        const point = [canvasPoint(x), canvasPoint(y)];
        if (s.points.length && Math.abs(point[0] - s.points[s.points.length - 2]) + Math.abs(point[1] - s.points[s.points.length - 1]) < 1)
            return;
        if (pointCount.current >= 3000)
            return;
        s.points.push(...point);
        pointCount.current++;
        if (s.ephemeral)
            s.expiresAt = Date.now() + 10000;
        update();
    };
    const eraseStroke = (stroke: Stroke) => {
        if (stroke.author !== d.userId) return;
        tombstones.current.add(stroke.id);
        board.current = board.current.filter(s => s.id !== stroke.id);
        // Do not send queued points for an erased stroke after its tombstone.
        outgoing.current = outgoing.current.filter(p => p.kind !== 'stroke' || p.id !== stroke.id);
        if (!stroke.ephemeral) persistence.undo(stroke.id);
        emit({ kind: 'undo', id: stroke.id });
        update();
    };
    const eraseAt = (x: number, y: number) => {
        const last = lastErasePoint.current;
        const end = [canvasPoint(x), canvasPoint(y)];
        if (last && Math.hypot(end[0] - last[0], end[1] - last[1]) < 4) return;
        const cut = [...(last ?? end), ...end, ERASER_RADIUS];
        lastErasePoint.current = end;
        board.current = board.current.map(stroke => {
            const next = erasePortion(stroke, d.userId, cut);
            if (next === stroke) return stroke;
            if (!stroke.ephemeral) eraseChanges.current.set(stroke.id, [...(eraseChanges.current.get(stroke.id) ?? []), ...cut]);
            emit({ kind: 'erase', id: stroke.id, points: cut }); return next;
        });
        update();
    };
    const grant = (x: number, y: number) => {
        if (!drawingEnabled) return;
        if (tool === 'eraser') { erasing.current = true; lastErasePoint.current = null; setDrawing(true); eraseAt(x, y); return; }
        pointCount.current = board.current.reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
        if (board.current.length >= 60 || pointCount.current >= 3000) { toast.error('Lavagna piena: salva il disegno e pulisci per continuare.'); return; }
        setDrawing(true);
        const stroke: Stroke = { id: d.userId + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: d.userId, color, width, brush, points: [], ephemeral, expiresAt: ephemeral ? Date.now() + 10000 : undefined };
        if (tool !== 'draw') {
            const start = [canvasPoint(x), canvasPoint(y)];
            shapeGesture.current = { tool, start, stroke: { ...stroke, points: shapePoints(tool, start, start) } };
            update(); return;
        }
        active.current = stroke; board.current.push(stroke); sentOffset.current = 0; addPoint(x, y); sendActive(true);
    };
    const move = (x: number, y: number) => {
        if (erasing.current) { eraseAt(x, y); return; }
        const gesture = shapeGesture.current;
        if (gesture) {
            gesture.stroke = { ...gesture.stroke, points: shapePoints(gesture.tool, gesture.start, [x, y]) };
            update(); return;
        }
        addPoint(x, y); sendActive();
    };
    const save = () => run(async()=>{
        const snapshot=board.current.filter(s=>!s.ephemeral).map(s=>({...s,points:[...s.points]}));
        await featureRpc('save_canvas',{p_strokes:snapshot,p_caption:caption});
        setPanel(null);
        toast.success('Disegno salvato nella galleria');
    },gallery.refresh);
    const release = () => {
        flushErasing();
        erasing.current = false;
        lastErasePoint.current = null;
        const gesture = shapeGesture.current; shapeGesture.current = null;
        if (gesture && hasShapeSize(gesture.stroke.points)) {
            const points = board.current.reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
            if (board.current.length >= 60 || points + gesture.stroke.points.length / 2 > 3000) toast.error('Lavagna piena: salva il disegno e pulisci per continuare.');
            else {
                const stroke = { ...gesture.stroke, expiresAt: gesture.stroke.ephemeral ? Date.now() + 10000 : undefined };
                board.current.push(stroke); active.current = stroke; sentOffset.current = 0;
            }
        }
        sendActive(true); checkpoint(); active.current = null; setDrawing(false); update();
    };
    const leave = () => run(async()=>{
        if(active.current || shapeGesture.current || erasing.current)release();await persistence.flush();
        const state=persistence.view();
        if(state.pending&&!state.localSaved&&!(await confirmAction('Lavagna non sincronizzata','Il salvataggio sul dispositivo non è riuscito. Uscendo potresti perdere le ultime modifiche. Vuoi uscire comunque?','Esci')))return;
        if(router.canGoBack())router.back();else router.replace('/');
    });
    const finishGesture = () => { if (active.current || shapeGesture.current || erasing.current) release(); };
    const openPanel = (next: Exclude<Panel, null>) => { finishGesture(); setPanel(next); };
    const closePanel = () => { if (!busy) setPanel(null); };
    const undo = () => {
        finishGesture();
        const last = [...board.current].reverse().find(stroke => stroke.author === d.userId);
        if (last) eraseStroke(last); else toast.error('Nessun tratto da annullare');
    };
    const clear = () => run(async () => {
        const ids = board.current.map(stroke => stroke.id);
        ids.forEach(id => tombstones.current.add(id));
        board.current = []; persistence.clear(); outgoing.current = [];
        emit({ kind: 'clear', ids }); update(); setPanel(null);
    });
    const sendPulse = () => run(async () => {
        const result = await trackResult(() => supabase.from('pulse_logs').insert({ sender_id: d.userId, type: 'thinking', message: null, reply_to: null }));
        if (result.error) throw new Error(result.error.message);
        toast.success('Pulse inviato'); setPanel(null);
    });
    const canvasSize = Math.max(0, Math.min(stage.width, stage.height, 540));
    const pointsShown = strokes.reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
    const permanent = strokes.filter(stroke => !stroke.ephemeral);
    const selectedTool = canvasTools.find(item => item.id === tool)?.label ?? 'Mano libera';
    const syncError = currentBoard.error || durable.error;
    const savedLabel = durable.pending
        ? durable.localSaved ? 'Sul dispositivo · sincronizzazione in attesa' : 'Salvataggio in attesa · apri i dettagli'
        : durable.ready ? 'Lavagna salvata automaticamente' : 'Caricamento della lavagna…';
    return <Screen scroll={false} showSaveFeedback={false}
        contentStyle={{ paddingHorizontal: s.md, paddingTop: s.sm, paddingBottom: Math.max(insets.bottom, s.sm), gap: 0 }}
        header={<Header title="Lavagna" subtitle={windowWidth >= 390 ? 'Disegniamo insieme' : undefined} onBack={() => { void leave(); }} right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.xs }}>
                <Button label="Salva" variant="secondary" small onPress={() => openPanel('save')} disabled={busy} />
                <IconButton icon="image" label="Galleria condivisa" onPress={() => openPanel('gallery')} />
            </View>
        } />}>
        <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 580, alignSelf: 'center' }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Stato della lavagna e sincronizzazione" onPress={() => openPanel('help')}
                style={{ minHeight: 52, justifyContent: 'center', gap: 3, paddingBottom: s.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
                    <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: connected ? c.success : c.warning }} />
                    <T v="caption" tone="muted" style={{ flex: 1 }}>{connected ? partnerOnline ? 'Il partner è qui 💞' : 'Live connesso · partner non presente' : 'Connessione live non disponibile'}</T>
                </View>
                <T v="caption" tone={syncError || durable.pending && !durable.localSaved ? 'danger' : 'muted'}>{syncError ? 'Sincronizzazione da verificare · apri i dettagli' : savedLabel}</T>
            </TouchableOpacity>
            <View testID="canvas-stage" onLayout={event => {
                const next = { width: Math.floor(event.nativeEvent.layout.width), height: Math.floor(event.nativeEvent.layout.height) };
                setStage(previous => previous.width === next.width && previous.height === next.height ? previous : next);
            }} style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
                {canvasSize > 0 && <View testID="canvas-square" style={{ width: canvasSize, height: canvasSize, borderRadius: r.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: '#17131F' }}>
                    <Surface strokes={strokes} enabled={drawingEnabled && !busy} onBegin={grant} onPoint={move} onEnd={release} />
                </View>}
            </View>
            <View style={{ paddingVertical: s.sm, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: color }} />
                    <T v="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{selectedTool} · {brush === 'neon' ? 'Neon' : 'Inchiostro'} · {width === 3 ? 'Fine' : width === 6 ? 'Medio' : 'Grande'}{ephemeral ? ' · 10s' : ''}</T>
                    <T v="caption" tone="faint">{strokes.length}/60 tratti</T>
                </View>
                <T v="caption" tone="faint">{pointsShown}/3000 punti</T>
            </View>
            <View testID="canvas-toolbar" style={{ flexDirection: 'row', flexShrink: 0, gap: s.xs, paddingTop: s.sm, borderTopWidth: 1, borderTopColor: c.border }}>
                <ToolbarAction icon="star" label="Colore" onPress={() => openPanel('colors')} selected={panel === 'colors'} disabled={busy} />
                <ToolbarAction icon="edit" label="Pennello" onPress={() => openPanel('brush')} selected={panel === 'brush'} disabled={busy} />
                <ToolbarAction icon="sliders" label="Tratto" onPress={() => openPanel('width')} selected={panel === 'width'} disabled={busy} />
                <ToolbarAction icon="refresh" label="Annulla" onPress={undo} disabled={busy} />
                <ToolbarAction icon="sliders" label="Altro" onPress={() => openPanel('more')} selected={panel === 'more'} disabled={busy} />
            </View>
        </View>
        <BottomSheet visible={panel !== null} title={panel ? panelTitles[panel] : 'Opzioni'} onClose={closePanel}
            footer={panel === 'save' ? <Button label="Salva nella galleria" icon="check" loading={busy} disabled={busy || !permanent.length} onPress={save} /> : undefined}>
            {panel === 'colors' && <View style={{ gap: s.lg }}>
                <T tone="muted">Scegli il colore dei prossimi tratti.</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{canvasPalette.map(item =>
                    <TouchableOpacity key={item.color} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: color === item.color }} onPress={() => { setColor(item.color); setPanel(null); }}
                        style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: color === item.color ? 2 : 0, borderColor: c.primary }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item.color, borderWidth: 1, borderColor: c.border }} />
                    </TouchableOpacity>
                )}</View>
            </View>}
            {panel === 'brush' && <View style={{ gap: s.md }}>
                <T v="title">Strumenti</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{canvasTools.map(item =>
                    <Chip key={item.id} label={item.label} selected={tool === item.id} onPress={() => { setTool(item.id); }} />
                )}</View>
                <T tone="muted">La gomma cancella solo la porzione toccata dei tuoi tratti. Linea, rettangolo e cerchio mostrano un’anteprima e vengono condivisi al rilascio.</T>
                <T v="title">Pennello</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
                    <Chip label="Inchiostro" selected={brush === 'ink'} onPress={() => setBrush('ink')} />
                    <Chip label="Neon" selected={brush === 'neon'} onPress={() => setBrush('neon')} />
                </View>
                <T v="title">Tratto temporaneo</T>
                <T tone="muted">Se attivo, il tratto scompare dopo 10 secondi e non viene conservato nella lavagna o nella galleria.</T>
                <Chip label={ephemeral ? 'Scompare in 10s · Attivo' : 'Scompare in 10s · Disattivo'} selected={ephemeral} onPress={() => setEphemeral(value => !value)} />
                <Button label="Fatto" variant="secondary" onPress={() => setPanel(null)} />
            </View>}
            {panel === 'width' && <View style={{ gap: s.md }}>
                <T tone="muted">Scegli quanto spesso sarà il prossimo tratto.</T>
                {([{ value: 3, label: 'Fine' }, { value: 6, label: 'Medio' }, { value: 12, label: 'Grande' }] as const).map(option =>
                    <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: width === option.value }} onPress={() => { setWidth(option.value); setPanel(null); }}
                        style={{ minHeight: 58, borderRadius: r.md, borderWidth: 1, borderColor: width === option.value ? c.primary : c.border, backgroundColor: width === option.value ? c.primarySoft : c.surfaceAlt, padding: s.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.md }}>
                        <T tone={width === option.value ? 'primary' : 'default'} bold>{option.label}</T>
                        <View style={{ width: 66, height: option.value, borderRadius: r.pill, backgroundColor: c.primary }} />
                    </TouchableOpacity>
                )}
            </View>}
            {panel === 'more' && <View style={{ gap: s.sm }}>
                <MenuAction icon="send" title="Invia un Pulse" detail="Manda un piccolo pensiero al partner" onPress={() => { void sendPulse(); }} disabled={busy} />
                <MenuAction icon="image" title="Salva nella galleria" detail="Conserva una copia del disegno" onPress={() => setPanel('save')} disabled={busy} />
                <MenuAction icon="trash" title="Pulisci lavagna" detail="Cancella i tratti per entrambi" onPress={() => setPanel('clearConfirm')} destructive disabled={busy} />
                <MenuAction icon="helpCircle" title="Come funziona" detail="Scopri sincronizzazione e salvataggio" onPress={() => setPanel('help')} disabled={busy} />
            </View>}
            {panel === 'save' && <View style={{ gap: s.md }}>
                <T tone="muted">Conserva una copia del disegno nella galleria condivisa. La lavagna si salva automaticamente anche senza aggiungerla alla galleria.</T>
                <View style={{ width: '100%', maxWidth: 220, aspectRatio: 1, alignSelf: 'center', backgroundColor: '#17131F', borderRadius: r.md, overflow: 'hidden' }}><Drawing strokes={permanent} /></View>
                <Input label="Didascalia facoltativa" placeholder="Un pensiero da ricordare…" value={caption} onChangeText={setCaption} maxLength={120} multiline style={{ minHeight: 82, textAlignVertical: 'top' }} />
                {!permanent.length && <T tone="muted">Disegna almeno un tratto permanente per poter salvare.</T>}
            </View>}
            {panel === 'gallery' && <View style={{ gap: s.lg }}>
                <T tone="muted">Qui trovi i disegni che avete salvato insieme.</T>
                {gallery.error && <T tone="danger">{gallery.error}</T>}
                <Button label="Aggiorna galleria" variant="secondary" icon="refresh" onPress={() => { void gallery.refresh(); }} />
                {gallery.loading && <T tone="muted">Caricamento della galleria…</T>}
                {!gallery.rows.length && !gallery.error && !gallery.loading && <View style={{ paddingVertical: s.xl, alignItems: 'center', gap: s.sm }}>
                    <Icon name="image" size={36} color={c.primary} /><T v="title">Ancora nessun disegno</T><T tone="muted" style={{ textAlign: 'center' }}>Disegnate qualcosa e salvatelo per ritrovarlo qui.</T>
                </View>}
                {gallery.rows.map(item => <Card key={item.id} style={{ gap: s.md }}>
                    <View style={{ width: '100%', aspectRatio: 1, borderRadius: r.md, overflow: 'hidden', backgroundColor: '#17131F' }}><Drawing strokes={item.strokes} /></View>
                    {!!item.caption && <T>{item.caption}</T>}
                    <T v="caption" tone="muted">{new Date(item.created_at).toLocaleDateString('it-IT')}</T>
                    <Button label="Elimina disegno" icon="trash" variant="danger" disabled={busy} onPress={() => { setDeleteId(item.id); setPanel('deleteConfirm'); }} />
                </Card>)}
            </View>}
            {panel === 'clearConfirm' && <View style={{ gap: s.md }}>
                <T>Il disegno corrente verrà cancellato per entrambi. Le copie già salvate nella galleria resteranno disponibili.</T>
                <Button label="Pulisci" variant="danger" loading={busy} onPress={() => { void clear(); }} />
                <Button label="Annulla" variant="secondary" disabled={busy} onPress={() => setPanel('more')} />
            </View>}
            {panel === 'deleteConfirm' && <View style={{ gap: s.md }}>
                <T>Il disegno verrà eliminato dalla galleria condivisa. La lavagna corrente resterà al suo posto.</T>
                <Button label="Elimina" variant="danger" loading={busy} onPress={() => { void run(async () => {
                    if (!deleteId) return;
                    await featureRpc('delete_canvas', { p_id: deleteId });
                    setDeleteId(null); setPanel('gallery');
                }, gallery.refresh); }} />
                <Button label="Annulla" variant="secondary" disabled={busy} onPress={() => { setDeleteId(null); setPanel('gallery'); }} />
            </View>}
            {panel === 'help' && <View style={{ gap: s.md }}>
                <T v="title">Lavagna condivisa</T>
                <T tone="muted">Quando siete entrambi qui, i tratti a mano libera arrivano in tempo reale. Le forme vengono condivise al rilascio.</T>
                <T tone="muted">La lavagna viene salvata automaticamente e il partner la ritrova anche se arriva più tardi. Se manca la rete, le modifiche restano sul dispositivo in attesa di sincronizzazione.</T>
                <T tone="muted">La connessione live e il salvataggio sono distinti: aprire un canale non significa che un disegno sia stato salvato.</T>
                <T tone="muted">Per conservare anche una copia nella galleria premi «Salva». I tratti temporanei scompaiono dopo 10 secondi.</T>
                <T tone="muted">«Annulla» rimuove il tuo ultimo tratto; la gomma cancella solo la porzione toccata dei tuoi tratti. «Pulisci» cancella la lavagna per entrambi, dopo la conferma.</T>
                <T tone={durable.pending && !durable.localSaved ? 'danger' : 'muted'}>{savedLabel}</T>
                {!!syncError && <T tone="danger">{syncError}</T>}
                <Button label="Riprova sincronizzazione" variant="secondary" onPress={() => { void currentBoard.refresh(); void persistence.flush(); }} />
                <Button label="Ho capito" onPress={() => setPanel(null)} />
            </View>}
        </BottomSheet>
    </Screen>;
}

import type { DraftStorage } from '../../services/drafts/core';
import { canvasColors, Stroke, validErasures } from './protocol';
import { appendErasures } from './eraser';

export interface BoardSnapshot { id: number; epoch: number; revision: number; strokes: Stroke[]; deleted_ids: string[] }
export interface BoardOperation { epoch: number | null; action: 'put' | 'undo' | 'clear' | 'erase'; stroke?: Stroke; id?: string; erasures?: number[] }
export function validBoardStroke(value: unknown, users: string[]): value is Stroke {
  const s = value as Stroke | null;
  return !!s && users.includes(s.author) && typeof s.id === 'string' && s.id.startsWith(s.author + ':') && s.id.length <= 80 &&
    canvasColors.includes(s.color as typeof canvasColors[number]) && [3, 6, 12].includes(s.width) && ['ink', 'neon'].includes(s.brush) &&
    !s.ephemeral && (s.erasures === undefined || validErasures(s.erasures)) && Array.isArray(s.points) && s.points.length >= 2 && s.points.length <= 6000 && s.points.length % 2 === 0 && s.points.every(n => Number.isFinite(n) && n >= 0 && n <= 1000);
}
export function validBoardSnapshot(value: unknown, users: string[]): value is BoardSnapshot {
  const b = value as BoardSnapshot | null;
  return !!b && b.id === 1 && Number.isSafeInteger(b.epoch) && b.epoch >= 1 && Number.isSafeInteger(b.revision) && b.revision >= 0 &&
    Array.isArray(b.strokes) && b.strokes.length <= 60 && b.strokes.every(s => validBoardStroke(s, users)) && b.strokes.reduce((n, s) => n + s.points.length / 2, 0) <= 3000 &&
    Array.isArray(b.deleted_ids) && b.deleted_ids.length <= 6000 && b.deleted_ids.every(id => typeof id === 'string' && id.length <= 80);
}

/** Durable outbox: operations merge per stroke; a clear advances the epoch, so
 * an offline device cannot resurrect the previous board when it reconnects. */
export function createPersistentBoard(owner: string, partner: string, storage: DraftStorage, apply: (operation: BoardOperation) => Promise<BoardSnapshot>) {
  const users = [owner, partner], key = JSON.stringify([owner, partner, 'canvas-current-v1']);
  let server: BoardSnapshot | null = null, queue: BoardOperation[] = [], inFlight: BoardOperation | null = null;
  let flushing: Promise<void> | null = null, localSaved = true, error = '';
  const listeners = new Set<() => void>();
  const validOp = (op: BoardOperation) => !!op && (op.epoch === null || Number.isSafeInteger(op.epoch) && op.epoch >= 1) &&
    (op.action === 'clear' || op.action === 'put' && validBoardStroke(op.stroke, users) && op.stroke.author === owner || (op.action === 'undo' || op.action === 'erase' && validErasures(op.erasures) && op.erasures.length > 0) && typeof op.id === 'string' && op.id.startsWith(owner + ':') && op.id.length <= 80);
  try {
    const raw = storage.getItem(key);
    if (raw && raw.length < 1000000) {
      const value = JSON.parse(raw);
      if (value.v === 1 && (value.server === null || validBoardSnapshot(value.server, users)) && Array.isArray(value.queue) && value.queue.length <= 240 && value.queue.every(validOp)) {
        server = value.server; queue = value.queue;
      }
    }
  } catch { localSaved = false; }
  const persist = () => { try { storage.setItem(key, JSON.stringify({ v: 1, server, queue })); localSaved = true; } catch { localSaved = false; } };
  const emit = () => { for (const fn of listeners) fn(); };
  const view = () => {
    let epoch = server?.epoch ?? null;
    const rows = new Map((server?.strokes ?? []).map(s => [s.id, s]));
    let deleted = new Set(server?.deleted_ids ?? []);
    for (const op of queue) {
      if (op.epoch !== null && epoch !== null && op.epoch !== epoch) continue;
      if (op.action === 'clear') { rows.clear(); deleted = new Set(); if (epoch !== null) epoch++; }
      else if (op.action === 'undo') { rows.delete(op.id!); deleted.add(op.id!); }
      else if (op.action === 'erase') { const stroke = rows.get(op.id!); if (stroke) rows.set(stroke.id, appendErasures(stroke, op.erasures!)); }
      else if (!deleted.has(op.stroke!.id)) rows.set(op.stroke!.id, op.stroke!);
    }
    return { epoch, strokes: [...rows.values()], deleted_ids: [...deleted], pending: queue.length > 0, ready: server !== null, localSaved, error };
  };
  const receive = (value: unknown) => {
    if (!validBoardSnapshot(value, users)) throw new Error('Lavagna ricevuta non valida');
    if (server && (value.epoch < server.epoch || value.epoch === server.epoch && value.revision < server.revision)) return;
    if (!server) {
      let epoch = value.epoch;
      queue = queue.map(op => { const next = op.epoch === null ? { ...op, epoch } : op; if (next.action === 'clear') epoch = (next.epoch ?? epoch) + 1; return next; });
    }
    server = value;
    queue = queue.filter(op => op.epoch === null || op.epoch >= value.epoch);
    persist(); emit();
  };
  const flush = (): Promise<void> => {
    if (flushing) return flushing;
    if (!server || !queue.length) return Promise.resolve();
    flushing = (async () => {
      while (server && queue.length) {
        const op = queue[0]; inFlight = op;
        try {
          const result = await apply(op);
          receive(result);
          queue = queue.filter(item => item !== op);
          error = ''; persist(); emit();
        } catch (cause) { error = cause instanceof Error ? cause.message : 'Sincronizzazione in attesa'; persist(); emit(); break; }
        finally { inFlight = null; }
      }
    })().finally(() => { flushing = null; });
    return flushing;
  };
  const add = (op: BoardOperation) => {
    if (!validOp(op)) throw new Error('Operazione lavagna non valida');
    if (op.action === 'put') queue = queue.filter(old => old === inFlight || old.action !== 'put' || old.stroke?.id !== op.stroke?.id);
    if (op.action === 'undo') queue = queue.filter(old => old === inFlight || old.action !== 'put' || old.stroke?.id !== op.id);
    if (queue.length >= 240) throw new Error('Troppe modifiche in attesa: riprova quando torna la rete');
    queue.push(op); persist(); emit(); void flush();
  };
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, view, receive, flush,
    put(stroke: Stroke) { if (!stroke.ephemeral) add({ epoch: view().epoch, action: 'put', stroke: { ...stroke, points: [...stroke.points], ephemeral: false } }); },
    undo(id: string) { add({ epoch: view().epoch, action: 'undo', id }); },
    erase(id: string, erasures: number[]) { add({ epoch: view().epoch, action: 'erase', id, erasures: [...erasures] }); },
    clear() { add({ epoch: view().epoch, action: 'clear' }); },
  };
}

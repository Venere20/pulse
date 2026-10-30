import React, { useEffect, useRef } from 'react';
import { pathForStroke } from './protocol';
import { eraserPath } from './eraser';
import type { SurfaceProps } from './Surface';
export { Drawing } from './Drawing';
export function Surface({ strokes, onBegin, onPoint, onEnd, enabled = true }: SurfaceProps) {
  const canvas = useRef<HTMLCanvasElement>(null); const pointer = useRef<number | null>(null); const current = useRef(strokes);
  const repaint = useRef<(() => void) | null>(null);
  useEffect(() => { current.current = strokes; repaint.current?.(); }, [strokes]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const paint = () => { const box = element.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 3); element.width = Math.max(1, Math.round(box.width * ratio)); element.height = Math.max(1, Math.round(box.height * ratio)); const ctx = element.getContext('2d'); if (!ctx) return; ctx.setTransform(element.width / 1000, 0, 0, element.height / 1000, 0, 0); ctx.lineCap = ctx.lineJoin = 'round'; for (const s of current.current) { ctx.save(); for (let i = 0; i < (s.erasures?.length ?? 0); i += 5) { const clip = new Path2D('M-100 -100 H1100 V1100 H-100 Z ' + eraserPath(s.erasures!.slice(i, i + 5))); ctx.clip(clip, 'evenodd'); } const path = new Path2D(pathForStroke(s)); if (s.brush === 'neon') { ctx.globalAlpha = 0.2; ctx.strokeStyle = s.color; ctx.lineWidth = s.width * 3; ctx.stroke(path); } ctx.globalAlpha = 1; ctx.strokeStyle = s.brush === 'neon' ? '#FFFFFF' : s.color; ctx.lineWidth = s.width; ctx.stroke(path); ctx.restore(); } };
    repaint.current = paint; paint(); const observer = new ResizeObserver(paint); observer.observe(element); return () => { repaint.current = null; observer.disconnect(); };
  }, []);
  const location = (e: { clientX: number; clientY: number }) => { const box = canvas.current!.getBoundingClientRect(); return [(e.clientX - box.left) / box.width * 1000, (e.clientY - box.top) / box.height * 1000] as const; };
  const end = (id: number) => { if (pointer.current !== id) return; pointer.current = null; onEnd(); };
  return <canvas ref={canvas} aria-label={enabled ? 'Lavagna. Disegna con mouse, dito o penna' : 'Lavagna in modalità scorrimento'} style={{ display: 'block', width: '100%', aspectRatio: '1', background: '#17131F', borderRadius: 20, touchAction: enabled ? 'none' : 'pan-y', userSelect: 'none', cursor: enabled ? 'crosshair' : 'default' }}
    onPointerDown={e => { if (!enabled || pointer.current !== null || e.button !== 0) return; pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); onBegin(...location(e)); }}
    onPointerMove={e => { if (!enabled || pointer.current !== e.pointerId) return; e.preventDefault(); const samples = e.nativeEvent.getCoalescedEvents?.() ?? []; for (const sample of samples.length ? samples : [e.nativeEvent]) onPoint(...location(sample)); }}
    onPointerUp={e => { if (pointer.current === e.pointerId) { onPoint(...location(e)); end(e.pointerId); } }} onPointerCancel={e => end(e.pointerId)} onLostPointerCapture={e => end(e.pointerId)} />;
}

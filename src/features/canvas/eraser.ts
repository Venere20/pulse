import type { Stroke } from './protocol';
import { validErasures } from './protocol';
import { strokeAtPoint } from './tools';

export const ERASER_RADIUS = 20;
export function appendErasures(stroke: Stroke, cuts: number[]): Stroke {
  if (!validErasures(cuts)) return stroke;
  const next = [...(stroke.erasures ?? [])];
  for (let i = 0; i < cuts.length; i += 5) {
    const cut = cuts.slice(i, i + 5);
    if (Array.from({ length: next.length / 5 }, (_, k) => k * 5).some(k => cut.every((v, j) => next[k + j] === v))) continue;
    if (next.length + 5 > 640) return stroke;
    next.push(...cut);
  }
  return next.length === (stroke.erasures?.length ?? 0) ? stroke : { ...stroke, erasures: next };
}
/** A sweep covers the gaps between input samples without splitting or smoothing the original line again. */
export function erasePortion(stroke: Stroke, owner: string, cut: number[]): Stroke {
  if (stroke.author !== owner || cut.length !== 5 || !validErasures(cut)) return stroke;
  const [ax, ay, bx, by, radius] = cut, steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < stroke.points.length; i += 2) {
    minX = Math.min(minX, stroke.points[i]); maxX = Math.max(maxX, stroke.points[i]);
    minY = Math.min(minY, stroke.points[i + 1]); maxY = Math.max(maxY, stroke.points[i + 1]);
  }
  const reach = radius + stroke.width * (stroke.brush === 'neon' ? 1.5 : 0.5);
  if (maxX < Math.min(ax, bx) - reach || minX > Math.max(ax, bx) + reach || maxY < Math.min(ay, by) - reach || minY > Math.max(ay, by) + reach) return stroke;
  let touches = false;
  for (let i = 0; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
    if (!touches && strokeAtPoint([stroke], owner, x, y, radius + (stroke.brush === 'neon' ? stroke.width : 0))) touches = true;
  }
  return touches ? appendErasures(stroke, cut) : stroke;
}
/** Filled round-ended capsule, shared by SVG masking and HTML canvas clipping. */
export function eraserPath(cut: number[]): string {
  const [ax, ay, bx, by, radius] = cut, angle = Math.atan2(by - ay, bx - ax), nx = Math.sin(angle) * radius, ny = -Math.cos(angle) * radius;
  if (ax === bx && ay === by) return `M${ax - radius} ${ay} a${radius} ${radius} 0 1 0 ${radius * 2} 0 a${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`;
  return `M${ax + nx} ${ay + ny} L${bx + nx} ${by + ny} A${radius} ${radius} 0 0 1 ${bx - nx} ${by - ny} L${ax - nx} ${ay - ny} A${radius} ${radius} 0 0 1 ${ax + nx} ${ay + ny} Z`;
}

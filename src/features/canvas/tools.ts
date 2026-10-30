import type { Stroke } from './protocol';

export type CanvasTool = 'draw' | 'eraser' | 'line' | 'rectangle' | 'circle';
export type ShapeTool = Exclude<CanvasTool, 'draw' | 'eraser'>;
export const canvasTools: { id: CanvasTool; label: string }[] = [
  { id: 'draw', label: 'Mano libera' }, { id: 'eraser', label: 'Gomma' },
  { id: 'line', label: 'Linea' }, { id: 'rectangle', label: 'Rettangolo' }, { id: 'circle', label: 'Cerchio' },
];
export const canvasPoint = (value: number) => Math.round(Math.max(0, Math.min(1000, value)));

/** Shapes use the existing point protocol; only their final geometry is sent. */
export function shapePoints(tool: ShapeTool, from: readonly number[], to: readonly number[]): number[] {
  const [x, y] = from.map(canvasPoint), [endX, endY] = to.map(canvasPoint);
  if (tool === 'line') return [x, y, endX, endY];
  // Repeated rectangle corners keep the smoothed path sharp at each vertex.
  if (tool === 'rectangle') return [x,y,endX,y,endX,y,endX,endY,endX,endY,x,endY,x,endY,x,y,x,y];
  const size = Math.min(Math.abs(endX - x), Math.abs(endY - y));
  const centerX = x + Math.sign(endX - x) * size / 2;
  const centerY = y + Math.sign(endY - y) * size / 2;
  const radius = size / 2;
  return Array.from({ length: 33 }, (_, i) => {
    const angle = i * Math.PI * 2 / 32;
    return [canvasPoint(centerX + Math.cos(angle) * radius), canvasPoint(centerY + Math.sin(angle) * radius)];
  }).flat();
}

export function hasShapeSize(points: number[]) {
  const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
  return Math.max(...xs) - Math.min(...xs) >= 2 || Math.max(...ys) - Math.min(...ys) >= 2;
}

/** Match the smoothed rendered path, not the whole bounding rectangle. */
function distanceToSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length)) : 0;
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
}
export function strokeAtPoint(strokes: Stroke[], owner: string, x: number, y: number, tolerance = 20): Stroke | undefined {
  for (const stroke of [...strokes].reverse()) {
    if (stroke.author !== owner) continue;
    const p = stroke.points, hit = tolerance + stroke.width / 2;
    if (p.length === 2 && Math.hypot(x - p[0], y - p[1]) <= hit) return stroke;
    let ax = p[0], ay = p[1];
    for (let i = 2; i < p.length - 2; i += 2) {
      const bx = (p[i] + p[i+2]) / 2, by = (p[i+1] + p[i+3]) / 2;
      const startX = ax, startY = ay;
      for (let step = 1; step <= 8; step++) {
        const t = step / 8, u = 1 - t;
        const px = u*u*startX + 2*u*t*p[i] + t*t*bx, py = u*u*startY + 2*u*t*p[i+1] + t*t*by;
        if (distanceToSegment(x, y, ax, ay, px, py) <= hit) return stroke;
        ax = px; ay = py;
      }
    }
    if (p.length >= 4 && distanceToSegment(x, y, ax, ay, p[p.length-2], p[p.length-1]) <= hit) return stroke;
  }
}

export const canvasPalette = [
    { color: '#FF4D85', label: 'Rosa' }, { color: '#FFCB47', label: 'Giallo' },
    { color: '#59CD90', label: 'Verde' }, { color: '#4DA3FF', label: 'Blu' },
    { color: '#B07CFF', label: 'Viola' }, { color: '#FFFFFF', label: 'Bianco' },
    { color: '#282431', label: 'Nero' }, { color: '#FF7A59', label: 'Arancio' },
    { color: '#F04452', label: 'Rosso' }, { color: '#FF9AA2', label: 'Corallo' },
    { color: '#F4B6D2', label: 'Rosa chiaro' }, { color: '#9B2242', label: 'Bordeaux' },
    { color: '#D99B32', label: 'Ocra' }, { color: '#FFE4B5', label: 'Crema' },
    { color: '#B8E986', label: 'Verde lime' }, { color: '#237A57', label: 'Verde scuro' },
    { color: '#25B8AE', label: 'Turchese' }, { color: '#78DCE8', label: 'Azzurro chiaro' },
    { color: '#244DB4', label: 'Blu scuro' }, { color: '#D8C5FF', label: 'Lavanda' },
    { color: '#7939A9', label: 'Viola scuro' }, { color: '#936447', label: 'Marrone' },
    { color: '#9CA3AF', label: 'Grigio' }, { color: '#E5E7EB', label: 'Grigio chiaro' },
] as const;
export const canvasColors = canvasPalette.map(item => item.color);
export interface Stroke {
    /** Swept eraser capsules: ax, ay, bx, by, radius. Original points stay intact. */
    erasures?: number[];
    id: string;
    author: string;
    color: string;
    width: 3 | 6 | 12;
    brush: 'ink' | 'neon';
    points: number[];
    ephemeral?: boolean;
    expiresAt?: number;
}
export interface CanvasPacket {
    epoch?: number;
    v: 1;
    author: string;
    session: string;
    seq: number;
    kind: 'stroke' | 'hello' | 'undo' | 'clear' | 'erase';
    id?: string;
    color?: string;
    width?: number;
    brush?: string;
    points?: number[];
    offset?: number;
    ephemeral?: boolean;
    ids?: string[];
}
export function validCanvasPacket(value: unknown, allowed: string[]): value is CanvasPacket {
    if (!value || typeof value !== 'object')
        return false;
    const p = value as CanvasPacket;
    if (p.epoch !== undefined && (!Number.isSafeInteger(p.epoch) || p.epoch < 1)) return false;
    if (p.v !== 1 || typeof p.session !== 'string' || !/^[-a-z0-9]{8,40}$/.test(p.session) || !allowed.includes(p.author) || !Number.isSafeInteger(p.seq) || p.seq < 0 || !['stroke', 'hello', 'undo', 'clear', 'erase'].includes(p.kind))
        return false;
    if (p.kind === 'hello')
        return true;
    if (p.kind === 'clear')
        return Array.isArray(p.ids) && p.ids.length <= 60 && p.ids.every(id => typeof id === 'string' && id.length <= 80);
    if (typeof p.id !== 'string' || !p.id.startsWith(p.author + ':') || p.id.length > 80)
        return false;
    if (p.kind === 'undo')
        return true;
    if (p.kind === 'erase') return Array.isArray(p.points) && p.points.length > 0 && p.points.length <= 200 && validErasures(p.points);
    return canvasColors.includes(p.color as typeof canvasColors[number]) && [3, 6, 12].includes(p.width!) && ['ink', 'neon'].includes(p.brush!) &&
        Number.isSafeInteger(p.offset) && p.offset! >= 0 && p.offset! <= 6000 && p.offset! % 2 === 0 && Array.isArray(p.points) && p.points.length > 0 && p.points.length <= 200 && p.points.length % 2 === 0 && p.points.every(n => Number.isFinite(n) && n >= 0 && n <= 1000) && typeof p.ephemeral === 'boolean';
}
export function validErasures(value: unknown): value is number[] {
    return Array.isArray(value) && value.length <= 640 && value.length % 5 === 0 && value.every((n, i) => Number.isFinite(n) && (i % 5 === 4 ? n >= 1 && n <= 40 : n >= 0 && n <= 1000));
}
export function pathForStroke(stroke: Stroke): string {
    const p = stroke.points;
    if (!p.length) return '';
    let path = `M${p[0]} ${p[1]}`;
    if (p.length === 2) return path + ' l0.1 0.1';
    for (let i = 2; i < p.length - 2; i += 2) path += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
    return path + ` L${p[p.length - 2]} ${p[p.length - 1]}`;
}

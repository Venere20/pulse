export interface PhotoCrop { x: number; y: number; width: number; height: number }
export interface PhotoLayout { mode: 'fixed' | 'adaptive'; crop: PhotoCrop; rotation?: 0 | 90 | 180 | 270 }
export type PhotoLayouts = Record<string, PhotoLayout>;
export const ORIGINAL_CROP: PhotoCrop = { x: 0, y: 0, width: 1, height: 1 };
export const DEFAULT_PHOTO_LAYOUT: PhotoLayout = { mode: 'adaptive', crop: ORIGINAL_CROP };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export function photoLayout(value: unknown): PhotoLayout {
  const v = value as PhotoLayout | null, crop = v?.crop;
  if (!v || !['fixed', 'adaptive'].includes(v.mode) || (v.rotation !== undefined && ![0, 90, 180, 270].includes(v.rotation)) || !crop ||
    ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 ||
    crop.width < .05 || crop.height < .05 || crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001) return DEFAULT_PHOTO_LAYOUT;
  return v;
}
export function orientedRatio(sourceRatio: number, layout: PhotoLayout) {
  return (layout.rotation ?? 0) % 180 === 0 ? sourceRatio : 1 / sourceRatio;
}
export function rotatePhoto(layout: PhotoLayout, clockwise: boolean): PhotoLayout {
  const { x, y, width, height } = layout.crop;
  return { ...layout, rotation: (((layout.rotation ?? 0) + (clockwise ? 90 : 270)) % 360) as PhotoLayout['rotation'],
    crop: clockwise ? { x: Math.max(0, 1 - y - height), y: x, width: height, height: width } : { x: y, y: Math.max(0, 1 - x - width), width: height, height: width } };
}
export function frameRatio(sourceRatio: number, layout: PhotoLayout) {
  return layout.mode === 'fixed' ? 4 / 3 : orientedRatio(sourceRatio, layout) * layout.crop.width / layout.crop.height;
}
export function visibleCrop(sourceRatio: number, layout: PhotoLayout): PhotoCrop {
  const crop = layout.crop;
  if (layout.mode === 'adaptive') return crop;
  const ratio = orientedRatio(sourceRatio, layout) * crop.width / crop.height;
  const width = ratio > 4 / 3 ? crop.width * (4 / 3) / ratio : crop.width;
  const height = ratio < 4 / 3 ? crop.height * ratio / (4 / 3) : crop.height;
  return { x: crop.x + (crop.width - width) / 2, y: crop.y + (crop.height - height) / 2, width, height };
}
export function cropForRatio(sourceRatio: number, target?: number): PhotoCrop {
  if (!target) return { ...ORIGINAL_CROP };
  const width = Math.min(1, target / sourceRatio), height = Math.min(1, sourceRatio / target);
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}
export function moveCrop(crop: PhotoCrop, dx: number, dy: number): PhotoCrop {
  return { ...crop, x: clamp(crop.x + dx, 0, 1 - crop.width), y: clamp(crop.y + dy, 0, 1 - crop.height) };
}
export function zoomCrop(crop: PhotoCrop, factor: number): PhotoCrop {
  const scale = clamp(factor, Math.max(.05 / crop.width, .05 / crop.height), Math.min(1 / crop.width, 1 / crop.height));
  const width = crop.width * scale, height = crop.height * scale;
  return { x: clamp(crop.x + (crop.width - width) / 2, 0, 1 - width), y: clamp(crop.y + (crop.height - height) / 2, 0, 1 - height), width, height };
}
export function photoGeometry(width: number, sourceRatio: number, layout: PhotoLayout) {
  const oriented = orientedRatio(sourceRatio, layout);
  const height = width / frameRatio(sourceRatio, layout), crop = layout.crop;
  const imageHeight = Math.max(width / (oriented * crop.width), height / crop.height);
  const imageWidth = imageHeight * oriented;
  return { width: imageWidth, height: imageHeight, left: (width - crop.width * imageWidth) / 2 - crop.x * imageWidth, top: (height - crop.height * imageHeight) / 2 - crop.y * imageHeight };
}
export function photoImageGeometry(width: number, sourceRatio: number, layout: PhotoLayout) {
  const box = photoGeometry(width, sourceRatio, layout), angle = layout.rotation ?? 0;
  const swapped = angle % 180 !== 0;
  return { width: swapped ? box.height : box.width, height: swapped ? box.width : box.height,
    left: box.left + (swapped ? (box.width - box.height) / 2 : 0), top: box.top + (swapped ? (box.height - box.width) / 2 : 0),
    transform: [{ rotate: `${angle}deg` as `${number}deg` }] };
}

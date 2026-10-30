export interface PhotoAsset { uri: string; mimeType?: string | null; fileSize?: number | null }
export interface PreparedPhoto { bytes: ArrayBuffer; mime: string; extension: string; width: number; height: number; originalBytes: number }
export interface PhotoEncoding { bytes: ArrayBuffer; mime: string; width: number; height: number }
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Shared by memories, private covers and capsules. Storage limits apply after
 * resizing; the larger input limit bounds the work needed to decode a photo. */
async function readPhotoSource(asset: PhotoAsset) {
  if ((asset.fileSize ?? 0) > MAX_INPUT_BYTES) throw new Error('La fotografia originale supera 32 MB.');
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Impossibile leggere la fotografia.');
  if (Number(response.headers.get('content-length')) > MAX_INPUT_BYTES) throw new Error('La fotografia originale supera 32 MB.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('La fotografia originale supera 32 MB.');
  const mime = (asset.mimeType || response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!supported.has(mime)) throw new Error('Formato non supportato. Usa JPG, PNG o WebP.');
  if (!bytes.byteLength) throw new Error('La fotografia è vuota.');
  return { bytes, mime };
}
async function prepareEncoding(asset: PhotoAsset, source: { bytes: ArrayBuffer; mime: string }, maxBytes: number, maxEdge: number): Promise<PreparedPhoto> {
  const { encodePhoto } = await import('./photoCodec');
  const photo = await encodePhoto(asset.uri, source.bytes, source.mime, maxEdge);
  if (photo.bytes.byteLength > maxBytes) throw new Error(`La fotografia preparata supera il limite di ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return { ...photo, extension: photo.mime === 'image/jpeg' ? 'jpg' : photo.mime.split('/')[1], originalBytes: source.bytes.byteLength };
}
export async function preparePhoto(asset: PhotoAsset, maxBytes: number, maxEdge = 2048): Promise<PreparedPhoto> {
  return prepareEncoding(asset, await readPhotoSource(asset), maxBytes, maxEdge);
}
/** Read source bytes once; run the two codec passes sequentially to bound memory. */
export async function prepareMemoryPhoto(asset: PhotoAsset) {
  const source = await readPhotoSource(asset);
  const photo = await prepareEncoding(asset, source, 8 * 1024 * 1024, 2048);
  const preview = photo.width <= 480 && photo.height <= 480 ? photo : await prepareEncoding(asset, source, 1024 * 1024, 480);
  return { photo, preview };
}

export function photoDimensions(width: number, height: number, maxEdge: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Impossibile decodificare la fotografia.');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

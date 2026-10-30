import { photoDimensions, PhotoEncoding } from './photoPreparation';

export async function encodePhoto(_uri: string, bytes: ArrayBuffer, mime: string, maxEdge: number): Promise<PhotoEncoding> {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Impossibile decodificare la fotografia.')); image.src = url; });
    // Browser image decoding applies EXIF orientation before natural dimensions.
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight, maxEdge);
    const resized = dimensions.width !== image.naturalWidth || dimensions.height !== image.naturalHeight;
    if (!resized && bytes.byteLength <= 256 * 1024) return { bytes, mime, ...dimensions };
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossibile preparare la fotografia.');
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    // Preserve alpha for PNG and WebP, including browsers without a WebP encoder.
    const outputMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Impossibile preparare la fotografia.')), outputMime, 0.82));
    const encoded = await blob.arrayBuffer();
    canvas.width = 0; canvas.height = 0;
    if (!resized && encoded.byteLength >= bytes.byteLength) return { bytes, mime, ...dimensions };
    return { bytes: encoded, mime: blob.type, ...dimensions };
  } finally { image.src = ''; URL.revokeObjectURL(url); }
}

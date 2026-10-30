import { photoDimensions, PhotoEncoding } from './photoPreparation';

export async function encodePhoto(uri: string, bytes: ArrayBuffer, mime: string, maxEdge: number): Promise<PhotoEncoding> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let outputUri: string | undefined;
  try {
    image = await context.renderAsync();
    const dimensions = photoDimensions(image.width, image.height, maxEdge);
    const resized = dimensions.width !== image.width || dimensions.height !== image.height;
    if (!resized && bytes.byteLength <= 256 * 1024) return { bytes, mime, ...dimensions };
    if (resized) {
      image.release(); image = undefined;
      context.resize(dimensions); image = await context.renderAsync();
    }
    const outputMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const result = await image.saveAsync({ format: outputMime === 'image/jpeg' ? SaveFormat.JPEG : SaveFormat.PNG, compress: 0.82 });
    outputUri = result.uri;
    const { File } = await import('expo-file-system');
    const encoded = await new File(result.uri).arrayBuffer();
    if (!resized && encoded.byteLength >= bytes.byteLength) return { bytes, mime, ...dimensions };
    return { bytes: encoded, mime: outputMime, width: result.width, height: result.height };
  } finally {
    image?.release(); context.release();
    if (outputUri && outputUri !== uri) {
      const { File } = await import('expo-file-system');
      // Only the cache file created by saveAsync; never remove the picked source.
      try { new File(outputUri).delete(); } catch { /* OS cache eviction may have removed it already. */ }
    }
  }
}

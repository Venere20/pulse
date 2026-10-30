/** New filenames carry the preview format, so legacy clients can keep storing
 * the original URL and old photos never trigger a speculative preview request. */
export function memoryPreviewPath(path: string): string | null {
  const match = path.match(/^(.+)\.preview-(jpg|png|webp)\.full\.(jpg|png|webp)$/);
  return match ? `${match[1]}.thumb.${match[2]}` : null;
}
export function memoryPreviewUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  // Keep immutable encoded Storage paths/query/hash without relying on platform
  // URL setters. This also works with React Native's partial URL polyfill.
  const match = url.match(/^(https?:\/\/[^/?#]+\/storage\/v1\/object\/public\/meetings\/)([^?#]+)([?#].*)?$/);
  const path = match && memoryPreviewPath(match[2]);
  return path ? `${match![1]}${path}${match![3] ?? ''}` : null;
}

/** Stored legacy public URLs are identifiers only; never fetch them directly.
 * Accept references from our Storage origin, not arbitrary URLs from imports. */
export function meetingPhotoPath(reference: string, origin: string): string | null {
  if (typeof reference !== 'string') return null;
  const prefix = `${origin.replace(/\/$/, '')}/storage/v1/object/`;
  if (!reference.startsWith(prefix)) return null;
  const match = reference.slice(prefix.length).match(/^(?:public|sign|authenticated)\/meetings\/([^?#]+)/);
  if (!match) return null;
  try {
    const path = decodeURIComponent(match[1]);
    if (path.length > 1024 || /[\\\u0000-\u001f\u007f?#%]/.test(path)) return null;
    const parts = path.split('/');
    if (parts.length < 2 || parts.some(p => !p || p === '.' || p === '..')) return null;
    return path;
  } catch { return null; }
}

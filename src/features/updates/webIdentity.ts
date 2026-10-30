const BOOT = /^\/_expo\/static\/js\/web\/(entry|__common|__expo-metro-runtime)-[a-f0-9]{32,64}\.js$/;
export function bootIdentity(sources: readonly string[], origin: string): string | null {
  const paths = new Set<string>(); let entry = false;
  for (const source of sources) {
    try {
      const url = new URL(source, origin);
      if (url.origin !== new URL(origin).origin || url.search || url.hash || !BOOT.test(url.pathname)) continue;
      paths.add(url.pathname); if (url.pathname.includes('/entry-')) entry = true;
    } catch { /* Ignore malformed or unrelated scripts. */ }
  }
  return entry ? [...paths].sort().join('\n') : null;
}
export function htmlBootIdentity(html: string, origin: string): string | null {
  // Read attributes only; never attach/evaluate the returned HTML or its scripts.
  const sources = [...html.matchAll(/<script\b[^>]*?\s(?:src|data-demo-src)\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map(match => match[2]);
  return bootIdentity(sources, origin);
}
export async function fetchBootIdentity(origin: string, signal: AbortSignal) {
  const response = await fetch('/index.html?pulse_update_check=' + Date.now(), { cache: 'no-store', credentials: 'same-origin', signal });
  if (!response.ok || (response.url && new URL(response.url).origin !== new URL(origin).origin)) return null;
  return htmlBootIdentity(await response.text(), origin);
}

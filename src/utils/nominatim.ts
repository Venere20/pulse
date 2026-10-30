import { Platform } from 'react-native';
import { abortableDelay, throwIfAborted } from './abort';

// Policy Nominatim: max 1 richiesta/secondo. Tutte le chiamate passano da questa coda.
const MIN_INTERVAL_MS = 1100;
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

export function nominatimFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept-Language': 'it',
    ...((init.headers as Record<string, string>) || {}),
  };
  // Il browser non permette di impostare User-Agent; su native sì.
  if (Platform.OS !== 'web') headers['User-Agent'] = 'couples-app/1.0 (expo)';

  const run = chain.then(async () => {
    throwIfAborted(init.signal);
    const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await abortableDelay(wait, init.signal);
    throwIfAborted(init.signal);
    lastCall = Date.now();
    return fetch(url, { ...init, headers });
  });
  chain = run.catch(() => undefined);
  return run;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: '❤️ Hai ricevuto un Pulse!',
      body: event.data ? event.data.text() : 'Il tuo partner sta pensando a te.',
    };
  }

  const title = data.title || '❤️ Hai ricevuto un Pulse!';
  const options = {
    body: data.body || 'Il tuo partner sta pensando a te.',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    vibrate: [100, 50, 100],
    // Con lo stesso "tag" una nuova notifica sostituisce la precedente invece di accumularsi
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: !!data.requireInteraction,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil((async () => {
    const game = gameFromUrl(options.data.url);
    if (game) {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some(client => client.visibilityState === 'visible' && gameFromUrl(client.url) === game)) return;
    }
    await self.registration.showNotification(title, options);
  })());
});

function gameFromUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    const path = url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname;
    const match = path.match(/^\/play\/(tris|connect4|battleship|drawguess|wyr|daily|deeptalk)$/);
    return match ? match[1] : null;
  } catch { return null; }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = (event.notification.data && event.notification.data.url) || '/';
  let target = '/';
  try {
    const parsed = new URL(rawTarget, self.location.origin);
    if (parsed.origin === self.location.origin && /^https?:$/.test(parsed.protocol)) {
      target = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch { /* Untrusted or malformed navigation stays inside Pulse. */ }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            // App gia aperta: le diciamo dove andare (es. #/play/tris), poi la portiamo in primo piano
            client.postMessage({ type: 'pulse-navigate', url: target });
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(target);
      })
  );
});


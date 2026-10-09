// Service worker de Shede : notifications push, et mode serveur utilisable sans réseau.
// Le mise en cache n'est active que si la page l'a demandé (?cache=1, en production) :
// en développement, les fichiers changent sans changer d'adresse.

const CACHE_ENABLED = new URL(self.location.href).searchParams.get('cache') === '1';
const PAGES = 'shede-waiter-pages-v1';
const STATIC = 'shede-waiter-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const key of await caches.keys()) {
        if (key.startsWith('shede-waiter-') && (!keep.has(key) || !CACHE_ENABLED)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (!CACHE_ENABLED) return;
  const request = event.request;
  if (request.method !== 'GET') return; // envois de commandes : jamais en cache
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages du mode serveur : réseau d'abord, dernière version connue sans réseau
  if (request.mode === 'navigate' && (url.pathname === '/serveur' || url.pathname.startsWith('/serveur/'))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const response = await fetch(request);
          // Une redirection (session expirée, autre compte) n'est jamais gardée
          if (response.ok && !response.redirected) await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match('/serveur')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Fichiers de l'application (adresses versionnées) et icônes : cache d'abord
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/serveur.webmanifest') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nouvelle notification';
  const options = {
    body: data.body || '',
    icon: '/icons/waiter-192.png',
    badge: '/icon-light-32x32.png',
    vibrate: [200, 100, 200],
    tag: data.url || undefined,
    renotify: Boolean(data.url),
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    (async () => {
      // Application déjà ouverte : on la ramène au premier plan plutôt que d'ouvrir un onglet
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = new URL(targetUrl, self.location.origin);
      const existing = all.find((c) => new URL(c.url).pathname.startsWith(target.pathname));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

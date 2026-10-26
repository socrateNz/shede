// Service worker de Tavola : notifications push, application installable (PWA) et hors ligne.
// Les noms de caches « shede-… » et le message « shede:refresh » sont gardés : les changer
// viderait les caches des téléphones déjà installés sans rien apporter à l'utilisateur.
// Le mise en cache n'est active que si la page l'a demandé (?cache=1, en production) :
// en développement, les fichiers changent sans changer d'adresse.
// Les pages du back-office ne sont jamais gardées (données sensibles) : sans réseau, on affiche /offline.
// Seules les pages du mode serveur restent consultables hors ligne.

const CACHE_ENABLED = new URL(self.location.href).searchParams.get('cache') === '1';
const PAGES = 'shede-waiter-pages-v1';
const STATIC = 'shede-static-v1';
const OFFLINE = 'shede-offline-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (CACHE_ENABLED) {
        try {
          const cache = await caches.open(OFFLINE);
          await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        } catch {}
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC, OFFLINE]);
      for (const key of await caches.keys()) {
        if (key.startsWith('shede-') && (!keep.has(key) || !CACHE_ENABLED)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function isStaticFile(pathname) {
  // Adresses qui changent à chaque version (ou presque jamais) : sans risque de servir un fichier périmé
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  if (!CACHE_ENABLED) return;
  const request = event.request;
  if (request.method !== 'GET') return; // envois de commandes : jamais en cache
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Pages du mode serveur : réseau d'abord, dernière version connue sans réseau
    if (url.pathname === '/serveur' || url.pathname.startsWith('/serveur/')) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(PAGES);
          try {
            const response = await fetch(request);
            // Une redirection (session expirée, autre compte) n'est jamais gardée
            if (response.ok && !response.redirected) await cache.put(url.pathname, response.clone());
            return response;
          } catch {
            return (await cache.match(url.pathname)) || (await cache.match('/serveur')) || (await caches.match(OFFLINE_URL)) || Response.error();
          }
        })(),
      );
      return;
    }
    // Reste du site : toujours le réseau ; page « Pas de connexion » s'il ne répond pas
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Fichiers de l'application (adresses versionnées) et icônes : cache d'abord
  if (isStaticFile(url.pathname)) {
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
    icon: '/icons/app-192.png',
    badge: '/icon-light-32x32.png',
    vibrate: [200, 100, 200],
    tag: data.url || undefined,
    renotify: Boolean(data.url),
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Écrans ouverts (cuisine, bar) : rechargement immédiat, sans attendre leur prochain passage
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((all) => all.forEach((client) => client.postMessage({ type: 'shede:refresh', url: data.url || null }))),
    ]),
  );
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

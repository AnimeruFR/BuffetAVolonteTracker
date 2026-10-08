// Service worker : met l'application en cache pour qu'elle fonctionne sans réseau au restaurant.
// Changer ce numéro à chaque mise à jour : les téléphones installent alors la nouvelle version.
const CACHE = 'buffet-tracker-v4';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'sync.js', 'firebase-config.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const SDK_HOST = 'www.gstatic.com'; // SDK Firebase (versionné, donc mis en cache durablement)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.hostname === SDK_HOST && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  // Réseau d'abord (pour recevoir les mises à jour), cache en secours hors-ligne.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }) // contourne le cache HTTP pour toujours avoir la dernière version
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

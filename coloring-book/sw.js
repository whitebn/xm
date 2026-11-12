// Lets the app work with no internet after the first visit.
//
// Online, every file comes from the network (so you always get the newest version, and all
// files come from the same deploy). Offline, or if the network is slow (4 seconds), the
// copy saved from the last visit is used.
//
// Bump CACHE whenever you change app files so old copies are cleaned up.
const CACHE = 'coloring-book-v7';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/fill.js', 'js/sources.js', 'js/store.js', 'js/brushes.js', 'js/colorwheel.js', 'js/patterns.js',
  'lib/pdf.min.mjs', 'lib/pdf.worker.min.mjs',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const NETWORK_TIMEOUT_MS = 4000;

// `cache: 'reload'` skips the browser's own HTTP cache. Without it, installing a new version
// could quietly save the OLD files again (GitHub Pages lets browsers reuse files for 10 minutes).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map(async (url) => {
        const res = await fetch(url, { cache: 'reload' });
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        await cache.put(url, res);
      })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  try {
    // 'no-cache' means: ask the server if the file changed (a quick 304 when it has not)
    const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin', signal: ctrl.signal });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || req.headers.has('range')) return;
  e.respondWith(networkFirst(req));
});

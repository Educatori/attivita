/* Attività Campus — service worker (sw.js) */
const VERSION = 'campus-v1';   // ← cambia qui (v2, v3...) per forzare l'aggiornamento

const CORE = [
  './',
  './attivicampus.html',
  './subscribe.html',
  './attiv.css',
  './attiv.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---- install: precarica i file base ---- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

/* ---- activate: cancella le cache vecchie ---- */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- fetch ---- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API Apps Script: MAI in cache (dati sempre freschi)
  if (url.hostname === 'script.google.com') return;

  // Pagine HTML: prima la rete, poi la cache (così aggiorni il sito senza ripubblicare l'app)
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Stessa origine (css, js, icone): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Esterni (font Google, immagine QR): cache-first
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(req)) ||
           (await cache.match('./attivicampus.html'));
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
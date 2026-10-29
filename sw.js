// ═══════════════════════════════════════════════════════════════
// sw.js — Attività Campus
// Versione: v-2026-10-29-1.00
//
// ⚠️ Ad ogni deploy: incrementa VERSION qui sotto.
// ═══════════════════════════════════════════════════════════════

const VERSION = 'v-2026-10-29-1.01';

const CACHE_HTML   = `attiv-html-${VERSION}`;
const CACHE_STATIC = `attiv-static-${VERSION}`;

// ─────────────────────────────────────────────────────────────
// PRECACHE
// ─────────────────────────────────────────────────────────────
const PRECACHE_URLS = [
    './',
    './attivicampus.html',
    './subscribe.html',
    './attiv.css',
    './attiv.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './mona-sans-variable.woff2',
    './mona-sans-mono-variable.woff2',
];

// Host da NON cachare mai
const BYPASS_HOSTS = [
    'script.google.com',
    'googleusercontent.com',
    'api.qrserver.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

// ─────────────────────────────────────────────────────────────
// INSTALL — precache tollerante
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_STATIC);
        const results = await Promise.allSettled(
            PRECACHE_URLS.map(async (url) => {
                try {
                    const r = await fetch(url, { cache: 'no-store' });
                    if (r.ok) { await cache.put(url, r); return; }
                    throw new Error(`HTTP ${r.status}`);
                } catch (err) {
                    console.warn(`[SW] Precache fallito: ${url}`, err.message);
                    throw err;
                }
            })
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[SW] Precache: ${PRECACHE_URLS.length - failed}/${PRECACHE_URLS.length} (${VERSION})`);
    })());
});

// ─────────────────────────────────────────────────────────────
// ACTIVATE — pulizia cache vecchie + claim
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        const toDelete = keys.filter(k =>
            k.startsWith('attiv-') &&
            k !== CACHE_HTML &&
            k !== CACHE_STATIC
        );
        // Cancella anche eventuali cache "campus-v*" residue
        const oldCampus = keys.filter(k => /^campus-v\d+$/.test(k));
        await Promise.all([...toDelete, ...oldCampus].map(k => caches.delete(k)));

        await self.clients.claim();
        console.log(`[SW] ✅ Attivo (${VERSION})`);
    })());
});

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;
    if (!url.protocol.startsWith('http')) return;

    // Navigazione / HTML → network-first
    if (req.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.pathname.endsWith('/')) {
        event.respondWith(networkFirst(req, CACHE_HTML));
        return;
    }

    // Asset statici → stale-while-revalidate
    if (/\.(css|js|mjs|woff2?|ttf|png|jpe?g|svg|webp|ico)$/i.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
        return;
    }
});

// ─────────────────────────────────────────────────────────────
// STRATEGIE
// ─────────────────────────────────────────────────────────────
async function networkFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
    } catch {
        return (await cache.match(req)) ||
               (await cache.match('./attivicampus.html')) ||
               new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    const network = fetch(req)
        .then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; })
        .catch(() => null);
    return cached || (await network) || Response.error();
}

// ─────────────────────────────────────────────────────────────
// MESSAGE
// ─────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    const { data } = event;
    if (data?.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (data?.type === 'CLEAR_CACHE') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            event.ports[0]?.postMessage({ ok: true });
        })());
        return;
    }
});
// sw.js — geoclock.world service worker: installable PWA + offline.
//
// Cache model:
//   - CORE (installed up front, ~3 MB): the app shell (root files),
//     the pinned card bundle, both timezone JSONs, the night layer,
//     and the Blue Marble frames the card can pick over the next
//     ~5 weeks.
//   - BACKFILL (~12 MB): the remaining monthly Blue Marble frames,
//     fetched sequentially when the demo page posts
//     { type: 'backfill' } after load (see geoclock-pwa.js). The
//     loop skips anything already cached, so it is idempotent and
//     resumes across visits if interrupted.
//
// What this worker deliberately does NOT touch:
//   - Cross-origin requests (Nominatim geocoding stays online-only
//     and unobserved — see the usage-policy note in
//     geoclock-webconfig.js).
//   - wallpaper.html, about.html, and every other page outside the
//     SHELL allowlist: they fall through to the network untouched.
//     wallpaper.html is the macOS-app / screenshot-embedder render
//     surface; the only SW effect it can see is cache-first serving
//     of /v*/ assets, which are immutable — byte-identical to the
//     network. Do not add a catch-all fetch handler.
//
// Updates are silent (no skipWaiting/clients.claim): a new deploy
// ships a new pin, the browser installs the new worker in the
// background, and the next visit activates it and purges old caches.
//
// The pin below must match package.json#version — CI greps this
// file for '/vX.Y.Z' exactly as it does index.html and
// wallpaper.html (deploy-site.yml + ci.yml). Bump in lockstep.
const ASSET_BASE = '/v0.3.0';
const CACHE = 'geoclock-' + ASSET_BASE.slice(1); // geoclock-v0.3.0

// Root files this worker owns (network-first, cache fallback).
// Explicit allowlist — anything absent is never intercepted.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/geoclock-config.js',
  '/geoclock-webconfig.js',
  '/geoclock-planner.js',
  '/geoclock-pwa.js',
];

/** All 24 monthly Blue Marble filenames. The names are fully
 *  pattern-derived — see rollup.config.mjs (glob copy) and
 *  scripts/fetch-imagery.sh (generator). */
function allImagery() {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    for (const half of ['start', 'mid']) {
      out.push(`blue-marble-${mm}-${half}-2048.jpg`);
    }
  }
  return out;
}

/** The frames the card can display over the next ~5 weeks: current
 *  month start+mid plus next month's start — a superset of every
 *  branch of the picker in src/day-image.ts (day 1-7 -> MM-start,
 *  8-22 -> MM-mid, 23+ -> next month start). KEEP IN SYNC with that
 *  file if the picker ever changes. */
function coreImagery(now) {
  const m = now.getUTCMonth() + 1;
  const next = (m % 12) + 1;
  const mm = String(m).padStart(2, '0');
  const nn = String(next).padStart(2, '0');
  return [
    `blue-marble-${mm}-start-2048.jpg`,
    `blue-marble-${mm}-mid-2048.jpg`,
    `blue-marble-${nn}-start-2048.jpg`,
  ];
}

function coreUrls() {
  const versioned = [
    'geo-clock-card.js',
    'timezones.json',
    'timezones-iana.json',
    'black-marble-2048.jpg',
    ...coreImagery(new Date()),
  ].map((f) => `${ASSET_BASE}/${f}`);
  return { shell: SHELL, versioned };
}

function backfillUrls() {
  const core = new Set(coreImagery(new Date()));
  return allImagery()
    .filter((f) => !core.has(f))
    .map((f) => `${ASSET_BASE}/${f}`);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      const { shell, versioned } = coreUrls();
      return cache.addAll([
        // Root files are served no-cache; bypass the HTTP cache so
        // install never snapshots a stale copy. Versioned files are
        // immutable — default cache mode is fine.
        ...shell.map((u) => new Request(u, { cache: 'no-cache' })),
        ...versioned,
      ]);
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('geoclock-') && k !== CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, isNavigate) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Offline navigation to an uncached path: serve the app shell.
    if (isNavigate) {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Nominatim etc.

  if (url.pathname.startsWith('/v')) {
    // Immutable versioned assets — cache-first is safe everywhere,
    // wallpaper.html embedders included (identical bytes).
    event.respondWith(cacheFirst(req));
    return;
  }
  const isNavigate =
    req.mode === 'navigate' &&
    (url.pathname === '/' || url.pathname === '/index.html');
  if (SHELL.includes(url.pathname) || isNavigate) {
    event.respondWith(networkFirst(req, isNavigate));
  }
  // Everything else (wallpaper.html, about.html, …) falls through.
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'backfill') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Sequential on purpose: one in-flight request keeps the
      // background fill invisible next to the page's own traffic.
      for (const url of backfillUrls()) {
        if (await cache.match(url)) continue;
        try {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch {
          // Offline or the browser reclaimed the worker — the
          // cache.match skip above makes the next trigger resume
          // right here.
          return;
        }
      }
    })(),
  );
});

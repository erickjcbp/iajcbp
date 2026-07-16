// Service worker do app Acólitos — network-first (sempre o conteúdo mais novo), cache só p/ fallback offline.
// O fetch handler "de verdade" é o que torna o app instalável no Chrome.
const BUILD = '20260715220309'; // carimbado a cada deploy p/ disparar a auto-atualização nos apps abertos
const CACHE = 'acolitos-' + BUILD;
const SHELL = ['./login.html', './index.html', './shared.css', './shared.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // só mesma origem
  e.respondWith(
    fetch(req)
      .then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {}); return resp; })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

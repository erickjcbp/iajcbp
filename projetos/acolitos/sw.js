// Service worker do app Acólitos — network-first (sempre o conteúdo mais novo), cache só p/ fallback offline.
// O fetch handler "de verdade" é o que torna o app instalável no Chrome.
const BUILD = '20260716150000'; // carimbado a cada deploy p/ disparar a auto-atualização nos apps abertos
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

// --- PUSH ---
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  const title = d.title || 'Acólitos JCBP';
  const opts = {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'acolitos',
    renotify: !!d.renotify, // re-alerta (som/vibra) mesmo com a tag definida
    data: { url: d.url || '/projetos/acolitos/index.html' },
  };
  e.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cls.forEach((c) => c.postMessage({ tipo: 'push', payload: d })); // aba aberta → toca som
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/projetos/acolitos/index.html';
  e.waitUntil((async () => {
    const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cls) {
      if ('focus' in c) { try { await c.navigate(url); } catch (_) {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

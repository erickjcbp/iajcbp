// Service worker mínimo — torna o app instalável (PWA). Sem cache offline (as telas usam no-store).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* pass-through: deixa a rede responder */ });

// Service worker do app Acólitos — network-first (sempre o conteúdo mais novo), cache só p/ fallback offline.
// O fetch handler "de verdade" é o que torna o app instalável no Chrome.
const BUILD = '20261103-descobertas-paroquia-v1'; // versão do cache offline; atualiza sem interromper telas abertas
const CACHE = 'acolitos-' + BUILD;
const EMBLEMAS = ["./emblemas/aspirante.webp", "./emblemas/coroinha.webp", "./emblemas/acolito_aspirante.webp", "./emblemas/acolito_guardiao.webp", "./emblemas/acolito_sentinela.webp", "./emblemas/aspirante_cerimoniario.webp", "./emblemas/cerimoniario_aspirante.webp", "./emblemas/cerimoniario_guardiao.webp", "./emblemas/cerimoniario_magistral.webp", "./emblemas/cerimoniario_mor.webp"];
const MEDALHAS = ["./medalhas-arte/calice-bronze.webp", "./medalhas-arte/calice-prata.webp", "./medalhas-arte/calice_sagrado-ouro.webp", "./medalhas-arte/coracao-bronze.webp", "./medalhas-arte/coracao-prata.webp", "./medalhas-arte/coroa-ouro.webp", "./medalhas-arte/coroa-prata.webp", "./medalhas-arte/crucifixo-ouro.webp", "./medalhas-arte/crucifixo-prata.webp", "./medalhas-arte/espadas-ouro.webp", "./medalhas-arte/estrela-bronze.webp", "./medalhas-arte/estrela-ouro.webp", "./medalhas-arte/estrela-prata.webp", "./medalhas-arte/hostia-ouro.webp", "./medalhas-arte/livro-bronze.webp", "./medalhas-arte/livro-ouro.webp", "./medalhas-arte/livro-prata.webp", "./medalhas-arte/pomba-ouro.webp", "./medalhas-arte/pomba-prata.webp", "./medalhas-arte/rosario-ouro.webp", "./medalhas-arte/rosario-prata.webp", "./medalhas-arte/sino-prata.webp", "./medalhas-arte/sino2-prata.webp", "./medalhas-arte/trigo-bronze.webp", "./medalhas-arte/trigo-prata.webp", "./medalhas-arte/turibulo-ouro.webp", "./medalhas-arte/vela-bronze.webp", "./medalhas-arte/samaritano-ouro.webp", "./medalhas-arte/acolhedor-ouro.webp", "./medalhas-arte/bastidores-ouro.webp", "./medalhas-arte/ponte_paz-ouro.webp", "./medalhas-arte/criacao-ouro.webp", "./medalhas-arte/escuta-ouro.webp", "./medalhas-arte/recomecar-ouro.webp", "./medalhas-arte/palavra_semeada-ouro.webp", "./medalhas-arte/amigo_todos-ouro.webp", "./medalhas-arte/memoria-ouro.webp"];
const TROFEUS = ['./trofeus-arte/iniciantes.webp', './trofeus-arte/acolitos.webp', './trofeus-arte/cerimoniarios.webp'];
const OFICIAIS = ["./identidade-oficial/brasoes/aspirante_cerimoniario.webp", "./identidade-oficial/brasoes/acolito_sentinela.webp", "./identidade-oficial/brasoes/cerimoniario_mor.webp", "./identidade-oficial/brasoes/aspirante.webp", "./identidade-oficial/brasoes/acolito_aspirante.webp", "./identidade-oficial/brasoes/coroinha.webp", "./identidade-oficial/brasoes/acolito_guardiao.webp", "./identidade-oficial/brasoes/cerimoniario_guardiao.webp", "./identidade-oficial/brasoes/cerimoniario_magistral.webp", "./identidade-oficial/brasoes/cerimoniario_aspirante.webp"];
const SHELL = ['./conquistas-marcos-core.js','./medalhoes-tempo.css','./identidade-oficial/medalhoes/tempo-bronze-prata-ouro.webp','./identidade-oficial/medalhoes/tempo-onix-rubi.webp',...OFICIAIS,'./tempo-pastoral-core.js', './colunas-tabela.js', './medalhas-admin.js', './medalhas-admin.css', ...EMBLEMAS, ...MEDALHAS, ...TROFEUS, './medalhas-arte.js', '/editor-foto-loader.js', '/editor-foto.js', '/editor-foto.css', './login.html', './index.html', './shared.css', './publico-acessibilidade.css', './navegacao-core.js', './shared.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('acolitos-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // só mesma origem
  e.respondWith((async () => {
    let unavailable;
    try {
      const resp = await fetch(req);
      if (resp.status >= 500) { unavailable = resp; throw Error('Servidor indisponível'); }
      // Erros e redirecionamentos nunca substituem uma cópia válida da tela.
      if (resp.ok && !resp.redirected) {
        const cp = resp.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {}));
      }
      return resp;
    } catch (_) {
      // Parâmetros de apresentação (como expandido=1) compartilham o mesmo HTML.
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' }).catch(() => null);
      if (cached) return cached;
      // Servir index.html aqui fazia a Home aparecer sob a URL do jogo.
      if (req.mode === 'navigate') return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>Conexão · Acólitos</title><style>*{box-sizing:border-box}body{margin:0;background:#150a0d;color:#f7ebe7;font:16px/1.6 system-ui}main{min-height:100dvh;padding:clamp(20px,4vw,64px);display:flex;flex-direction:column;justify-content:center;align-items:flex-start}h1{font-size:clamp(28px,4vw,48px);line-height:1.15}p{max-width:55ch;color:#c6a7ac}button,a{display:inline-flex;align-items:center;min-height:48px;padding:12px 20px;margin:8px 0;font:700 16px system-ui;border-radius:10px}button{border:0;background:#efca7c;color:#291721;cursor:pointer}a{color:#efca7c}</style><main><h1>Vamos tentar de novo?</h1><p>A conexão falhou ao abrir esta tela. Conecte-se à internet e tente novamente.</p><button onclick="location.reload()">Tentar novamente</button><a href="index.html">Ir para o início</a></main></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      return unavailable || Response.error();
    }
  })());
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

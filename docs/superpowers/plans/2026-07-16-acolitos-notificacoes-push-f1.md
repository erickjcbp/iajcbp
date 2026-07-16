# Notificações Push — Fase 1 (Base + Aviso + Som) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membro ativa notificações push por um botão 🔔; a coordenação envia um "aviso para todos" que chega no celular (com som quando o app está aberto).

**Architecture:** Inscrição via `PushManager` salva direto no Supabase (RLS por dono). Envio por função Vercel (`web-push` + VAPID), gated à coordenação. Service worker mostra a notificação e avisa a aba aberta pra tocar o som. Abordagem A do spec.

**Tech Stack:** Web Push API + Service Worker, `web-push` (npm) em função Vercel, Supabase (tabela + RLS), Chaves VAPID, WAV (áudio in-app).

Spec: `docs/superpowers/specs/2026-07-16-acolitos-notificacoes-push-design.md`.

## Global Constraints

- **Conta git/deploy:** identidade `erickjcbp` (`gh auth switch --user erickjcbp`). Deploy do **root** do repo (Vercel projeto iajcbp, domínio `coroinhas.jcbplimeira.com.br`).
- **Supabase:** projeto ref `fttjgsotuosjfrasttds`. MCP do Supabase precisa estar autenticado na conta **erickjcbp** (não `erickia`) — confira com `list_projects`.
- **Segredos nunca no repo/front:** `VAPID_PRIVATE_KEY` só em env do Vercel. `VAPID_PUBLIC_KEY` pode ir no front (não é segredo). Nunca imprimir valor de segredo no terminal.
- **App servido em** `/projetos/acolitos/` — URLs de notificação usam caminho absoluto a partir da raiz (ex.: `/projetos/acolitos/index.html`).
- **Service worker:** `projetos/acolitos/sw.js` tem `const BUILD = '...'` carimbado a cada deploy; **bumpar** ao mexer no SW pra forçar atualização nos apps abertos.
- **Sons** ficam em `/midia/*.wav` (`som-estrela.wav`, `som-levelup.wav`, `silent.wav` p/ desbloqueio iOS). Web Audio/`<audio>` não toca no PWA iOS sem gesto do usuário.
- **iOS:** push em PWA exige app **instalado na tela inicial** (`navigator.standalone === true`) + iOS 16.4+.
- **Client Supabase global:** `sb`. Papel do usuário: `ctx.membership.role`; helper `navCaps(ctx).isAdmin` (coord_admin/subadmin). Auth do usuário: `ctx.user.id`. `apiPost(path, body)` → `{ok,status,data}`. `toast(msg, tipo)` (tipo `'error'` = vermelho). `uiAlert/uiConfirm/uiPrompt` (Promise).
- **Testes E2E:** manuais com a conta real superadmin do **Erick**, no iPhone dele (app instalado na tela inicial). Iteração rápida no Chrome desktop/Android. **Nunca** semear/alterar dados de contas reais — usar o próprio aviso e o aparelho do Erick.

---

## Estrutura de arquivos

```
package.json                              # +dep "web-push" (criar na raiz se não existir)
docs/migrations/047_push_subs.sql         # tabela acolitos_push_subs + RLS
projetos/acolitos/sw.js                   # handlers push/notificationclick + postMessage (bump BUILD)
projetos/acolitos/shared.js               # VAPID_PUBLIC + urlBase64ToUint8Array + ativar/desativarNotificacoes + som + botão 🔔 no "Minha conta"
midia/som-notificacao.wav                 # asset de som (toque curto)
api/enviar-push.js                        # função Vercel: envia push (tipo 'aviso'), gated coord
projetos/acolitos/escala.html             # item "📣 Avisar todos" no menu "⋯ Mais"
```

---

## Task 1: Chaves VAPID + dependência web-push + envs

**Files:**
- Modify/Create: `package.json` (raiz)
- Config: envs no Vercel (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)

**Interfaces:**
- Produces: a constante pública `VAPID_PUBLIC_KEY` (string) usada na Task 4 e no envio; segredos no Vercel usados na Task 5.

- [ ] **Step 1: Verificar/instalar `web-push` na raiz**

Run: `cd ~/iajcbp && (test -f package.json || npm init -y) && npm install web-push@^3.6.7`
Expected: `web-push` aparece em `dependencies` do `package.json` e um `package-lock.json`/`node_modules` é criado. (Se o repo não versiona `node_modules`, ok — o Vercel instala no build.)

- [ ] **Step 2: Gerar o par VAPID**

Run: `cd ~/iajcbp && npx web-push generate-vapid-keys --json`
Expected: imprime `{"publicKey":"...","privateKey":"..."}`. **Guarde os dois** (a private NÃO vai pro repo). Anote a public (vai no front na Task 4).

- [ ] **Step 3: Setar os envs no Vercel (sem imprimir os valores)**

```bash
cd ~/iajcbp
for e in production preview development; do
  printf '<PUBLIC_KEY>'  | vercel env add VAPID_PUBLIC_KEY  $e
  printf '<PRIVATE_KEY>' | vercel env add VAPID_PRIVATE_KEY $e
  printf 'mailto:coroinhas@jcbplimeira.com.br' | vercel env add VAPID_SUBJECT $e
done
vercel env ls | grep -i VAPID   # confere que existem (sem mostrar valor)
```
Expected: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` listados (Encrypted).

- [ ] **Step 4: Commit (só o package.json; segredos ficam fora)**

```bash
cd ~/iajcbp && git add package.json package-lock.json 2>/dev/null; git commit -m "chore: dependência web-push (envio de push)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Migration — tabela `acolitos_push_subs` + RLS

**Files:**
- Create: `docs/migrations/047_push_subs.sql`

**Interfaces:**
- Produces: tabela `public.acolitos_push_subs` (colunas `user_id, endpoint(unique), p256dh, auth, user_agent, criado_em, ultima_ok`). Usada pela Task 4 (insert do client) e Task 5 (leitura pela service role).

- [ ] **Step 1: Escrever a migration**

```sql
-- Acólitos — inscrições de push (um aparelho por linha, ligado ao user dono)
create table if not exists public.acolitos_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now(),
  ultima_ok timestamptz
);
alter table public.acolitos_push_subs enable row level security;

-- o dono gerencia só os próprios aparelhos (o ENVIO usa service role e ignora RLS)
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_push_subs' and policyname='Push subs do próprio dono') then
    create policy "Push subs do próprio dono" on public.acolitos_push_subs
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Confirme a conta: `list_projects` deve mostrar `fttjgsotuosjfrasttds` ("erickjcbp's Project"). Aplique com `apply_migration` (name `push_subs`, query = o SQL acima). Depois confirme:
Run (MCP `execute_sql`): `select to_regclass('public.acolitos_push_subs') is not null as tem, (select count(*) from pg_policies where tablename='acolitos_push_subs') as policies;`
Expected: `tem=true, policies=1`.

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add docs/migrations/047_push_subs.sql && git commit -m "feat(db): tabela de inscrições de push + RLS por dono

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Service worker — handlers de push, clique e postMessage

**Files:**
- Modify: `projetos/acolitos/sw.js`

**Interfaces:**
- Consumes: nada.
- Produces: ao receber push, mostra notificação `{title, body, icon, data.url}` e faz `postMessage({tipo:'push', payload})` p/ os clients (consumido na Task 6 pro som). `notificationclick` abre `data.url`.

- [ ] **Step 1: Adicionar os handlers e bumpar o BUILD**

No topo, troque o valor de `const BUILD = '...'` por um novo carimbo (ex.: a data-hora atual). No fim do arquivo, adicione:

```javascript
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
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check projetos/acolitos/sw.js`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add projetos/acolitos/sw.js && git commit -m "feat(sw): handlers de push, clique e postMessage (bump BUILD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Front — inscrição (botão 🔔) + helper VAPID

**Files:**
- Modify: `projetos/acolitos/shared.js`

**Interfaces:**
- Consumes: `sb`, `ctx.user.id`, `toast`, `uiAlert`, `navigator.serviceWorker.ready`.
- Produces: `ativarNotificacoes(btn)`, `desativarNotificacoes(btn)`, `urlBase64ToUint8Array(s)`, `renderBotaoNotificacoes(container)` — o último desenha o botão 🔔 no painel "Minha conta".

- [ ] **Step 1: Adicionar helpers + fluxo de inscrição no shared.js**

Cole a constante pública gerada na Task 1 em `VAPID_PUBLIC_KEY`. Adicione perto do bloco de service worker (após o registro do SW, ~`shared.js:33`):

```javascript
const VAPID_PUBLIC_KEY = '<PUBLIC_KEY_DA_TASK_1>';
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function notifStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'nao-suportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
async function ativarNotificacoes(btn) {
  try {
    if (notifStatus() === 'nao-suportado') { toast('Seu navegador não suporta notificações.', 'error'); return; }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS && navigator.standalone !== true) {
      uiAlert('Para receber notificações no iPhone: toque em Compartilhar → "Adicionar à Tela de Início" e abra o app por lá. Depois volte aqui e ative.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permissão negada. Ative nas configurações do navegador.', 'error'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb.from('acolitos_push_subs').upsert({
      user_id: ctx.user.id, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent,
    }, { onConflict: 'endpoint' });
    if (error) { toast('Erro ao salvar a inscrição.', 'error'); return; }
    desbloquearSomNotif(); // gesto do usuário → libera o áudio (iOS)
    toast('Notificações ativadas! 🔔', 'success');
    if (btn) pintarBotaoNotif(btn, true);
  } catch (e) { toast('Não foi possível ativar as notificações.', 'error'); }
}
async function desativarNotificacoes(btn) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('acolitos_push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    toast('Notificações desativadas.');
    if (btn) pintarBotaoNotif(btn, false);
  } catch (e) { toast('Erro ao desativar.', 'error'); }
}
function pintarBotaoNotif(btn, ativo) {
  btn.textContent = ativo ? '🔔 Notificações ativadas ✓' : '🔔 Ativar notificações';
  btn.onclick = () => (ativo ? desativarNotificacoes(btn) : ativarNotificacoes(btn));
}
async function renderBotaoNotificacoes(container) {
  if (!container) return;
  const btn = document.createElement('button');
  btn.className = 'btn-sm gray'; btn.style.width = '100%'; btn.style.marginTop = '8px';
  let ativo = false;
  try { const reg = await navigator.serviceWorker.ready; ativo = !!(await reg.pushManager.getSubscription()); } catch (_) {}
  if (notifStatus() === 'nao-suportado') { btn.disabled = true; btn.textContent = '🔔 Notificações não suportadas'; }
  else pintarBotaoNotif(btn, ativo);
  container.appendChild(btn);
}
```

- [ ] **Step 2: Chamar `renderBotaoNotificacoes` no painel "Minha conta"**

Localize onde o painel "Minha conta" é montado no `shared.js` (a função que abre o menu da conta — procure por `meUpdate` / o container do painel da conta). Ao final da montagem do painel, adicione:
```javascript
renderBotaoNotificacoes(<containerDoPainelDaConta>);
```
(substitua `<containerDoPainelDaConta>` pelo elemento real do corpo do painel). Se o painel for recriado a cada abertura, chamar ali garante o estado atual do botão.

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check projetos/acolitos/shared.js`
Expected: sem erro.

- [ ] **Step 4: Smoke test local (Chrome desktop)**

Suba `python3 -m http.server 8099` na raiz, logue com a conta de teste, abra "Minha conta". Verifique via DevTools/console:
- `typeof ativarNotificacoes === 'function'` e o botão 🔔 aparece.
- Clique 🔔 → o Chrome pede permissão → conceda → `toast` "ativadas" → confirme no Supabase: `select count(*) from acolitos_push_subs` aumentou 1 (via MCP).
Expected: 1 inscrição criada para o user de teste.

- [ ] **Step 5: Commit**

```bash
cd ~/iajcbp && git add projetos/acolitos/shared.js && git commit -m "feat(notif): inscrição de push + botão 🔔 no painel Minha conta

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Função Vercel `api/enviar-push` (tipo 'aviso')

**Files:**
- Create: `api/enviar-push.js`

**Interfaces:**
- Consumes: `web-push` (Task 1), envs VAPID (Task 1), tabela `acolitos_push_subs` (Task 2), padrão de auth de `api/acolito-admin.js`.
- Produces: `POST /api/enviar-push` body `{ tipo:'aviso', texto:string }` → 200 `{ok:true, enviados, removidos}`; 401/403 conforme auth. (F2 acrescenta outros `tipo`.)

- [ ] **Step 1: Escrever a função**

```javascript
// api/enviar-push.js — envia push (F1: tipo 'aviso' p/ todos). Só coordenação.
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VPUB = process.env.VAPID_PUBLIC_KEY, VPRIV = process.env.VAPID_PRIVATE_KEY, VSUB = process.env.VAPID_SUBJECT;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });
  if (!VPUB || !VPRIV || !VSUB) return res.status(500).json({ error: 'VAPID não configurado' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const mod = (await (await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: h })).json())[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });
  const role = (await (await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`, { headers: h })).json())[0]?.role;

  const { tipo, texto } = req.body || {};
  if (tipo !== 'aviso') return res.status(400).json({ error: 'Tipo inválido' });
  if (!['coord_admin', 'subadmin'].includes(role)) return res.status(403).json({ error: 'Acesso negado' });
  const msg = String(texto || '').trim();
  if (!msg) return res.status(400).json({ error: 'Texto vazio' });

  const subs = await (await fetch(`${URL}/rest/v1/acolitos_push_subs?select=endpoint,p256dh,auth`, { headers: h })).json();
  webpush.setVapidDetails(VSUB, VPUB, VPRIV);
  const payload = JSON.stringify({ title: 'Aviso da coordenação', body: msg.slice(0, 180), url: '/projetos/acolitos/index.html', tag: 'aviso' });

  let enviados = 0, removidos = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviados++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        removidos++;
        await fetch(`${URL}/rest/v1/acolitos_push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: h });
      }
    }
  }));
  return res.status(200).json({ ok: true, enviados, removidos });
}
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check api/enviar-push.js`
Expected: sem erro (é ESM `import`; se `node --check` reclamar do import, ok — o Vercel trata; confira ao menos que não há erro de sintaxe estrutural).

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add api/enviar-push.js && git commit -m "feat(api): enviar-push — aviso p/ todos (só coordenação)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Som de notificação (foreground/in-app)

**Files:**
- Create: `midia/som-notificacao.wav`
- Modify: `projetos/acolitos/shared.js`

**Interfaces:**
- Consumes: mensagem `postMessage({tipo:'push'})` do SW (Task 3).
- Produces: `tocarSomNotificacao()`, `desbloquearSomNotif()` (chamado no gesto de ativar, Task 4).

- [ ] **Step 1: Adicionar o asset de som**

Coloque um WAV curto e agradável em `midia/som-notificacao.wav`. Se não houver um pronto, gere um "ding" simples:
Run:
```bash
cd ~/iajcbp && python3 - <<'PY'
import wave, struct, math
sr=44100; dur=0.6
f=open('midia/som-notificacao.wav','wb'); w=wave.open(f,'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
frames=[]
for i in range(int(sr*dur)):
    t=i/sr
    env=math.exp(-4*t)
    s=0.5*env*(math.sin(2*math.pi*880*t)+0.5*math.sin(2*math.pi*1320*t))
    frames.append(struct.pack('<h', int(max(-1,min(1,s))*32767)))
w.writeframes(b''.join(frames)); w.close()
print('ok')
PY
```
Expected: cria `midia/som-notificacao.wav`. Ouça e ajuste `dur`/frequências se quiser.

- [ ] **Step 2: Adicionar tocar/desbloquear + ouvir o SW no shared.js**

Adicione perto dos helpers da Task 4:
```javascript
let _somNotif = null;
function _audioNotif() { if (!_somNotif) { _somNotif = new Audio('/midia/som-notificacao.wav'); _somNotif.preload = 'auto'; } return _somNotif; }
function desbloquearSomNotif() { try { const a = _audioNotif(); const v = a.volume; a.volume = 0; a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = v; }).catch(() => { a.volume = v; }); } catch (_) {} }
function tocarSomNotificacao() { try { const a = _audioNotif(); a.currentTime = 0; a.play().catch(() => {}); } catch (_) {} }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.tipo === 'push') tocarSomNotificacao(); });
}
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check projetos/acolitos/shared.js`
Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
cd ~/iajcbp && git add midia/som-notificacao.wav projetos/acolitos/shared.js && git commit -m "feat(notif): som de notificação (foreground/in-app) + desbloqueio iOS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Form "📣 Avisar todos" no menu ⋯ Mais da Escala

**Files:**
- Modify: `projetos/acolitos/escala.html`

**Interfaces:**
- Consumes: `apiPost('/api/enviar-push', {tipo:'aviso', texto})`, `uiPrompt`, `toast`. Menu `.escala-mais-menu` já é gated coord (só admin vê o botão ⋯ Mais).
- Produces: item de menu `📣 Avisar todos` → dispara o aviso.

- [ ] **Step 1: Adicionar o item no menu**

No `#escala-mais-menu` (dentro de `.escala-mais`), adicione um item (depois de "🎨 Arte da semana"):
```html
          <button class="mais-item" role="menuitem" onclick="maisAcao(avisarTodos)">📣 Avisar todos</button>
```

- [ ] **Step 2: Implementar `avisarTodos()`**

Perto das funções da arte em `escala.html`:
```javascript
async function avisarTodos(){
  const txt = await uiPrompt('Mensagem do aviso (chega como notificação para todos os inscritos):', { ok:'Enviar', cancel:'Cancelar' });
  if (txt == null) return;
  const msg = String(txt).trim();
  if (!msg) { toast('Digite uma mensagem.','error'); return; }
  const r = await apiPost('/api/enviar-push', { tipo:'aviso', texto: msg });
  if (r && r.ok) toast('Aviso enviado' + (r.data && typeof r.data.enviados==='number' ? (' ('+r.data.enviados+' aparelho(s))') : '') + '.','success');
  else toast((r && r.data && r.data.error) || 'Falha ao enviar o aviso.','error');
}
```

- [ ] **Step 3: Verificar sintaxe dos scripts inline**

Run:
```bash
cd ~/iajcbp && node -e 'const fs=require("fs");const h=fs.readFileSync("projetos/acolitos/escala.html","utf8");const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,i=0;while((m=re.exec(h))){fs.writeFileSync("/tmp/_a"+(i++)+".js",m[1]);}' && for f in /tmp/_a*.js; do node --check "$f" && echo OK || echo ERRO; done; rm -f /tmp/_a*.js
```
Expected: OK para todos.

- [ ] **Step 4: Commit**

```bash
cd ~/iajcbp && git add projetos/acolitos/escala.html && git commit -m "feat(escala): '📣 Avisar todos' no menu ⋯ Mais (dispara push aviso)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Deploy + teste ponta a ponta (iPhone do Erick)

**Files:** nenhum (integração/deploy).

- [ ] **Step 1: Merge na main + deploy**

```bash
cd ~/iajcbp && git checkout main && git merge --ff-only feat-notificacoes-push && git push origin main
```
Expected: push aceito. Vercel deploya produção (confira `vercel ls` → última Production `● Ready`). Envs VAPID já setados (Task 1).

- [ ] **Step 2: Ativar no aparelho do Erick**

No iPhone do Erick: abrir `coroinhas.jcbplimeira.com.br` no Safari → Compartilhar → **Adicionar à Tela de Início** → abrir o app por lá → logar (superadmin Erick) → "Minha conta" → **🔔 Ativar notificações** → conceder permissão.
Expected: toast "ativadas"; via MCP `select count(*) from acolitos_push_subs where user_id = <uid do Erick>` = 1.

- [ ] **Step 3: Enviar um aviso e confirmar a chegada**

No app (Erick é coord) → Escala → ⋯ Mais → **📣 Avisar todos** → escrever "Teste de notificação" → Enviar.
Expected: a **notificação chega no iPhone** (mesmo com o app em background/fechado). Com o app aberto, **toca o som**. Tocar a notificação abre o app. `apiPost` retorna `{ok:true, enviados>=1}`.

- [ ] **Step 4: Iteração rápida (opcional, Chrome desktop/Android)**

Repetir ativar + aviso no Chrome para depurar sem depender do iPhone (o Chrome mostra a notificação do sistema e toca o som com o app aberto).

- [ ] **Step 5: Apagar a branch mergeada (após confirmação do Erick)**

```bash
cd ~/iajcbp && git branch -d feat-notificacoes-push
# remota: só com autorização explícita do Erick
```

---

## Validação final (F1)
1. Botão 🔔 ativa/desativa; inscrição gravada/removida em `acolitos_push_subs`.
2. "📣 Avisar todos" (coord) → notificação chega no aparelho inscrito.
3. Com o app aberto, o som toca; com fechado, som do sistema.
4. iOS: só funciona com o app na Tela de Início (o botão orienta se não estiver).
5. Inscrição morta (410/404) é podada no envio.

## Notas
- **F2** (próxima sessão): gatilhos automáticos `escalado` / `ausencia` / `troca` ligados aos fluxos existentes, reusando `api/enviar-push` (novos `tipo` + autorização por tipo no servidor).
- Não versionar `VAPID_PRIVATE_KEY`. Se `node_modules` não é versionado, garantir que `web-push` está em `dependencies` do `package.json` da raiz (o Vercel instala no build).

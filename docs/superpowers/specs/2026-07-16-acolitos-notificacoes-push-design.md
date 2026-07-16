# Notificações Push no celular (Acólitos) — Design

**Data:** 2026-07-16
**Status:** aprovado (abordagem A)

## Objetivo

Enviar notificações push para o celular dos membros do app Acólitos (PWA já instalável), disparadas por 4 eventos:

1. **Fui escalado** — a escala foi publicada/gerada e o membro foi escalado (ou teve escala alterada por auto-troca).
2. **Minha ausência foi respondida** — a coordenação aprovou/recusou uma ausência pedida pelo membro.
3. **Convite de troca** — alguém pediu troca de missa com o membro.
4. **Aviso da coordenação** — comunicado de texto livre disparado manualmente pela coordenação **para todos**.

Opt-in por **botão "🔔 Ativar notificações"** (necessário por causa do gesto exigido no iOS).

## Abordagem escolhida (A)

Enviador próprio no **Vercel serverless** usando a lib **`web-push`** com chaves **VAPID** — mesma linha de `api/acolito-admin.js` / `api/regenerar-arte.js`. Sem terceiros, dados não saem da infra própria, iOS suportado.

Rejeitadas: (B) Supabase Edge Function por gatilho de banco — infra nova pro Acólitos, mais complexa; (C) OneSignal/Firebase — adiciona terceiro e exporta dados dos membros.

## Arquitetura

```
[Membro toca 🔔 Ativar] → Notification.requestPermission() → pushManager.subscribe(VAPID_PUB)
     → INSERT direto no Supabase (acolitos_push_subs, RLS: só o próprio user)

[Evento no app] → chama /api/enviar-push {tipo, alvo}  (Bearer do usuário)
     → api valida no servidor se o chamador pode enviar aquele tipo (service role)
     → resolve user_ids alvo → lê acolitos_push_subs → web-push (VAPID_PRIV) p/ cada aparelho
     → poda inscrições mortas (410/404)

[Aparelho recebe push] → sw.js 'push' mostra notificação → 'notificationclick' abre a tela certa
```

## Componentes

### 1. Chaves VAPID
- Um par gerado uma vez (`npx web-push generate-vapid-keys`).
- `VAPID_PUBLIC_KEY` — também embutida no front (constante em `shared.js`, não é segredo).
- `VAPID_PRIVATE_KEY` — **só** em env do Vercel (produção/preview/dev).
- `VAPID_SUBJECT` — `mailto:...` (contato exigido pelo protocolo).

### 2. Tabela `acolitos_push_subs`
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| user_id | uuid not null | `auth.uid()` do dono do aparelho |
| endpoint | text not null unique | identifica o aparelho/inscrição |
| p256dh | text not null | chave da inscrição |
| auth | text not null | chave da inscrição |
| user_agent | text | p/ debug ("iPhone Safari" etc.) |
| criado_em | timestamptz default now() | |
| ultima_ok | timestamptz | atualizado a cada envio bem-sucedido |

- **RLS:** `user_id = auth.uid()` para insert/select/delete (o membro gerencia só os aparelhos dele). O envio usa **service role** (ignora RLS) para ler todas as inscrições do alvo.
- Um membro pode ter vários aparelhos (várias linhas). Só membros com conta (`user_id`) recebem push.
- **Inscrição é feita direto pelo client** via `sb.from('acolitos_push_subs').upsert(...)` (RLS garante o dono) — **não** precisa de endpoint de servidor para inscrever. Ligar = recebe os 4 tipos (sem preferências por tipo no v1 — YAGNI).

### 3. Service worker (`projetos/acolitos/sw.js`)
Adicionar dois handlers (e **bumpar o BUILD** p/ atualizar os apps abertos):
- `push`: lê `event.data.json()` `{title, body, url, tag}` e `showNotification` com ícone do app (`icon-192.png`).
- `notificationclick`: fecha a notificação e faz `clients.openWindow(url)` (ou foca uma aba já aberta na mesma origem).

### 4. Opt-in no front (`shared.js`)
- Botão **🔔 Ativar notificações** no painel **"Minha conta"** (renderizado pelo header em todas as telas → todo membro alcança). Mostra estado: *Ativar* / *Ativado ✓ (desativar)*.
- `ativarNotificacoes()`:
  1. Feature-detect (`serviceWorker`, `PushManager`, `Notification`). Se não suportado → aviso.
  2. **iOS:** se for iPhone e o app **não** estiver instalado na tela inicial (`navigator.standalone !== true`) → mostra instrução de "Adicionar à Tela de Início" e aborta (pré-requisito do iOS 16.4+).
  3. `Notification.requestPermission()` (a partir do clique — gesto do usuário). Se negado → orienta reativar nas configs do navegador.
  4. `reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })`.
  5. `upsert` no `acolitos_push_subs` (endpoint como chave de conflito), com `user_id = ctx.user.id` e `user_agent`.
  6. Atualiza o botão p/ "Ativado ✓".
- `desativarNotificacoes()`: `sub.unsubscribe()` + `delete` da linha (por endpoint).

### 5. Enviador `api/enviar-push.js` (Vercel, service role)
- POST, `Authorization: Bearer <token do usuário>`; body `{ tipo, ...alvo, payload? }`.
- **Autorização por tipo (no servidor, sem confiar no client):**
  - `aviso` / `escalado` / `ausencia`: chamador precisa ser `coord_admin`/`subadmin` (mesma checagem de `acolito-admin.js` via `acolitos_get_role`/`pastoral_members`).
  - `troca`: chamador é membro comum — o servidor **confere no banco** que existe um convite de troca pendente do chamador para o `membro_id` alvo (evita spam).
- Resolve os `user_id` do alvo → lê `acolitos_push_subs` → envia `web-push` com o payload por tipo:
  - **aviso** → `{title:'Aviso da coordenação', body:<texto>, url:'/projetos/acolitos/index.html'}` para **todos** os inscritos.
  - **escalado** → `{title:'Você foi escalado', body:<missa/data>, url:.../escala...}`.
  - **ausencia** → `{title:'Ausência <aprovada|recusada>', body:..., url:.../ausencias}`.
  - **troca** → `{title:'Convite de troca', body:<quem/missa>, url:.../central do servo}`.
- **Poda:** se o push retornar 404/410 (inscrição morta), deleta a linha.
- Envios em lote toleram falha individual (um aparelho ruim não derruba o resto).

### 6. Gatilhos (ligados aos fluxos existentes)
- **aviso** — form novo de coordenação (texto → "Enviar para todos"). Local: item no menu "⋯ Mais" da Escala **ou** no painel de coordenação (definir no plano). **Entra na F1** (é o mais fácil de testar ponta a ponta).
- **escalado** — ao publicar/gerar a escala e na auto-troca (F2).
- **ausencia** — na aprovação/recusa de ausência pela coordenação (F2).
- **troca** — ao pedir troca na Central do Servo (F2).

## iOS (atenção)
Push em PWA no iPhone exige: **app instalado na tela inicial** (iOS 16.4+) + permissão concedida a partir de um gesto. O botão detecta o caso "não instalado" e orienta. Android/desktop Chrome funcionam sem instalar (bom p/ iterar).

## Segurança
- `VAPID_PRIVATE_KEY` só em env do Vercel; nunca no repo/front.
- RLS na `acolitos_push_subs`: cada membro só enxerga/gerencia os próprios aparelhos.
- Autorização por tipo validada no servidor (o celular não forja quem notificar).
- Payload mínimo (sem dado sensível além do necessário p/ a mensagem).

## Testes
Manuais, **com a conta real superadmin do Erick, no iPhone dele** (app instalado na tela inicial) — não-destrutivo (só recebe notificação). Fluxo: tocar 🔔 Ativar → conceder permissão → coordenação envia um "aviso p/ todos" → a notificação chega no aparelho → tocar abre o app. Iteração rápida também no Chrome desktop/Android. **Não** semear/alterar dados de contas reais para testar (usar o próprio aviso e o aparelho do Erick).

## Faseamento (1 fase por sessão)
- **F1 — Base + Aviso:** VAPID + tabela + RLS + handlers no `sw.js` + botão 🔔 (opt-in/opt-out) + `api/enviar-push` + gatilho **aviso p/ todos** + form da coordenação. Testável ponta a ponta no iPhone do Erick.
- **F2 — Gatilhos automáticos:** escalado, ausência respondida, convite de troca ligados aos fluxos existentes.

## Dependências
- Lib `web-push` no `package.json` do projeto (usada pela função Vercel).
- Env Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (+ `SUPABASE_*` que já existem).
- Migration nova (próximo número livre em `docs/migrations/`, ex.: `047_push_subs.sql`).

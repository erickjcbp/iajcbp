# Página pública de ausências (`/ausencias`) — Acólitos

**Data:** 2026-06-09
**Status:** aprovado (design), aguardando plano de implementação

## Objetivo

Oferecer uma página **pública** (sem login) em `coroinhas.jcbplimeira.com.br/ausencias`
onde qualquer pessoa (pai/responsável, líder de comunidade, o próprio coroinha)
possa **informar a ausência de um ou mais coroinhas** em uma ou mais datas, e enviar.

As submissões públicas **não** afetam a escala/dados reais diretamente: entram numa
**fila de pendências**, e a equipe/cerimoniário **confirma dentro do app** antes de
qualquer impacto na escala.

## Princípio de segurança

O projeto acabou de passar por um endurecimento (ver [[project_acolitos_seguranca]]):
anon não executa nenhuma das funções `SECURITY DEFINER`. Esta feature **reabre o
acesso anônimo de forma mínima e controlada**:

- Apenas **2 funções** ganham `GRANT EXECUTE TO anon`.
- A função de busca devolve **somente `id + nome`** de membros ativos — sem foto,
  telefone, endereço ou qualquer PII sensível.
- A função de envio **só grava na fila de pendências** — nunca lê nem escreve a
  escala real (`acolitos_ausencias`, `acolitos_escalas`, etc.).
- Submissões públicas ficam isoladas até revisão humana.

**Limitação assumida (não-objetivo):** sem login, um robô determinado ainda pode
iterar a busca para coletar nomes ou floodar a fila. O modelo pendente neutraliza o
*impacto* (nada vai para a escala sem revisão; a fila é limpável). Rate-limit forte
(captcha / PIN / regra de firewall) fica como melhoria futura, fora do escopo deste spec.

## Componentes

### 1. Tabela `acolitos_ausencias_pendentes`

Separada da `acolitos_ausencias` (que guarda ausências confirmadas).

| coluna | tipo | nota |
|--------|------|------|
| `id` | uuid pk default gen_random_uuid() | |
| `membro_id` | uuid not null → acolitos_membros(id) | |
| `data` | date not null | dia da ausência (celebração resolvida na aprovação) |
| `motivo` | text null | opcional, informado pelo público |
| `informante_nome` | text null | quem enviou o aviso |
| `informante_contato` | text null | telefone opcional |
| `status` | text not null default 'pendente' | `pendente` \| `aprovada` \| `rejeitada` |
| `created_at` | timestamptz not null default now() | agrupa um envio |
| `revisado_por` | uuid null → auth.users(id) | quem decidiu |
| `revisado_em` | timestamptz null | |

- Granularidade **uma linha por (membro × data)**: selecionar 3 coroinhas × 2 datas
  gera 6 linhas, permitindo aprovar/rejeitar linha a linha.
- Linhas de um mesmo envio compartilham `informante_*` e `created_at` (agrupamento na UI).
- RLS **ligada**. Sem policies para anon/authenticated (gravação e leitura passam só
  pelas RPCs `SECURITY DEFINER`). Acesso humano via as RPCs internas guardadas.

### 2. RPCs públicas (`SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`)

**`acolitos_ausencia_publica_buscar(p_q text) RETURNS jsonb`**
- Guarda: `length(btrim(p_q)) >= 2` senão retorna `[]`.
- Retorna `[{id, nome}]` de `acolitos_membros where status='ativo' and nome ILIKE '%q%'`,
  ordenado por nome, **limite 20**.
- Nada além de `id` e `nome`.

**`acolitos_ausencia_publica_enviar(p_membros uuid[], p_datas date[], p_motivo text, p_informante text, p_contato text) RETURNS jsonb`**
- Validações:
  - `array_length(p_membros,1)` entre 1 e 20; `array_length(p_datas,1)` entre 1 e 30.
  - cada `p_membros[i]` existe em `acolitos_membros` com `status='ativo'` (ignora ids inválidos).
  - cada data: não nula e dentro de uma janela razoável (ex.: de hoje a +180 dias);
    descarta datas no passado distante / nulas.
  - `p_motivo`/`p_informante`/`p_contato`: truncados a um tamanho máximo (ex.: 200 chars)
    para evitar payload abusivo.
- Insere uma linha pendente por (membro válido × data válida) com `status='pendente'`.
- Idempotência: índice único parcial `unique (membro_id, data) where status='pendente'`
  + `insert ... on conflict do nothing` (não duplica o mesmo membro+data ainda pendente).
- Retorna `{ok:true, criadas:<n>}` (ou `{erro:'sem_itens'}` se nada válido).

### 3. RPCs internas (`SECURITY DEFINER`, guarda de papel, `GRANT` só authenticated)

Guarda: `acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')`
(mesmos papéis que já gerem ausências) **ou** cerimoniário, alinhado à RLS atual de
`acolitos_ausencias`. Reusar o critério exato da tela existente.

**`acolitos_ausencia_pendente_listar() RETURNS jsonb`**
- Retorna as pendências `status='pendente'` agrupadas por envio
  (`created_at` + `informante_*`), com `[{id, membro_id, nome, data, motivo}]`.

**`acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text) RETURNS jsonb`**
- `p_acao='aprovar'`: para cada id pendente, insere em `acolitos_ausencias`
  (`membro_id`, `data`, `motivo`, `celebracao_id = null`) seguindo o mesmo padrão de
  upsert/onConflict da tela atual; marca a pendência `status='aprovada'`,
  `revisado_por=auth.uid()`, `revisado_em=now()`.
- `p_acao='rejeitar'`: marca `status='rejeitada'` + auditoria, sem tocar a escala.
- Retorna `{ok:true, aprovadas/rejeitadas:<n>}`.

### 4. Página pública `projetos/acolitos/ausencias-publica.html`

- Standalone, leve, com client Supabase próprio usando **apenas a anon key**
  (mesmo padrão do `login.html`). **Não** carrega `shared.js`, **não** exige sessão.
- Fluxo:
  1. Campo de busca por nome (mín. 2 letras, debounce) → resultados clicáveis.
  2. Adiciona vários à lista de selecionados (chips removíveis).
  3. Escolhe uma ou mais datas.
  4. Preenche (opcional) informante, motivo, contato.
  5. Enviar → chama `acolitos_ausencia_publica_enviar` → tela de confirmação
     ("Recebido! A equipe vai confirmar.").
- Visual alinhado ao tema do app (mesma paleta/estilo do `login.html`).

### 5. Rota no `vercel.json`

Adicionar um **rewrite** (mantém a URL limpa, sem trocar para o caminho do arquivo),
restrito ao host `coroinhas.jcbplimeira.com.br`:

```json
{ "source": "/ausencias",
  "has": [{ "type": "host", "value": "coroinhas.jcbplimeira.com.br" }],
  "destination": "/projetos/acolitos/ausencias-publica.html" }
```

Não conflita: `/ausencias` (raiz do domínio) está livre hoje; o `ausencias.html`
existente vive em `/projetos/acolitos/` e é acessado dentro do app.

### 6. Revisão no app (tela existente `ausencias.html`)

Adicionar uma seção **"Avisos recebidos (pendentes)"** visível para equipe/cerimoniário,
listando a fila (`acolitos_ausencia_pendente_listar`) com botões **Aprovar** / **Rejeitar**
(em lote por envio ou por linha), chamando `acolitos_ausencia_pendente_decidir`.
Badge com a contagem de pendentes.

## Fluxo de dados

```
Público (/ausencias, anon)
   └─ buscar(q) ─────────────► [id,nome] (≤20, só ativos)
   └─ enviar(membros,datas,…) ► INSERT acolitos_ausencias_pendentes (status=pendente)

Equipe (app, autenticado)
   └─ listar() ──────────────► fila pendente agrupada
   └─ decidir(ids,'aprovar') ─► INSERT acolitos_ausencias + UPDATE pendente=aprovada
   └─ decidir(ids,'rejeitar')─► UPDATE pendente=rejeitada
```

## Tratamento de erros

- Busca com <2 letras → lista vazia (sem erro ruidoso).
- Envio sem itens válidos → mensagem amigável "selecione ao menos um coroinha e uma data".
- IDs/datas inválidos → silenciosamente ignorados na RPC (não trava o envio).
- RPC interna sem papel → `{erro:'sem_permissao'}`, UI mostra "sem permissão".
- Aprovar item já decidido → no-op idempotente.

## Migrations / versionamento

- Nova migration `db/seguranca/004_ausencias_publica.sql` (toca grants/RLS/anon, segue
  a sequência das migrations de segurança): tabela, índices, RLS, as 4 funções e os
  GRANTs (anon nas 2 públicas; authenticated nas 4).
- Página e `vercel.json` versionados no repo; deploy do **root** (regra do projeto).

## Fora de escopo (YAGNI)

- Rate-limit / captcha / PIN (melhoria futura se houver abuso).
- Notificar o coroinha/responsável sobre a ausência confirmada.
- Editar uma submissão pendente (só aprovar/rejeitar; reenvio refaz).
- Ausência por celebração específica ou intervalo de datas (escolhido: datas avulsas).

# Competências como Virtudes da Jornada (Acólitos) — Design

Data: 2026-06-16
Status: aprovado (brainstorming)

## Contexto
Decisão de produto: a frente de "desenvolvimento por listas" hoje é vestigial.
Investigação (banco real, ref `fttjgsotuosjfrasttds`):
- **Habilidades** (`acolitos_listas` tipo `habilidade`, 13 itens) = a MESMA lista
  das Funções litúrgicas (Altar, Cruz, Turíbulo…). Redundante com a grade de
  proficiência real (`acolitos_habilitacoes`, que alimenta escala e Mapa de
  Cobertura). **Decisão: aposentar** (parar de exibir; sem migração de dados).
- **Competências** (`acolitos_listas` tipo `competencia`, 26 itens) = virtudes /
  soft skills (Humildade, Liderança, Pontualidade, Espiritualidade, Trabalho em
  equipe…). Dimensão legítima e distinta — formação de caráter.
- Uso atual quase nulo: ~5/169 membros têm dados nos arrays
  (`competencias_desenvolvidas`, `desenvolvimento_competencias`).
- **Elo já existente mas nunca ligado:** quests (`acolitos_missoes`) têm um campo
  `criterio.competencia` ("Competência que a quest trabalha", editável no Config;
  exibido em `missoes.html` como "💪 Trabalha: X"). As quests já estão ricamente
  marcadas (humildade ×6, comunicação ×5, discernimento ×4, postura, disciplina,
  liderança, mentoria…). Mas concluir a quest **não** credita a virtude — esse é
  o buraco.

Decisões do usuário (brainstorming):
- **Modelo 1 (Selo da coordenação com evidência):** quests dão progresso
  (evidência); a virtude só vira "formada" quando a **coordenação confirma**.
  Quest fácil sozinha nunca forma virtude.
- **Limiar de progresso configurável** (atende o medo de "fácil demais") —
  inclusive override por competência (virtude importante = limiar maior).
- **Sem crédito retroativo:** só conta progresso de quests concluídas a partir
  da data de início da feature.
- **Aposentar Habilidades.**

Estruturas relevantes (verificadas):
- `acolitos_missao_progresso(missao_id, membro_id, status, xp_ganho,
  concluida_em timestamptz, ...)` — conclusão = `status='concluida'`.
- `acolitos_missoes(id, criterio jsonb, ...)` — `criterio->>'competencia'`.
- `acolitos_membros.competencias_desenvolvidas text[]` — **reutilizado** como
  "virtudes seladas pela coordenação".
- `acolitos_listas(tipo='competencia', valor, label, meta jsonb)` — `meta` já
  usado p/ `faixa`; ganha `meta.limiar` (override por virtude).
- `acolitos_config` — chave/valor (override-com-fallback) para limiar padrão e
  data de início.
- Perfil do membro: `shared.js` (~l.208-211) renderiza chips de habilidades e
  competências (a desenvolver / desenvolvidas).
- Editor atual de competências na Jornada: `jornada-admin.html`
  `abrirCompetenciasEditor` (~l.625) + `renderCompLista` (~l.652).

## Arquitetura

Deriva quase tudo; o único estado gravado é o **selo** (array existente) + a
**config** (limiares + data de início). Sem tabela nova.

### Estados de uma virtude (por membro)
1. **nenhuma** — progresso 0, não selada.
2. **em_formacao** — `0 < progresso < limiar`.
3. **candidata** — `progresso >= limiar` e ainda não selada (coordenação pode
   confirmar).
4. **formada** — `valor ∈ competencias_desenvolvidas` (selo humano). Independe do
   progresso atual (uma vez selada, fica).

`progresso` = nº de quests **concluídas** que carregam aquela competência,
contando só `concluida_em >= competencia_inicio`. (Contagem simples de quests;
ponderação por XP fica fora de escopo nesta versão.)

`limiar` = `acolitos_listas.meta.limiar` da competência (se houver) senão o
padrão global `competencia_limiar_padrao` (default 3).

## Componentes

### 1. RPC `acolitos_competencias_progresso(p_membro uuid)` (nova, migration 044)
SECURITY DEFINER, STABLE, search_path=public. Retorna `jsonb` array, um item por
competência cadastrada (`acolitos_listas` tipo `competencia`):
```json
{ "valor": "...", "label": "...", "progresso": 2, "limiar": 3,
  "formada": false, "status": "em_formacao" }
```
Lógica:
- `inicio` = `acolitos_config` chave `competencia_inicio` (date; se ausente, usa
  a data de criação da própria config / fallback que não conte nada antigo —
  decidir um default seguro: se não houver, contar a partir de hoje).
- `padrao` = `competencia_limiar_padrao` (int, default 3).
- `progresso` por competência = `count(*)` de `acolitos_missao_progresso mp join
  acolitos_missoes m on m.id=mp.missao_id` onde `mp.membro_id=p_membro and
  mp.status='concluida' and mp.concluida_em >= inicio and
  m.criterio->>'competencia' = listas.valor`.
- `limiar` = `coalesce((listas.meta->>'limiar')::int, padrao)`.
- `formada` = `listas.valor = any(membro.competencias_desenvolvidas)`.
- `status` derivado conforme estados acima.
Permissão de EXECUTE: `anon` NÃO; `authenticated` sim (membro vê o próprio;
coordenação vê de qualquer um — a RPC recebe `p_membro`, então a tela controla
quem consulta). Idêntico padrão das demais RPCs do módulo.

Migration local: `docs/migrations/044_acolitos_competencias_virtudes.sql`
(versionada) + aplicar via Supabase MCP. Inclui também o **seed das chaves de
config** (`competencia_limiar_padrao=3`, `competencia_inicio=<data de hoje>`).

### 2. Config (limiares + início)
- **Global:** `competencia_limiar_padrao` e `competencia_inicio` — editáveis no
  painel `config.html` (seção do módulo Jornada/Desenvolvimento) OU, mais
  simples, num cabeçalho da seção de competências na Jornada. Decisão: editar na
  **Jornada** (junto da lista de competências) para manter tudo no mesmo lugar.
- **Por competência:** `renderCompLista` (Jornada) ganha um input numérico
  "limiar" por linha, gravando em `acolitos_listas.meta.limiar` (merge com o
  `meta` existente, preservando `faixa`).

### 3. Coordenação — Jornada → Desenvolvimento (repurpose do editor de Competências)
Substitui o checklist binário atual (`abrirCompetenciasEditor`). Ao abrir o
modal de competências de um membro:
- Carrega `acolitos_competencias_progresso(membro.id)`.
- Para cada virtude: nome, **barra progresso/limiar** (ex.: "2/3"), selo de
  status (em formação / 🟡 candidata / ✅ formada), e ação:
  - **candidata/em_formacao** → botão "Confirmar virtude" → adiciona `valor` a
    `competencias_desenvolvidas` (update no membro).
  - **formada** → botão "Retirar selo" → remove de `competencias_desenvolvidas`.
- Candidatas aparecem destacadas no topo ("prontas para confirmar").
- O card do membro na lista (l.462) passa a contar virtudes **formadas**.

### 4. Membro — perfil/jornada (`shared.js`)
No bloco de chips (~l.208-211):
- **Remove** os 2 chips de Habilidades (a desenvolver / desenvolvidas).
- **Remove** o chip "Competências a desenvolver" (`desenvolvimento_competencias`
  — o órfão; "em formação" agora vem das quests).
- **Mantém/renomeia** "✨ Virtudes formadas" = `competencias_desenvolvidas`.
- **Adiciona** "Em formação" = virtudes com `status in (em_formacao,candidata)`,
  via a RPC (barras progresso/limiar). Se a RPC não estiver disponível no
  contexto (ex.: perfil renderizado sem permissão), degrada para mostrar só as
  formadas.

### 5. Aposentar Habilidades
- Parar de exibir habilidades em `shared.js` (perfil) e em qualquer aba.
- Manter colunas `habilidades_desenvolvidas` / `desenvolvimento_habilidades` no
  banco (sem migração; apenas não exibidas).
- Se houver editor de "habilidades" na Jornada/Membros além das Funções, retirar
  da UI (verificar `membros.html` l.477/483 — só rótulos; confirmar no plano).

## Fluxo de dados
1. Membro conclui quests (fluxo de missões existente — inalterado).
2. Progresso por virtude é **derivado on-the-fly** pela RPC (nada gravado).
3. Coordenação vê candidatas e **sela** → grava no array.
4. Perfil do membro mostra formadas + em formação.

## Erros / bordas
- Sem `competencia_inicio` na config → RPC usa hoje (não conta histórico) —
  respeita "só daqui pra frente".
- Quest sem `criterio.competencia` → não contribui (esperado).
- Virtude selada cujo progresso depois cai (improvável) → continua formada (selo
  é decisão humana, não recalculada).
- Limiar inválido/zero na config → trata como padrão.
- Retirar selo de uma virtude → volta a candidata/em formação conforme progresso.

## Fora de escopo
- Selo automático (sempre humano).
- Crédito retroativo de quests antigas.
- Ponderação por XP/liga no progresso (contagem simples por ora).
- Mexer no gerador de quests ou no fluxo de conclusão/aprovação de missões.
- Migrar/remover colunas do banco.

## Validação
Sem framework de teste. Validar por:
- Testar a RPC como `authenticated` (impersonar) num membro com quests concluídas
  marcadas — conferir contagem e status.
- Conferir o editor da Jornada (progresso, candidata, selar/retirar) com membro
  descartável.
- Conferir o perfil do membro (formadas + em formação; sem habilidades).
- Checagem de sintaxe dos blocos `<script>` via `node`.
- Migration aplicada via MCP + versionada em `docs/migrations/044_*.sql`.

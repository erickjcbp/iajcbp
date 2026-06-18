# Panorama por Membro (PDF) — Design

Data: 2026-06-18
Status: aprovado (brainstorming)

## Contexto
Quarto relatório sobre a Central de Relatórios (fundação `abrirRelatorio`/`baixarCSV`
já em `shared.js`). Objetivo: um "boletim" imprimível por acólito.

Fatos do código (verificados em `projetos/acolitos/jornada-admin.html` salvo nota):
- `abrirPanorama(m)` (l.547-635) já busca, em paralelo, **3 RPCs/membro**:
  `acolitos_missoes_board({p_membro,p_niveis})` → `{capitulos[],bonus[],pendencias[],proximo_nivel,elegivel,xp_total,erro?}`;
  `acolitos_estrelas({p_membro})` → `{estrelas}`; `acolitos_badges_membro({p_membro})`
  → `[{id,label,nivel,validacao,ganho}]`. Quests: `{id,titulo,status,obrigatoria,validacao,xp}`.
- `fetchFrequencia(membroId)` (shared.js l.1839) — query à view `acolitos_frequencia`:
  com `membroId` → 1 row; sem arg → 1 query, mapa `membro_id→row`. Campos da view
  (confirmados): `total_escalas, servidas, faltas_just, faltas_nao_just, atrasos,
  pendentes, taxa, ultima_participacao`.
- Proficiência por função: `habAll[membro_id][funcao]` (global, `carregarHabAll`);
  `_profDe(mId,funcao)`; `_devFuncoes` `[[valor,label]]`; `PROF_LABEL`/`PROF_NIVEIS`.
- Virtudes formadas: `m.competencias_desenvolvidas` (array de slugs); labels via
  `_devComps`/`_compLabelMap()`.
- `_devMembros` (carregarDev select, l.464-473) traz `id,nome,apelido,nivel,foto_url,
  competencias_desenvolvidas,desenvolvimento_competencias` — **não traz comunidade/nascimento**.
- `nivelInfo(slug)` → objeto `{label,titulo,...}`. `buildRankEmblem` retorna DOM animado
  (não usar em print). Botões do card em l.519-521 (`mk(...)`). Fundação: `abrirRelatorio({titulo,subtitulo,corpo,css})`.

Decisão do usuário: **individual (rico) + lote (leve)**.

## Escopo
- Modify: `projetos/acolitos/jornada-admin.html` (relatórios) e ajuste de 1 select.
- Reusa a fundação em `shared.js` (sem mexer nela).
- **Fora de escopo:** lote "rico" com quests (custo ~500 RPCs); gráficos; emblema animado no PDF.

## Ajuste de dados
- Em `carregarDev` (l.464-473), **acrescentar `comunidade,data_nascimento`** ao select de
  `acolitos_membros` (1 query global, custo zero) — para o cabeçalho do boletim ter
  comunidade e idade.

## Componente 1 — Panorama individual (rico)
- **Botão 🖨 no modal `abrirPanorama`**: adicionar um botão "🖨 Imprimir" no modal
  (perto do "Fechar"), chamando `gerarPanoramaPDF(m, board, est, badges)` com os dados
  que o modal **já buscou** (zero RPC extra).
- `gerarPanoramaPDF(m, board, est, badges)`:
  - `freq = await fetchFrequencia(m.id)` (1 query).
  - Funções do membro: iterar `_devFuncoes`, classificar `_profDe(m.id,val)` →
    **aptas** (`apto|experiente|referencia`, com label + nível), **em formação**, e
    contagem de não treinadas.
  - Virtudes: `m.competencias_desenvolvidas` → labels via `_compLabelMap()`.
  - Monta `corpo` (HTML) com seções:
    1. **Cabeçalho:** nome, nível (`nivelInfo(m.nivel).label` + título), comunidade, idade.
    2. **Jornada:** `✦ XP` (`board.xp_total`), estrelas (`est.estrelas`), próximo nível
       (`board.proximo_nivel` + "elegível" se `board.elegivel`); contadores de quests
       (concluídas/análise/pendentes — derivados de `caps.missoes`+`bonus` por `status`);
       capítulos rumo ao próximo (lista título+status+xp); funções pendentes
       (`board.pendencias[].label`); medalhas especiais (`badges` `!nivel && validacao==='avaliada'`,
       com ✓ se `ganho`).
    3. **Funções:** aptas (lista), em formação (lista), "não treinadas: N".
    4. **Virtudes formadas:** lista (ou "—").
    5. **Frequência:** servidas, faltas (just+não just), taxa %, última participação.
  - `abrirRelatorio({ titulo:'Panorama — '+(m.apelido||m.nome), subtitulo:'Acólitos', corpo })`.
  - Se `board?.erro` → usar só o que dá (cadastro + funções + virtudes + frequência) e
    omitir a seção Jornada (sem quebrar).

## Componente 2 — Boletins em lote (leve)
- **Botão 🖨 Boletins (todos)** na aba Desenvolvimento (no card da lista de membros,
  perto dos filtros, l.441+). Chama `gerarPanoramasLote()`.
- `gerarPanoramasLote()` (sem RPC por membro):
  - `freqMap = await fetchFrequencia()` (1 query, mapa de todos).
  - Para cada liga (`LIGAS_DEV`) e cada membro (`_membrosDaLiga`), monta um bloco
    `<div class="pg">` (uma página) com: cabeçalho (nome, nível, comunidade, idade),
    **funções** (aptas/em formação/contagem), **virtudes formadas**, **frequência**
    (de `freqMap[m.id]`). **Sem** seção de quests.
  - `css` extra: `.pg{ page-break-after:always; }` (1 membro por página na impressão).
  - `abrirRelatorio({ titulo:'Boletins de Desenvolvimento', subtitulo:'Acólitos · '+_devMembros.length+' membros', corpo, css })`.

## Helpers compartilhados (entre individual e lote)
- `_funcoesDoMembro(mId)` → `{aptas:[labels], form:[labels], naoTreino:N}`.
- `_freqHtml(freq)` → linha/tabela de frequência (servidas/faltas/taxa/última).
- `_cabecalhoBoletim(m)` → HTML do cabeçalho (nome/nível/comunidade/idade), com idade
  via cálculo inline de `data_nascimento`.
Reaproveitados nos dois componentes (DRY).

## Erros / bordas
- Pop-up bloqueado → a fundação já avisa (`toast`).
- `board.erro` no individual → omite Jornada.
- Frequência ausente (`freq`/`freqMap[id]` null) → mostra "sem dados".
- Lote grande (~169 páginas) → ok para imprimir/salvar PDF; o usuário escolhe o range na impressão.

## Validação
- Sintaxe dos `<script>` de jornada-admin.html via `node`.
- Manual no deploy (root): abrir Panorama de um membro → 🖨 gera o boletim rico (com
  quests/frequência); na aba Desenvolvimento → 🖨 Boletins (todos) gera 1 página por
  membro (leve), agrupado por liga, com quebra de página. Pop-ups permitidos.
- Deploy do **root**; conferir `iajcbp-...`.

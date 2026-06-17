# Relatório de Desenvolvimento (Mapa de Cobertura) — Design

Data: 2026-06-17
Status: aprovado (brainstorming)

## Contexto
A aba **Desenvolvimento** (`projetos/acolitos/jornada-admin.html`,
`renderDesenvolvimento`) tem o **Mapa de Cobertura** (resumo por função + matriz
membros×funções) e o painel de virtudes. Falta uma saída **imprimível/exportável**
para a coordenação levar em reunião/arquivar. Não existe convenção de impressão no
projeto (só um export `.txt` em `escala.html` via Blob+download).

Tudo que o relatório precisa já está **em memória** quando a aba abre (sem chamadas
novas ao banco):
- `_devMembros` — membros ativos `{id,nome,apelido,nivel,foto_url,competencias_desenvolvidas,...}` (carregado em `carregarDev`, l.412-422).
- `_devFuncoes` — `[[valor,label],...]` (defaults + lista do banco).
- `_devComps` — `[[valor,label],...]` das competências (para mapear slugs de virtudes → label).
- `habAll[membro_id][funcao] = proficiencia` (de `acolitos_habilitacoes`, l.309-313).
- `bucketsFuncao(funcao)` → `{prontos, form, zero}` (l.314-319).
- `LIGAS_DEV` (l.304-308), `PROF_LABEL`, `PROF_COR`, `PROF_NIVEIS` (l.300-303).
- `mk(txt, primary, onClick)` — helper de botão dentro de `renderDesenvolvimento` (l.450-455).
- Brasão: `/midia/logos/brasao-pastoral.png` (servido na raiz do domínio).

Decisões do usuário (brainstorming):
- Conteúdo: cobertura por função **+ matriz + virtudes formadas + quem está a desenvolver**.
- Formato: **Imprimir/PDF + baixar CSV**.
- "A desenvolver": listar **nominalmente os em formação** (pipeline real) + **contar** os não-treinados; só para funções **escassas** (prontos < 3).

## Escopo
- Modify: `projetos/acolitos/jornada-admin.html` (apenas). Sem banco, sem deps, sem deploy de função.
- **Fora de escopo:** virtudes "em formação" (exigiria 1 RPC por membro — pesado); filtros por comunidade; gráficos.

## Componentes

### 1. Botões no topo do Mapa
No `renderDesenvolvimento`, ao lado do título `🗺 Mapa de Cobertura` (`mh`, ~l.430),
adicionar dois botões via `mk(...)`: **🖨 Imprimir/PDF** → `gerarRelatorioPDF()` e
**⬇️ CSV** → `baixarRelatorioCSV()`. (Colocar num wrapper flex junto do `mh`.)

### 2. `gerarRelatorioPDF()` — janela imprimível
Abre `const w = window.open('', '_blank')`; escreve um documento HTML autossuficiente
(`w.document.write(html); w.document.close();`) com CSS próprio (claro) e chama
`w.focus(); w.print();`. O HTML é montado por helpers que retornam **string**:
- **CSS embutido:** fundo branco, texto escuro, fonte system/serif sóbria, tabelas com
  borda; `*{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }` para as cores
  das células saírem na impressão; `@page{ margin:14mm }`.
- **Cabeçalho:** `<img src="${location.origin}/midia/logos/brasao-pastoral.png" onerror="this.style.display='none'">`
  + título "Relatório de Desenvolvimento — Acólitos" + data (`new Date().toLocaleDateString('pt-BR')`).
- **Seção 1 — Cobertura por função:** tabela `Função | Prontos | Em formação | Zero`,
  linhas ordenadas por `bucketsFuncao(f).prontos` asc; marca ⚠ quando `prontos<3`.
  Rodapé com `Total de membros ativos: _devMembros.length`.
- **Seção 2 — A desenvolver (funções escassas):** para cada função com `prontos<3`,
  um bloco: nome da função + lista **nominal** dos membros com proficiência
  `em_formacao` naquela função (apelido/nome) + linha "Não treinados: N" (contagem de
  quem não tem `apto+`/`em_formacao`). Se ninguém em formação: "Ninguém em formação — recrutar".
- **Seção 3 — Matriz membros×funções (por liga):** uma tabela por `LIGAS_DEV`
  (cabeçalho com labels de função abreviados + `title`); cada célula = abreviação
  `ABREV[proficiencia]` (`{nao_treinado:'NT', em_formacao:'F', apto:'A', experiente:'E', referencia:'R'}`)
  com `background` = `PROF_COR[prof]` (cor literal; resolver `var(--success)`→`#2f9e57`,
  etc. num map local `PROF_COR_PRINT` para não depender do tema). Legenda no fim.
- **Seção 4 — Virtudes formadas (por membro):** por liga, cada membro e suas virtudes
  de `competencias_desenvolvidas` mapeadas via `_devComps` (slug→label); "—" se vazio.

Helpers de string: `escHtml(s)` (escapar `< > &` para montar HTML seguro a partir de
nomes), e funções `secCobertura()`, `secDesenvolver()`, `secMatriz()`, `secVirtudes()`
que retornam HTML.

### 3. `baixarRelatorioCSV()` — matriz em CSV
Monta CSV: cabeçalho `Liga;Membro;<uma coluna por função (label)>`; uma linha por
membro (na ordem das ligas), célula = `PROF_LABEL[habAll[m.id][funcao] || 'nao_treinado']`.
Usa `;` como separador (Excel pt-BR) e prefixo BOM `﻿` para acentos. Download via
`Blob([...], {type:'text/csv;charset=utf-8'})` + `URL.createObjectURL` + `<a download>`
(mesmo padrão de `escala.html` `exportarSemana`). Nome: `desenvolvimento-AAAA-MM-DD.csv`.
Escapar campos com `"` se contiverem `;`/aspas.

## Erros / bordas
- `window.open` bloqueado por popup → `toast('Permita pop-ups para gerar o relatório.','error')` se `w` for null.
- Brasão ausente → `onerror` esconde a imagem (relatório segue).
- Sem membros/funções → seções mostram "—"/vazio sem quebrar.
- Cores na impressão: `print-color-adjust:exact` + abreviação textual garantem leitura
  mesmo se o navegador omitir fundos.

## Validação
- Sintaxe dos blocos `<script>` via `node` (sem framework de teste).
- Validação manual no deploy (do **root**): Jornada → Desenvolvimento → 🖨 Imprimir/PDF
  abre a janela formatada e a prévia de impressão mostra as 4 seções com cores; ⬇️ CSV
  baixa e abre no Excel/Sheets com acentos certos. Conferir em uma carga real.

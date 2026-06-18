# Relatório de Frequência/Presença (PDF + CSV) — Design

Data: 2026-06-18
Status: aprovado (brainstorming)

## Contexto
Quinto relatório sobre a Central de Relatórios (fundação `abrirRelatorio`/`baixarCSV`/
`relTabela` em `shared.js`). Objetivo: relatório de presença por membro, **acumulado**
(histórico total) com **filtro de período opcional**.

Fatos do código (verificados):
- View `acolitos_frequencia` (def. em `043_...sql`): agrega **todo o histórico**, com a
  lógica de **substituto** embutida (substituido credita o substituto como presente) e
  `taxa` pré-calculada. Campos: `membro_id, total_escalas, servidas, faltas_just,
  faltas_nao_just, atrasos, pendentes, taxa, ultima_participacao`. (security_invoker=on;
  exige sessão autenticada — ok, a escala roda logada.)
- `fetchFrequencia(membroId?)` (shared.js l.1839): sem id → mapa `{membro_id:row}`.
- `acolitos_escalas(membro_id,status,celebracao_id,substituto_id)`; `status ∈
  {escalado,presente,ausente_justificado,ausente,atrasado,substituido}`.
  `acolitos_celebracoes(id,data,horario,comunidade)`. Padrão de query por intervalo já
  usado (escala.html l.483-486, index.html l.573): `select('membro_id,status,
  acolitos_celebracoes!inner(data)').gte('acolitos_celebracoes.data',ini).lt(...,fim)`.
- `escala.html` já tem em memória: `membros` (ativos), `freqMap` (de `fetchFrequencia()`,
  l.504), `celebracoes`, `sb`, `toast`, e a fundação do shared.js (`abrirRelatorio`,
  `relTabela`, `baixarCSV`). Comunidade: `c==='matriz'?'Matriz':'Sto. Antônio'`.
- Toolbar da Escala em `escala.html` ~l.136-150 (`.escala-acoes`): 🚫 Ausências, ❌ Faltas,
  📅 Registrar ausência, 🕓 Histórico.
- **Não existe** seletor de intervalo de datas reutilizável (só inputs `type=date` isolados).

Decisões do usuário: **acumulado + filtro de período opcional**, **PDF + CSV**, agrupado
por **comunidade**, ordenado por **taxa crescente**, vermelho quando **taxa < 70%**.

## Escopo
- Modify: `projetos/acolitos/escala.html` (botão + modal + funções do relatório).
- Reusa a fundação do `shared.js` (sem alterá-la).
- **Fora de escopo:** gráfico; crédito de substituto no modo período; relatório fora da escala.

## Componentes

### 1. Botão + modal
- Botão **📊 Frequência** na `.escala-acoes` (após ❌ Faltas) → `abrirRelatorioFrequencia()`.
- `abrirRelatorioFrequencia()`: modal (`.modal-overlay`/`.modal`) com:
  - inputs **De** (`#freq-de`) e **Até** (`#freq-ate`), ambos `type=date`, opcionais;
  - nota: "Deixe as datas em branco para o acumulado (histórico total).";
  - botões **📄 PDF** → `freqPDF()`, **⬇️ CSV** → `freqCSV()`, e Fechar.

### 2. Dados — `_freqDados(de, ate)` → Promise<linhas[]>
Retorna array `{ membro, servidas, faltas, atrasos, taxa, ultima }` para **todos os
membros ativos** (`membros`), ordenado depois pelo chamador.
- **Sem `de` e sem `ate` (acumulado):** `freq = await fetchFrequencia()`; para cada
  `m` em `membros`: pega `freq[m.id]` (ou zeros); `faltas = faltas_just + faltas_nao_just`;
  `taxa = row.taxa` (pode ser null); `ultima = ultima_participacao`.
- **Com período:** query
  `sb.from('acolitos_escalas').select('membro_id,status,acolitos_celebracoes!inner(data)')`
  com `.gte('acolitos_celebracoes.data', de)` e/ou `.lte('acolitos_celebracoes.data', ate)`
  (aplica só os que estiverem preenchidos). Agrega por `membro_id`:
  servidas (`presente|atrasado`), faltas (`ausente|ausente_justificado`), atrasos
  (`atrasado`), `ultima` = maior `data` com servida; `taxa = round(100*servidas/
  (servidas+faltas))` ou null se denominador 0. Membros sem linhas → zeros/null.

### 3. PDF — `freqPDF()`
- Lê datas do modal, chama `_freqDados`, ordena por `taxa` **crescente** (null por
  último), agrupa por **comunidade** (matriz/santo_antonio/outra).
- Por comunidade: `relTabela(['Membro','Servidas','Faltas','Atrasos','Taxa','Última'], rows)`
  onde a célula de Taxa usa `{t: taxa+'%' , bg:'#f7caca'}` quando `taxa!=null && taxa<70`
  (vermelho-claro) — senão texto normal; `ultima` formatada `DD/MM/AAAA` ou "—".
- `abrirRelatorio({ titulo:'Relatório de Frequência', subtitulo:'Acólitos · '+periodoLabel, corpo })`
  onde `periodoLabel` = "Acumulado (histórico total)" ou "de DD/MM a DD/MM" (ou "até …"/"a partir de …").
  No modo período, rodapé: "Período não credita substitutos.".

### 4. CSV — `freqCSV()`
- Mesmas linhas; `baixarCSV('frequencia', [['Comunidade','Membro','Servidas','Faltas','Atrasos','Taxa','Última'], ...])`.

## Erros / bordas
- Pop-up bloqueado → a fundação avisa (toast).
- Período com `de > ate` → toast de erro e não gera.
- Sem escalas no período → tabelas com zeros/"—" (não quebra).
- Membro sem nenhuma escala → aparece com 0 e taxa "—".
- `taxa` null (denominador 0) → exibe "—", não entra no vermelho, ordena por último.

## Validação
- Sintaxe dos `<script>` de `escala.html` via `node`.
- Manual no deploy (root): Escala → 📊 Frequência → (a) sem datas → PDF acumulado
  agrupado por comunidade, ordenado por taxa, <70% em vermelho; CSV abre no Excel.
  (b) com período (ex.: último mês) → números do intervalo. Pop-ups permitidos.
- Deploy do **root**; conferir `iajcbp-...`.

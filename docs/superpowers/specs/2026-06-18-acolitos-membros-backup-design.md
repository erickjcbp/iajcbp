# Membros: Backup Completo + Botões Padronizados/Responsivos — Design

Data: 2026-06-18
Status: aprovado (brainstorming)

## Contexto
O export de Membros (feito antes) tem 2 botões só de ícone (📄/⬇️) na toolbar do
`membros.html`, que **estouram a tela no celular**, e o CSV é resumido. O usuário quer:
(1) botões padronizados como os do Mapa de Cobertura ("🖨 Imprimir/PDF" / "⬇️ CSV"),
(2) responsivo no mobile, (3) o CSV virar um **backup completo** de todos os dados do
membro (cadastro + jornada), para salvaguarda/reconstrução.

Fatos do código (verificados):
- `acolitos_membros` tem ~55 colunas (cadastro completo: contato, família, sacramentos,
  túnica, casa, XP, observações, arrays `setores/permissoes/desenvolvimento_*`/`competencias_desenvolvidas`,
  jsonb `avisos`, etc.). `membros.html` `loadMembros()` faz `select('*')` → global `todos`
  já tem **todas** as colunas (+ campo injetado `role`).
- Jornada: proficiência por função vive em `acolitos_habilitacoes(membro_id,funcao,proficiencia)`
  (1 query, pivot por membro). Frequência via `fetchFrequencia()` (mapa). `FUNCOES`
  (membros.html l.127-139): 13 funções `{id,label}`.
- Botões atuais l.88-89 (`relatorioMembrosPDF`/`relatorioMembrosCSV`, def. l.211/222).
  Toolbar `.toolbar` (l.80) — checar/garantir `flex-wrap` (shared.css).
- Fundação shared.js: `abrirRelatorio({titulo,subtitulo,corpo,css})`, `relTabela`, `baixarCSV(nome,linhas)`, `relEsc`, `toast`. `nivelInfo`.
- Padrão de modal: `.modal-overlay`/`.modal`/`.modal-title` (ex.: `abrirRelatorioFrequencia` em escala.html). Mapa de Cobertura usa botões "🖨 Imprimir/PDF" / "⬇️ CSV".

Decisões do usuário: botão único → modal (resolve mobile + padroniza); CSV = tudo
(55 colunas + funções + frequência); PDF segue legível.

## Escopo
- Modify: `projetos/acolitos/membros.html` (botão, modal, CSV backup); `projetos/acolitos/escala.html` (relabel dos botões do modal de frequência p/ padronizar); `projetos/acolitos/shared.css` se a `.toolbar` não tiver `flex-wrap`.
- **Fora de escopo:** exportar fotos/arquivos do storage; backup de escalas/missões (futuro).

## Componentes

### 1. Botão único + modal (Membros)
- Trocar os 2 botões de ícone (l.88-89) por **um**: `<button class="btn-sm gray" onclick="abrirRelatorioMembros()">📄 Relatório</button>`.
- `abrirRelatorioMembros()`: modal "Relatório de Membros" com 2 botões com texto:
  **🖨 Imprimir/PDF** → `relatorioMembrosPDF()` e **⬇️ CSV (backup completo)** →
  `relatorioMembrosCSV()`, + Fechar. (Padroniza com o Mapa; toolbar fica com 1 botão só.)
- **Responsividade:** garantir `.toolbar { flex-wrap: wrap; }` (em shared.css se faltar).

### 2. CSV = backup completo — `relatorioMembrosCSV()` (reescrito)
- Carrega 1×: `acolitos_habilitacoes` (todas) → `habByMembro[membro_id][funcao]=proficiencia`;
  e `fetchFrequencia()` → `freqMap`.
- **Colunas:** todas as chaves de `todos` (`[...new Set(todos.flatMap(Object.keys))]`,
  ordem natural ≈ ordem da tabela) **+** uma coluna por função (`FUNCOES`, header
  `func:<label>`, valor = proficiência ou '') **+** frequência (`servidas, faltas,
  atrasos, taxa, ultima_participacao`).
- **Valores:** array/objeto → `JSON.stringify`; `null/undefined` → ''; resto → `String(v)`
  (booleans `true/false`, datas como vêm). `baixarCSV` escapa.
- Uma linha por membro de `todos` (ordenado por nome). `baixarCSV('membros-backup', linhas)`.
- É o "banco completo" — dá pra reconstruir o cadastro + estado de desenvolvimento.

### 3. PDF — `relatorioMembrosPDF()` (mantido, legível)
- Continua: resumo + tabelas por comunidade (Nome · Nível · Idade · Telefone · WhatsApp ·
  Responsável · Túnica · Status), ordenado por nome. (Não despeja as 55 colunas — isso é o CSV.)

### 4. Padronização dos rótulos (consistência)
- No modal de frequência (`escala.html` `abrirRelatorioFrequencia`): renomear os botões
  `📄 PDF`→`🖨 Imprimir/PDF` e manter `⬇️ CSV` (alinha com o Mapa/Membros).
- Mapa de Cobertura já é a referência (sem mudança). Escala PDF (`🖨 Escala PDF`) mantém.

## Erros / bordas
- Pop-up bloqueado → fundação avisa (toast).
- `todos` vazio → CSV só com cabeçalho; PDF "—".
- Habilitações/frequência ausentes → colunas vazias (não quebra).
- Arrays/jsonb sempre serializados (não perde dado no backup).

## Validação
- Sintaxe dos `<script>` de `membros.html` e `escala.html` via `node`.
- Manual no deploy (root): Membros → 📄 Relatório → modal com os 2 botões; **🖨 Imprimir/PDF**
  abre o resumo; **⬇️ CSV (backup completo)** baixa `membros-backup-AAAA-MM-DD.csv` com
  todas as colunas + funções + frequência (abrir no Excel, conferir acentos e arrays).
  Testar no **celular**: toolbar não estoura; modal responsivo.
- Deploy do **root**; conferir `iajcbp-...`.

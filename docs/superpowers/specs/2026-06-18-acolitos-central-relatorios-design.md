# Central de Relatórios (fundação + Membros) — Design

Data: 2026-06-18
Status: aprovado (brainstorming)

## Contexto
O relatório de Desenvolvimento (Mapa de Cobertura) foi feito "na unha" em
`jornada-admin.html` (janela de impressão + CSS + brasão + CSV). O usuário quer
relatórios em vários módulos (Membros, Panorama por membro, Frequência, Escala em
PDF). Para não repetir o encanamento, criamos uma **fundação reutilizável** em
`shared.js` (carregado por todas as páginas), refatoramos o de Desenvolvimento para
usá-la, e construímos o **relatório de Membros** sobre ela.

Fatos do código (verificados):
- `shared.js`: funções utilitárias de nível de módulo (ex.: `waLink` l.1259, `semAcento`
  l.1266, `cfg` l.1244, `toast(msg,tipo)` l.105-111, `nivelInfo(slug)` l.1554). **Não**
  existe nada de impressão/relatório/CSV. Bom ponto de inserção: após `buildPresencaChart`
  (termina ~l.2028) e antes das IIFEs finais (~l.2030).
- Padrão de download por Blob já usado em `escala.html` `exportarSemana` (l.1097-1099):
  `new Blob([c],{type}) → URL.createObjectURL → <a download>.click() → revokeObjectURL`.
- Brasão: `/midia/logos/brasao-pastoral.png` (raiz do domínio).
- `membros.html`: `loadMembros()` (l.187-203) traz `select('*')` filtrando por
  `status` (`ativo` ou `afastado` via `verArquivados`), ordena por nome, e popula a
  global **`todos`** (cada item recebe `role`). Campos disponíveis: `id, nome, apelido,
  nivel, comunidade, data_nascimento, telefone, telefone_whatsapp, responsavel,
  celular_mae, celular_recado, tem_tunica, status, grupo_irmaos, ...`. Helpers locais:
  `comLabel` (l.245: matriz/santo_antonio/outra), `calcIdade`, `nivelInfo`. Toolbar em
  l.80-88 (`+ Novo`, `🗄`). Gate: `initModulo(['coord_admin','subadmin','membro_equipe'])`.
- Relatório de Desenvolvimento atual: `gerarRelatorioPDF()`/`baixarRelatorioCSV()` +
  helpers (`_escHtml`, `_profDe`, `_membrosComProf`, `_membrosDaLiga`, `_compLabelMap`,
  `PROF_ABREV`, `PROF_COR_PRINT`) em `jornada-admin.html`.

Decisões do usuário: fazer **fundação + refatorar Desenvolvimento + Membros** agora;
os outros 3 relatórios (Panorama, Frequência, Escala PDF) ficam para próximas sessões,
mas a fundação já deve servi-los.

## Escopo
- Modify: `projetos/acolitos/shared.js` (fundação), `projetos/acolitos/jornada-admin.html`
  (refatorar), `projetos/acolitos/membros.html` (relatório novo).
- **Fora de escopo:** Panorama/Frequência/Escala PDF (futuro); filtros avançados.

## Componentes

### 1. Fundação em `shared.js` (nível de módulo, inserir ~l.2028)

```
abrirRelatorio({ titulo, subtitulo, corpo }) -> Window|null
```
- Abre `window.open('','_blank')`; se `null` → `toast('Permita pop-ups para gerar o relatório.','error')` e retorna null.
- Escreve documento HTML padrão: `<head>` com CSS embutido (fundo branco, fonte serif,
  `*{print-color-adjust:exact}`, estilos de `h1/h2/h3/table/th/td`, `@page{margin:12mm}`),
  `<body>` com **cabeçalho** = brasão (`<img src="${location.origin}/midia/logos/brasao-pastoral.png" onerror=hide>`)
  + `titulo` + `subtitulo` + data (`new Date().toLocaleDateString('pt-BR')`), seguido de `corpo`.
- `w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{try{w.print()}catch(e){}},350);`

```
baixarCSV(nomeBase, linhas)   // linhas: array de arrays (1ª linha = cabeçalho)
```
- Junta com `;`, escapando campos com `"`/`;`/quebra; prefixo BOM `﻿`; `\r\n` entre linhas.
- Download via Blob `text/csv;charset=utf-8`. Nome `nomeBase-AAAA-MM-DD.csv`. `toast('✓ CSV gerado')`.

```
relEsc(s) -> string            // escapa & < > (texto seguro p/ HTML)
relTabela(headers, rows) -> string   // <table>; rows = array de arrays; célula = string OU {t, bg}
```
- `relTabela`: `headers` = array de strings; cada `row` = array onde cada célula é string
  (texto, já escapado pelo helper) ou objeto `{t, bg}` (texto + cor de fundo inline). Gera
  `<table class="rel"><thead>…</thead><tbody>…</tbody></table>`.

### 2. Refatorar relatório de Desenvolvimento (`jornada-admin.html`)
- `gerarRelatorioPDF()`: remover o bloco de CSS/janela/`window.open`; montar o `corpo`
  (as 4 seções como string, reusando os helpers existentes) e chamar
  `abrirRelatorio({ titulo:'Relatório de Desenvolvimento', subtitulo:'Acólitos · '+_devMembros.length+' membros ativos', corpo })`.
  Onde hoje usa `_escHtml`, manter (ou trocar por `relEsc`; manter `_escHtml` é ok).
- `baixarRelatorioCSV()`: montar a matriz como array de arrays e chamar
  `baixarCSV('desenvolvimento', linhas)` (remove o Blob manual).
- A CSS específica da matriz colorida (cor por célula) continua inline nas células
  (`background:PROF_COR_PRINT[p]`); a CSS base vem da fundação.

### 3. Relatório de Membros (`membros.html`)
- **Botões na toolbar** (após `🗄`, l.87): `📄 Relatório` → `relatorioMembrosPDF()` e
  `⬇️ CSV` → `relatorioMembrosCSV()`. Estilo `btn-sm gray`.
- Fonte de dados: a global `todos` (já carregada; respeita `verArquivados`). Helpers
  locais: `comLabel`, `calcIdade`, `nivelInfo`.
- `relatorioMembrosPDF()`:
  - Resumo no topo: total + contagem por comunidade + por liga/nível base.
  - Para cada comunidade (`matriz`, `santo_antonio`, `outra`): `relTabela` com colunas
    **Nome · Nível · Idade · Telefone · WhatsApp · Responsável · Túnica · Status**
    (membros ordenados por nome). Túnica = 'Sim'/'Não'; idade via `calcIdade(data_nascimento)`.
  - `abrirRelatorio({ titulo:'Relatório de Membros', subtitulo:'Acólitos · '+todos.length+' '+(verArquivados?'arquivados':'ativos'), corpo })`.
- `relatorioMembrosCSV()`: cabeçalho + uma linha por membro de `todos`, colunas:
  Nome, Apelido, Nível, Comunidade, Nascimento, Idade, Telefone, WhatsApp, Responsável,
  Cel. Mãe, Cel. Recado, Túnica, Status, Grupo irmãos. Chama `baixarCSV('membros', linhas)`.

## Erros / bordas
- Pop-up bloqueado → toast (fundação trata).
- Brasão ausente → `onerror` esconde.
- Lista vazia → tabelas/seções vazias sem quebrar.
- Cores na impressão → `print-color-adjust:exact` na CSS base.

## Validação
- Sintaxe dos `<script>` de shared.js, jornada-admin.html e membros.html via `node`.
- Manual no deploy (root): (a) Desenvolvimento → 🖨 e ⬇️ continuam funcionando igual
  (refator sem regressão); (b) Membros → 📄 abre PDF agrupado por comunidade com resumo;
  ⬇️ CSV baixa e abre no Excel com acentos. Conferir com pop-ups permitidos.
- Deploy do **root** (`/Users/erickmartins/iajcbp`), conferir `iajcbp-...`.

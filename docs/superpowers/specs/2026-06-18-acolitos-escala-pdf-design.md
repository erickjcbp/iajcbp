# Escala em PDF — Design

Data: 2026-06-18
Status: aprovado (brainstorming)

## Contexto
Último relatório da Central de Relatórios. A escala hoje só exporta **texto/.txt**
(`exportarSemana`, por semana). Objetivo: um **PDF** imprimível da escala (mural/sacristia)
usando a fundação `abrirRelatorio` (shared.js).

Fatos do código (verificados, `projetos/acolitos/escala.html`):
- `celebracoes` (global): linhas de `acolitos_celebracoes` carregadas (janela: hoje+56d, ou
  hoje−90d se `verHistorico`), campos `id,data,horario,comunidade,tipo`.
- `escalasMap[celebracao_id]` → linhas de `acolitos_escalas` com join
  `acolitos_membros!membro_id(id,nome)` → cada linha tem `funcao`, `status`,
  `acolitos_membros.nome`.
- `FUNCAO_LABEL` (l.357), `TIPO_LABEL` (l.362), `DIAS` (l.367).
- Agrupamento por semana (em `renderCards`, l.539-546): segunda-feira ISO →
  `{label:'Semana de DD/mmm', items:[celebracoes]}`.
- `exportarSemana(celebs,label)` (l.1070+): ordena missas (HOR_ORDEM) e, por missa, lista
  escalas **em ordem alfabética por nome** (`nomeDe(e)=e.acolitos_membros.nome`).
- Toolbar `.escala-acoes` (l.142-150) já tem botões de relatório (ex.: `📊 Frequência`
  chamando `abrirRelatorioFrequencia`). Fundação `abrirRelatorio({titulo,subtitulo,corpo,css})`
  + `relTabela(headers,rows)` + `relEsc` disponíveis (shared.js carregado).

Decisões do usuário: **botão global** (toolbar, não por semana); **ordem alfabética** por nome.

## Escopo
- Modify: `projetos/acolitos/escala.html` (botão + função do relatório).
- Reusa fundação do shared.js. **Fora de escopo:** CSV da escala; vagas "a definir"
  (omitidas — listagem é por membro, alfabética); PDF de período arbitrário (usa o já carregado).

## Componente
- **Botão 🖨 Escala (PDF)** na `.escala-acoes` (após `📊 Frequência`) → `escalaPDF()`.
- `escalaPDF()`:
  - Usa `celebracoes` (o período já carregado na tela; respeita o filtro de comunidade e o
    toggle Histórico). Se vazio → `toast('Nenhuma celebração no período.','error')`.
  - **Agrupa por semana** (mesma lógica de `renderCards`: segunda ISO → label "Semana de DD/mmm");
    semanas ordenadas por data.
  - Ordena as missas de cada semana por `data` + horário (reaproveita a ordem de `exportarSemana`:
    HOR_ORDEM `['17h','18h30','7h','9h','19h']`).
  - Monta `corpo`:
    - Por semana: `<h2>{label}</h2>`.
    - Por missa: `<h3>{DIA dd/mm · horário · Comunidade · TIPO}</h3>` +
      `relTabela(['Membro','Função'], rows)` onde `rows` = escalas de `escalasMap[c.id]`
      **ordenadas alfabeticamente por `acolitos_membros.nome`** → `[nome, FUNCAO_LABEL[funcao]]`.
      Missa sem escala → `<p class="muted">(escala não montada)</p>`.
  - `abrirRelatorio({ titulo:'Escala', subtitulo:'Acólitos · '+periodoLabel, corpo,
    css:'h3{margin:14px 0 4px}' })` onde `periodoLabel` = intervalo de datas das celebrações
    carregadas (menor→maior) ou "período carregado".

## Erros / bordas
- Pop-up bloqueado → fundação avisa (toast).
- Sem celebrações → toast e não gera.
- Missa sem escala → "(escala não montada)".
- Nome ausente no join → "—".

## Validação
- Sintaxe dos `<script>` de `escala.html` via `node`.
- Manual no deploy (root): Escala → 🖨 Escala (PDF) → abre o PDF com as semanas/missas e a
  lista alfabética Membro/Função; testar com o toggle 🕓 Histórico e com filtro de comunidade.
  Pop-ups permitidos.
- Deploy do **root**; conferir `iajcbp-...`.

# Melhorias na Escala (Acólitos) — Design

Data: 2026-06-16
Status: aprovado (brainstorming)

## Contexto
Quatro melhorias no app `projetos/acolitos/`, concentradas em `escala.html` (a
tela de montagem de escala da coordenação). Sem migration nova: tudo grava nas
tabelas existentes `acolitos_escalas` e `acolitos_ausencias`.

Fatos do código (verificados):
- O modal de montagem é `#modal-montagem`; o `.modal` tem `max-width:720px`
  (l.151). As posições vivem em `#mt-body` (`.montagem-cols`, grid 2 col ≥600px).
- `.pos-select` (o seletor de nome) está travado em `flex:0 0 150px; max-width:150px`
  (l.107-110) — é o que corta os nomes.
- As posições são montadas a partir do modelo: `modeloFor(tipo,comunidade)`
  (l.289) devolve `slots` `[{funcao,cat,label}]`; `FUNCAO_META` (l.263-276)
  mapeia cada função → `{label,cat,ordem}`. Categorias: Cerimoniais, Altares,
  Litúrgicos, Apoios, Episcopal, Personalizadas.
- `montar(celeb)` (l.~600-700) renderiza as posições agrupadas por `cat`, e
  casa cada linha de `acolitos_escalas` existente à posição via
  `existFn[idxDessaFn]` — ou seja, **linhas além da contagem do modelo são
  hoje descartadas** ao reabrir.
- Cada posição vira um `pe = {sel, funcao, ...}` em `pendingEdicao`.
  `salvarEscala()` (l.1025-1033) **apaga** todas as linhas da celebração e
  **reinsere** uma linha `{celebracao_id, membro_id, funcao, created_by}` por
  `pe` com `sel.value` preenchido.
- Membros já vêm com `grupo_irmaos` e `escalar_com_irmao` (l.462). O gerador
  automático já junta irmãos (l.789-803, 957) — **não** mexer nisso.
- `trocarPosicao(pe)` (l.878) troca o `pe.sel.value` programaticamente (não
  dispara `onchange`).
- Avisos por posição já existem via `pe.atualizarAvisos()` (fix recente).
- `ausencias.html` já registra ausência de outros pela equipe
  (`renderViewEquipe` + `abrirRegistrarAusencia`, l.356/437) gravando em
  `acolitos_ausencias`. A nav do **modo coordenação** (shared.js:1319-1323)
  **não** tem item de Ausência — só a nav do modo membro (l.1332).

Decisões do usuário (brainstorming):
- Alerta de irmão dispara **ao escolher o nome**.
- Conta **só** irmãos marcados `escalar_com_irmao`.
- Slot extra: botão **"+" embaixo de cada setor (categoria)**.
- Informar ausência na coordenação: **só um botão na tela de escala** (sem nav).

## Itens

### 1. Alerta de irmão ao escolher o nome
No `onchange` de cada `pe.sel` (montar, ~l.654), além do que já faz, chamar
`checarIrmao(pe, celeb)`:

- Pega o membro selecionado `m = membros.find(id===sel.value)`.
- Se `!m.escalar_com_irmao || !m.grupo_irmaos` → não faz nada.
- Lista os irmãos do grupo marcados: `irmaos = membros.filter(x =>
  x.grupo_irmaos===m.grupo_irmaos && x.escalar_com_irmao && x.id!==m.id)`.
- Para cada irmão que **não está** em nenhuma posição (`!pendingEdicao.some(p =>
  p.sel.value===irmao.id)`) e cujo par `(m.id,irmao.id)` não foi dispensado:
  - `confirm('Você escalou ' + nome(m) + ' e o irmão ' + nome(irmao) +
    ' ainda não está na escala. Adicionar como Apoio?')`.
  - Em "sim" → `adicionarSlotExtra('apoio', irmao.id)` (ver item 2).
  - Em "não" → registrar o par num `Set` `_irmaoDispensado` (chave
    `m.id+'|'+irmao.id`) para não repetir o aviso nessa sessão do modal.
- Se o irmão estiver ausente nesta missa (`ausNesta.has(irmao.id)`), o texto do
  confirm ganha o sufixo ' (atenção: ele declarou ausência nesta missa)'.
  Não bloquear.
- `_irmaoDispensado` é reiniciado a cada `montar` (novo modal).

Função `nome(m)` = `m.apelido || m.nome` (usar o helper já existente se houver).

### 2. Slot extra por setor (botão "+")
Refatorar a renderização das posições em `montar` para suportar slots extras:

- **Reconstruir extras ao abrir:** ao montar, para cada `funcao`, se
  `acolitos_escalas` tem mais linhas daquela função do que o modelo prevê,
  renderizar as linhas excedentes como posições extras na categoria da função
  (`FUNCAO_META[funcao].cat`). Implementação: depois de casar as posições do
  modelo (lógica `existFn[idxDessaFn]`), as linhas com `idxDessaFn >= nº de
  slots do modelo p/ essa função` viram extras.
- **Botão "+" por categoria:** ao final das posições de cada categoria,
  inserir um botão "+ função" (`.pos-add`). Clicar abre um mini-menu (lista
  simples de botões) com as funções **daquela categoria** — derivadas de
  `FUNCAO_META`: `Object.entries(FUNCAO_META).filter(([k,v]) => v.cat===cat)`.
  Escolher uma função chama `adicionarSlotExtra(funcao)`.
- **`adicionarSlotExtra(funcao, membroIdOpcional)`:** cria uma nova `.pos-item`
  na categoria correta com:
  - rótulo = `FUNCAO_META[funcao].label + ' (extra)'`;
  - um `<select>` populado pelos membros elegíveis para a função (mesma regra
    das posições normais: `elegivelFuncao(m, funcao, celeb.comunidade)` mais
    "em formação" na escolha manual), com a mesma `pe.atualizarAvisos` e
    `trocarPosicao`/limpar;
  - se `membroIdOpcional`, já vem selecionado (`sel.value=membroId`,
    `classList.add('filled')`) e dispara `atualizarAvisos`;
  - empurra o `pe` em `pendingEdicao` (com flag `extra:true`) — `salvarEscala`
    já grava qualquer `pe` com valor, então o extra persiste como linha em
    `acolitos_escalas` **sem tocar em `acolitos_modelos`**.
  - um botão de remover (✕) que tira o `pe` de `pendingEdicao` e remove a linha
    da tela (diferente do ✕ comum, que só limpa o valor). Para posições do
    modelo o ✕ continua só limpando.
- **Não altera o modelo:** nenhuma escrita em `acolitos_modelos`. O extra só
  existe na celebração.

A renderização das posições deve ser organizada de modo que dê para **anexar**
um `.pos-item` ao container da categoria certa depois da montagem inicial
(guardar referência do container de cada categoria num mapa `catBox[cat]`).

### 3. Botão "+ Ausência" na escala
Novo botão na toolbar (`.escala-acoes`, ~l.133-139), ex.: `📅 Registrar ausência`,
chamando `abrirRegistrarAusenciaCoord()`. Modal compacto (self-contained na
`escala.html`, reusando `membros` e `celebracoes` já carregados):

- **Membro:** seletor único (ou busca) entre `membros` ativos.
- **Missas/data:** lista de checkboxes das celebrações futuras já carregadas
  (rótulo via o mesmo formato do app) **ou** um input `date` para data avulsa
  (sem celebração) — espelha o comportamento de `ausencias.html`.
- **Motivo:** carregar de `acolitos_listas` tipo `motivo` (fallback aos padrões
  `doenca/viagem/familia/outro`).
- **Observação:** texto opcional.
- **Salvar:**
  - por celebração: `upsert` em `acolitos_ausencias`
    `{membro_id, celebracao_id, motivo, observacao}` com
    `onConflict:'membro_id,celebracao_id'` (mesma forma de `ausencias.html`).
  - por data avulsa: `delete` das avulsas daquele membro/data
    (`celebracao_id is null`) e `insert` `{membro_id, data, celebracao_id:null,
    motivo, observacao}`.
  - `toast` de sucesso; fechar modal. Não recarrega a escala inteira, mas
    invalida o cache de ausências (`carregarAusenciasFresh`/`ausMap`) para a
    próxima montagem refletir.
- Permissão: a coordenação já tem RLS para inserir ausência de outros (política
  "Equipe le todas ausencias"/"Cerimonario gerencia ausencias" cobre ALL).
- **Nota de duplicação:** isto repete parte da lógica de `ausencias.html`.
  Mantemos self-contained na escala (decisão do usuário: botão na escala). Não
  extrair para `shared.js` agora para não ampliar o escopo.

### 4. Modal mais largo
- `#modal-montagem .modal`: trocar `max-width:720px` por
  `max-width:min(1040px,96vw)`.
- `.pos-select`: remover `max-width:150px`; trocar `flex:0 0 150px` por
  `flex:0 0 230px` (nomes não cortam). Manter `.montagem-cols` em 2 colunas
  ≥600px.
- Conferir que o botão "+" e os slots extras cabem no layout mais largo.

## Erros / bordas
- Selecionar um membro sem irmão marcado → nenhum aviso (item 1).
- Recusar adicionar irmão → não repete naquele modal (item 1).
- Slot extra vazio → não é salvo (item 2), some no próximo reabrir.
- Reabrir celebração com extras salvos → extras reaparecem reconstruídos das
  linhas de `acolitos_escalas` (item 2).
- Registrar ausência sem missa/data selecionada → erro inline; sem membro →
  erro inline (item 3).
- Modal largo em telas estreitas → `96vw` garante caber (item 4).

## Validação
Mudanças na tela real de escala (estado complexo, sem framework de teste):
validar por (a) checagem de sintaxe dos blocos `<script>` via `node`, e (b)
teste manual no deploy de produção — fluxos: escolher membro com irmão e ver o
alerta; adicionar +Apoio e +Altar via "+", salvar, reabrir e conferir que os
extras persistem sem virar modelo; registrar uma ausência de teste; conferir o
modal mais largo e os nomes inteiros. Usar membros descartáveis para escrita.
Não criar lab (a escala depende de muito estado carregado).

# Spec — "ESCALA EU!" (auto-oferta guiada na aba Escalas)

**Data:** 2026-07-15
**Projeto:** Acólitos (iajcbp) — tela do membro
**Arquivo principal:** `projetos/acolitos/escalas-membro.html`
**Tipo:** Melhoria puramente frontend (sem migration, sem RLS)

## Problema

A sub-aba **Vagas** (dentro de "Escala eu" › visão **Minhas**) hoje é uma
lista seca: cada vaga aberta vira um card com botão "Me candidatar". Funciona,
mas é pouco intuitivo e nada convidativo. O membro não sente que está
*escolhendo servir* — só reage a uma lista.

O dono quer algo **mais chamativo e guiado**: um card animado **"ESCALA EU!"**
onde o membro **compõe sua oferta** (escolhe a missa, depois a função em que
está apto) e **pede a escala**.

## Objetivo

Substituir o conteúdo da sub-aba **Vagas** por uma experiência **ESCALA EU!**:
um card-herói animado que abre um fluxo guiado de 2 passos (missa → função),
mostrando apenas o que é pedível de verdade, e enviando o pedido pelo mesmo
pipeline de candidatura que a coordenação já homologa na Caixa.

## Decisões (fechadas no brainstorming)

1. **É pedido, não auto-escala.** Apertar não escala na hora — cria uma
   **candidatura** (`aguardando_coordenacao`) que a coordenação homologa na
   Caixa de aprovações. Mantém o modelo atual.
2. **Fluxo guiado missa → função.** Passo 1 escolhe a celebração; passo 2
   escolhe a função.
3. **No passo 2 aparecem só funções com vaga aberta E que o membro está apto.**
   Zero frustração: tudo que aparece é pedível.
4. **Substitui a sub-aba Vagas** (mesmo lugar, cara nova) — não cria aba a mais.
5. **"Apto" = o critério de hoje** (linha em `acolitos_habilitacoes`), exatamente
   como o RPC já faz. Não inventa critério novo.

## Arquitetura

Mudança **100% frontend**, contida em `escalas-membro.html` (+ reuso de helpers
do `shared.js`). **Nenhuma** alteração de banco, RPC ou RLS.

### Reuso de backend (já no ar)

- **Ler vagas** → `acolitos_vagas_abertas_membro()`
  Retorna lista chapada de `{celebracao_id, data, horario, comunidade, tipo,
  funcao}`, já filtrada por:
  - função em que o membro está **habilitado** (`acolitos_habilitacoes`),
  - vaga **aberta** (`modelos.quantidade > escalados`),
  - excluindo missas onde o membro **já está escalado**.
  → Basta **agrupar por celebração no cliente** (chave `celebracao_id`) pra ter
  o passo 1 (missas) e, dentro de cada, as funções do passo 2.

- **Enviar pedido** → `acolitos_candidatar_vaga(p_celebracao_id, p_funcao, p_motivo)`
  Cria a candidatura → cai na Caixa da coordenação. Trata `ja_candidatou`.

### Reuso de UI (shared.js)

- **`showCeleb({...})`** — overlay cinematográfico de sucesso (confete, faíscas,
  som de estrela). Usado no "Pedido enviado!".
- **`toast(msg, tipo)`**, **`uiConfirm(...)`** — feedback e confirmação (regra
  da casa: nada de `confirm`/`alert` nativos).

## Estados e fluxo (dentro de `carregarVagas` → renomeado conceitualmente para o ESCALA EU!)

A função `carregarVagas(body, ctx)` passa a renderizar a máquina de 3 estados
abaixo dentro do mesmo `body` da sub-aba. Toda a busca usa **um** fetch de
`acolitos_vagas_abertas_membro()`, agrupado por celebração.

### Estado 0 — Herói (entrada)
- Card-herói grande, **gradiente + pulso/brilho suave**, título **"ESCALA EU!"**,
  subtítulo *"Quer servir? Escolha uma missa e a sua função."*
- Selo com contagem: *"N missas precisam de você"* (N = nº de celebrações
  distintas com vaga apta).
- **Vazio:** se não houver nenhuma vaga apta, o herói entra em estado calmo
  (sem pulso), texto *"Tudo escalado por enquanto — volte depois."* e não abre.
- Tocar no herói → Estado 1.

### Estado 1 — Escolha a missa
- Cabeçalho com **"‹ voltar"** (retorna ao herói).
- Lista de celebrações (ordenadas por data/horário) — cada card mostra:
  data (via `dataLabel`), horário, comunidade (via `comLabel`) e um selo
  *"K funções abertas pra você"* (K = nº de funções daquela missa na lista).
- Tocar numa missa → Estado 2.

### Estado 2 — Escolha a função
- Cabeçalho com **"‹ voltar"** (retorna à lista de missas) + resumo da missa
  escolhida (data · horário · comunidade).
- **Chips grandes**, um por função apta com vaga naquela missa
  (label via `FUNCAO_LABEL`).
- Tocar num chip → `uiConfirm("Pedir para servir como <função> em <missa>?")` →
  `acolitos_candidatar_vaga(...)`:
  - **ok** → `showCeleb({ icon:'⛪'/estrela, tag:'ESCALA EU!', hero:'Pedido enviado!',
    sub:'A coordenação vai confirmar sua escala.' , sound:'star' })` e, ao fechar,
    volta ao herói.
    **Importante:** o RPC `acolitos_vagas_abertas_membro` filtra por *escalado*,
    não por *candidatura pendente* — então a vaga pedida **continua aberta** até
    a coordenação homologar. Pra não deixar o membro re-pedir e cair em
    `ja_candidatou`, o cliente guarda em memória (Set de `celebracao_id|funcao`)
    as vagas já pedidas na sessão e **as marca como "✓ Pedido enviado"
    (chip desabilitado)** em vez de removê-las. O status real fica em
    "Meus pedidos".
  - **`ja_candidatou`** → `toast('Você já se candidatou.', 'error')`, mantém a tela.
  - **erro** → `toast('Não foi possível pedir.', 'error')`, reabilita o chip.

### Transições / animação
- Troca de estado com **slide/fade** curto (respeitando performance no celular).
- Herói pulsa só quando há vagas; nunca trava o scroll.
- Regras da casa respeitadas: **responsivo full-bleed**, sem emoji como ícone
  estrutural (emoji só decorativo dentro do `showCeleb`, como já é o padrão das
  celebrações), modais `ui*`, sem `confirm`/`alert` nativos.

## O que NÃO muda

- **Minhas missas** e **Meus pedidos** (sub-abas irmãs) — intactas.
- Visão **Todas** (browse read-only) — intacta.
- Backend, RPCs, RLS, Caixa da coordenação — intactos (reuso puro).

## Fora de escopo (YAGNI)

- Auto-escala imediata sem aprovação.
- Escolher função em missa **cheia** ("me ofereço mesmo lotado").
- "Cesta" de múltiplas ofertas de uma vez.
- Novo critério de aptidão além da habilitação atual.
- Filtros por comunidade/data no passo 1 (a lista já vem enxuta).

## Testes / verificação

Não há lógica de negócio nova no banco (reuso). A camada nova é UI + agrupamento
client-side. Verificação:

1. **Agrupamento:** dado o retorno chapado de `acolitos_vagas_abertas_membro`,
   agrupar por `celebracao_id` produz N missas com suas funções (unidade pura,
   testável isolada se extraída — ex.: `agruparVagasPorMissa(vagas)`).
2. **Fluxo manual** com a conta de teste (`coord_admin`/bot) ou um membro apto:
   herói mostra contagem correta → passo 1 lista missas → passo 2 lista só
   funções aptas com vaga → pedir → candidatura aparece na Caixa e em
   "Meus pedidos".
3. **Vazio:** membro sem vaga apta vê o estado calmo, sem herói pulsante.
4. **Duplicado:** pedir de novo a mesma vaga → `ja_candidatou` tratado.
5. **Responsivo:** herói e chips não estouram a tela no celular.

## Extração testável sugerida

Mover o agrupamento pra uma função pura reaproveitável (ex.: no
`solicitacoes-core.js` ou um helper local): `agruparVagasPorMissa(vagas)` →
`[{ celebracao_id, data, horario, comunidade, tipo, funcoes:[...] }]`. Facilita
teste unitário sem DOM e mantém o `carregarVagas` focado em renderizar.

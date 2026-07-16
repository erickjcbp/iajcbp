# Escala → Arte automática (semanal) — Design

Data: 2026-07-15
Status: aprovado (brainstorming)
Projeto: iajcbp / Acólitos

## Objetivo

Gerar **automaticamente**, todo **domingo às 21h (America/São_Paulo)**, a **arte da escala do fim de
semana seguinte**, reproduzindo o modelo Canva atual da paróquia, e entregá-la como **PNG baixável**
na tela de Escala do app. Determinístico, sem IA.

O modelo Canva de referência é `DAG9YVLdXic` (link `canva.link/oom8143ucymkpjk`). A automação **não**
depende do Canva em runtime — reproduz a arte por conta própria (o Canva Free/Pro não permite autofill;
isso é Enterprise-only, e o conector MCP do Canva é conta-única/interativo, inviável em cron).

## Decisões do usuário (registradas)

- **Disparo:** automático agendado (cron), não sob demanda nem via conector Canva.
- **Caminho:** auto-render (reproduzir o modelo → PNG), não editar no Canva.
- **Litúrgico:** calcular automático da data + **override manual** para semanas raras.
- **Assets:** fornecidos pelo usuário (`elementos.png`): brasão + bandeira nas 5 cores litúrgicas.
- **Tipografia:** trocar as fontes do modelo por **Sora** (display) + companheira **Inter** (corpo).
- **Formato:** manter **2160×4800** (idêntico ao modelo).
- **Entrega:** botão de **download** na tela de Escala (visível à coordenação) + botão de regenerar.
- **Fora do v1:** postar no WhatsApp/Instagram, subir no Canva, formatos quadrado/story.

## Anatomia do modelo (o que reproduzir)

Canvas **2160×4800**, fundo creme (~`#F4E9D8`).

**Cabeçalho:**
- Brasão da paróquia (asset `elementos.png`, topo).
- `ESCALA - SERVIDORES DO ALTAR` — Sora, caixa alta, espaçada.
- `TEMPO COMUM` — Sora display grande (o **tempo litúrgico atual**, calculado).
- `JULHO 2026` — Sora display (mês/ano do fim de semana alvo).

**Duas seções** (empilhadas):
1. **Sábado** — 2 missas lado a lado: `JCBP 17:00` (esq) · `STO. ANTONIO 18:30` (dir).
2. **Domingo** — 3 missas: `JCBP 07:00` (esq) · `JCBP 09:00` (dir) em par + `JCBP 19:00` embaixo (bloco único).

Cada seção tem, no topo:
- A **bandeira** (asset, cor litúrgica) à esquerda.
- Data: `Sábado, 11 de Julho de 2026` / `Domingo, 12 de Julho de 2026` (Inter).
- Descrição do domingo: `15º Domingo do Tempo Comum, Ano A` (Sora, calculada — a **mesma** nas duas
  seções, pois a missa de sábado à tarde é vigília do domingo).

Cada **missa** (pill + lista):
- **Pill** arredondado: fundo = **cor litúrgica**, contorno dourado (~`#D9A441`); dentro, comunidade
  (`JCBP`/`STO. ANTONIO`, pequeno) sobre o dia (`SÁBADO`/`DOMINGO`, grande), ao lado da hora `17`/`00` `H`
  (HH em cima, MM embaixo, `H` grande à direita).
- **Lista `Nome Completo – Função`**, ordenada **alfabeticamente por nome**, com uma bolinha (conta de
  rosário) ao lado de cada linha.
- **Rosário** vertical (fileira de contas) entre as duas colunas, terminando numa **cruz** no fim do bloco.

**Elementos que seguem a cor litúrgica:** as 2 bandeiras **e** os 5 pills (o fundo atrás de
SÁBADO/DOMINGO). Numa semana roxa/branca/vermelha/rosa, todos mudam juntos.

## Assets

- **`elementos.png`** (fornecido): contém o **brasão** e a **bandeira nas 5 cores** (verde, vermelho,
  creme/branco, rosa, roxo). Serão **recortados** em PNGs transparentes individuais e versionados em
  `projetos/acolitos/midia/arte-escala/` (brasao.png, bandeira-verde.png, …, bandeira-roxo.png).
- **Rosário + cruz + bolinhas**: **recriados como SVG/CSS** (não vieram no asset). Contas = círculos;
  cruz = SVG simples; bolinha por linha = círculo aberto.
- **Fontes**: Sora e Inter (Google Fonts), **embarcadas** (woff2 base64 no HTML de render, sem rede).

## Fonte de dados (Supabase)

Projeto ref `fttjgsotuosjfrasttds`. Reaproveita o modelo de dados da tela de Escala.

- **Fim de semana alvo**: a partir da data/hora do run (em BRT), calcular o **próximo sábado** (se o run
  é domingo 21h → +6 dias) e o **próximo domingo** (+7). São as datas das 5 missas.
- **`acolitos_celebracoes`** — `select('*')` com `data in (sábado, domingo)`. Campos usados:
  `id, data, horario, comunidade, tipo`.
- **`acolitos_escalas`** — `select('*, acolitos_membros!membro_id(id,nome)').in('celebracao_id', ids)`.
  ⚠️ O embed **precisa** de `!membro_id` (a tabela tem 2 FKs para membros; sem isso a query falha em
  silêncio — ver memória "Acólitos Embed Ambíguo"). Por missa, listar os membros **escalados**
  (`status = 'escalado'`), ordenados alfabeticamente por `acolitos_membros.nome`.
- **Rótulos**:
  - Função: `FUNCAO_LABEL` (espelhar de `escala.html:360`): apoio→Apoio, cruz→Cruz, vela→Vela,
    sineta→Sineta, sinao→Sinão, altar→Altar, turibulo→Turíbulo, naveta→Naveta, missal→Missal,
    cred_altar→**Cerim. Altar**, cred_credencia→**Cerim. Cred.**, mitra→Mitra, baculo→Báculo.
    Incluir também as funções customizadas de `acolitos_listas` (tipo='funcao').
  - Comunidade → rótulo da arte: `matriz`→`JCBP`, `santo_antonio`→`STO. ANTONIO`.
  - Ordem das missas: `HOR_ORDEM = ['17h','18h30','7h','9h','19h']` (espelha `escala.html:1125`).

O mapeamento de rótulos (FUNCAO_LABEL, comunidade, HOR_ORDEM) fica num **módulo compartilhado**
(`arte-escala/rotulos.js`) para não duplicar/derivar do `escala.html`.

## Litúrgico (calculado + override)

- **Cálculo**: biblioteca **romcal** a partir da data do **domingo alvo** → estação (tempo), ciclo
  dominical (Ano A/B/C), e **cor** litúrgica. A string PT ("Nº Domingo do Tempo Comum/do Advento/da
  Quaresma/da Páscoa") e "TEMPO COMUM/ADVENTO/…" são **formatadas por nós** (romcal dá a estação + número
  da semana; montamos o texto em português).
- **Cor → asset/pill**: mapa `verde|vermelho|branco|rosa|roxo` → arquivo de bandeira + cor de fundo do pill.
  - `branco`/`rosa` (cores claras): **texto do pill em escuro** (`#2B1C0E`) para manter legibilidade;
    demais cores mantêm texto creme.
- **Override manual** (nova tabela `acolitos_liturgia_override`): se houver linha para o domingo alvo,
  **vence** o cálculo. Campos: `domingo_data (date, pk)`, `tempo (text)`, `descricao (text)`,
  `cor (text: verde|vermelho|branco|rosa|roxo)`, `criado_por`, `criado_em`.
  - Mini-form só-coordenação na tela de Escala para preencher/editar (semanas raras: solenidade que cai
    no fim de semana, festa do Senhor, etc.).

## Render

**HTML/CSS estático → Puppeteer (Chromium headless) → screenshot PNG 2160×4800.**

- Template `arte-escala/template.html` + `dados.json` injetados (tempo, descrição, mês/ano, datas, cor,
  e as 5 missas com suas listas). Assets (brasão, bandeira da cor, fontes) inlined em base64 → página
  100% self-contained (sem rede durante o render).
- Puppeteer abre o HTML, aguarda fontes, e faz `screenshot` do elemento raiz em `deviceScaleFactor` que
  resulte em 2160×4800 exatos.
- Escolha do Puppeteer (vs. satori/resvg): a arte é ornamentada (fontes custom, layout de duas colunas
  com rosário, contornos) — Puppeteer dá fidelidade de CSS real. Roda em ambiente sem restrição (GitHub
  Actions), então o peso do Chromium não é problema.

## Runtime & agendamento

⚠️ Este repo **ainda não tem** `.github/workflows/` nem `package.json` na raiz (o coletor por GitHub
Actions é do **iamundi**, não daqui). Criamos do zero:

- **Subprojeto** `arte-escala/` com `package.json` (deps: `puppeteer`, `romcal`, `@supabase/supabase-js`).
- **Workflow** `.github/workflows/arte-escala.yml`:
  - `on.schedule: cron '0 0 * * 1'` (UTC) = **domingo 21h America/São_Paulo** (Brasil sem horário de
    verão, UTC−3 fixo).
  - `on.workflow_dispatch` (para o botão "Gerar/Atualizar").
  - Passos: checkout → `npm ci` (em `arte-escala/`) → `node arte-escala/gerar.mjs`.
  - **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (para ler escalas + escrever no Storage).
- **`gerar.mjs`**: calcula fim de semana alvo → lê Supabase (celebrações+escalas) → resolve litúrgico
  (override senão romcal) → monta `dados.json` → render Puppeteer → **upload** do PNG.

## Entrega

- **Supabase Storage**, bucket público `artes-escala`, caminho `AAAA-MM-DD.png` (data do **domingo** alvo).
- Tabela **`acolitos_escala_artes`**: `domingo_data (date, pk)`, `png_url`, `tempo`, `descricao`, `cor`,
  `gerado_em`, `gerado_por ('cron'|'manual')`. Upsert por `domingo_data`.
- **Tela de Escala** (`projetos/acolitos/escala.html`), na toolbar `.escala-acoes` (perto do
  `🖨 Escala (PDF)`):
  - Botão **`🎨 Arte da semana`** → abre um modal (`uiConfirm`/modal do `shared.js`) com **preview** da
    arte (PNG do próximo fim de semana, via `acolitos_escala_artes`) + **botão Baixar**.
  - Botão **`Gerar/Atualizar`** → chama `api/regenerar-arte.js` (Vercel serverless) que dispara o
    `workflow_dispatch` do GitHub (PAT guardado em env do Vercel, nunca no cliente). Usar após editar o
    override.
  - Visibilidade: **coordenação** (mesmo gate dos demais botões de relatório/geração da tela).

## Componentes (isolados)

| Componente | Responsabilidade | Entradas | Saídas |
|---|---|---|---|
| `arte-escala/rotulos.js` | Mapas FUNCAO_LABEL, comunidade→arte, HOR_ORDEM | — | constantes |
| `arte-escala/liturgico.mjs` | Calcular tempo/descrição/cor (romcal) + aplicar override | data domingo, override | `{tempo, descricao, cor}` |
| `arte-escala/dados.mjs` | Ler Supabase e montar o `dados.json` | fim de semana alvo | objeto de dados |
| `arte-escala/template.html` | Layout fiel + placeholders | `dados.json` | HTML render-ready |
| `arte-escala/render.mjs` | Puppeteer → PNG 2160×4800 | HTML | buffer PNG |
| `arte-escala/gerar.mjs` | Orquestra tudo + upload Storage/tabela | — | PNG publicado |
| `api/regenerar-arte.js` | Dispara workflow_dispatch (Vercel) | — | 202 |
| UI em `escala.html` | Botões Arte/Gerar + modal preview + form override | tabela artes/override | — |

## Erros / bordas

- **Missa sem escala montada** → bloco aparece com "(escala não montada)" no lugar da lista.
- **Fim de semana sem celebrações** no banco → não gera; registra log (e o botão manual avisa via toast).
- **Cor clara (branco/rosa)** → texto do pill em escuro (contraste).
- **Solenidade sobrepondo o domingo** → coordenação usa o override.
- **Falha do romcal / estação inesperada** → cai no override se existir; senão gera com aviso e cor verde
  padrão (nunca quebra o run).
- **Puppeteer/fontes** → aguardar `document.fonts.ready` antes do screenshot.

## Validação

- **Litúrgico**: teste unitário de `liturgico.mjs` em datas conhecidas (ex.: 12/07/2026 → "15º Domingo do
  Tempo Comum, Ano A", verde; um domingo do Advento → roxo; Pentecostes → vermelho).
- **Dados**: rodar `dados.mjs` contra o fim de semana do modelo (11–12/07/2026) e conferir que as 5 listas
  batem com o `teste.png`.
- **Render**: gerar o PNG do fim de semana do modelo e **comparar visualmente** com `teste.png`
  (layout, cores, fontes Sora/Inter, bandeiras, rosário).
- **Ponta a ponta**: `workflow_dispatch` manual → PNG no Storage → botão "Arte da semana" no app mostra e
  baixa.
- **Override**: preencher o override, regenerar, conferir que tempo/descrição/cor mudaram.

## Fora de escopo (v1)

- Auto-post em WhatsApp/Instagram.
- Subir a arte no Canva.
- Formatos alternativos (quadrado/feed, story 1080×1920).
- Edição visual da arte pela coordenação (só troca de override).

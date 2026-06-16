# Splash de Carregamento "Turíbulo" (Acólitos) — Design

Data: 2026-06-16
Status: aprovado (brainstorming)

## Contexto
Hoje, ao abrir o app (`projetos/acolitos/index.html`), aparece só um
`<span class="loading">Carregando...</span>` (l.93) — um spinner simples
(`.loading::after` em `shared.css`). O usuário quer uma entrada **litúrgica e
épica**. Conceito escolhido: **turíbulo (incenso)** — um turíbulo balançando com
fumaça subindo e partículas douradas, encerrando com o lema **"SOMOS DO ALTAR"**.

Recursos visuais já existentes (reaproveitar a linguagem, não os arquivos):
- Paleta: `--gold`, `--gold-light`, `--gold-dim`, `--wine`, `--wine-bright`,
  `--red`, `--red-glow` (tema escuro).
- Fontes: Sora, Oxanium, Lora (já carregadas no `index.html`).
- `init()` (index.html l.121) chama `initModulo()` (l.122) e monta a home; é
  invocado em l.846. Pode ter early-return (redireciona ao login se sem sessão).

## Escopo
- **Só `index.html`** (entrada do app/dashboard). Tudo inline (SVG + CSS + JS) —
  sem dependência de imagem/arquivo.
- **Fora de escopo:** `login.html` (estender depois), som, mudar o `.loading`
  padrão de outras telas.

## Arquitetura / componentes

### 1. Overlay `#splash` (markup no `<body>`, antes de `#app-header`)
Camada fixa em tela cheia (`position:fixed; inset:0; z-index` alto), cobrindo o
app durante o boot. Composição (de trás pra frente):
- **Fundo:** vinho/escuro com **glow dourado radial** central + **vinheta** nas
  bordas (box-shadow inset / radial-gradient).
- **Turíbulo (SVG inline):** corpo do incensário + tampa perfurada + correntes
  saindo de um pivô no topo. Agrupado num `<g>` com `transform-origin` no pivô
  para **balançar** (pêndulo).
- **Fumaça:** 2–3 fios translúcidos dourados subindo (paths/elipses com blur via
  `filter` SVG ou divs com gradient + blur), animados em opacidade+translateY.
- **Partículas douradas:** 6–10 pontos pequenos flutuando pra cima (CSS
  `@keyframes` com delays diferentes; variar por `:nth-child`).
- **Texto:** "SOMOS DO ALTAR" (Sora/Oxanium, ouro, `letter-spacing` amplo, leve
  **shimmer** de gradiente) + subtítulo fino "preparando a celebração…" com 3
  pontos pulsando.

### 2. Animações (CSS `@keyframes`)
- `turSwing` — rotação suave do `<g>` do turíbulo (ex.: -8°↔+8°, ~3.2s
  ease-in-out infinite, pivô no topo das correntes).
- `smokeRise` — fumaça: `opacity` 0→.5→0 + `translateY` subindo + leve
  `scale`/`skew`, ~4s, com delays por fio.
- `dustRise` — partículas subindo e sumindo, durações/delays variados.
- `goldShimmer` — gradiente dourado deslizando no texto (`background-clip:text`).
- `dotPulse` — os 3 pontos do subtítulo.

### 3. Acessibilidade
`@media (prefers-reduced-motion: reduce)`: desliga `turSwing`, `smokeRise`,
`dustRise`, `goldShimmer` (cena estática). O fade-out de saída pode permanecer
(transição curta de opacidade) por ser discreto.

### 4. Comportamento (JS no `<script>` do index.html)
- Constante `SPLASH_MIN_MS = 1300` (permanência mínima p/ a animação aparecer).
- Marcar `splashStart = Date.now()` no load (ou usar performance).
- `hideSplash()`: calcula `restante = SPLASH_MIN_MS - (agora - splashStart)`;
  após `max(0, restante)`, adiciona classe `.splash-out` (opacity→0 via
  transition ~600ms) e remove o nó ao fim (`transitionend` ou `setTimeout`).
  Idempotente (não faz nada se já saindo).
- **Ganchos de esconder:**
  - No fim do fluxo de `init()` (sucesso) → `hideSplash()`.
  - Em todo early-return de `init()` (ex.: sem ctx / redirect login) →
    `hideSplash()` antes de retornar/redirecionar (ou deixar o splash cobrir o
    redirect; mas garantir que não fica preso se a navegação não ocorrer).
  - **Safety net:** `setTimeout(hideSplash, 8000)` no load — nunca trava a tela
    mesmo se `init()` lançar erro.
- Nota: `Date.now()`/`new Date()` são normais no app (isto é browser, não o
  ambiente de workflow). Sem restrição aqui.

## Erros / bordas
- `init()` lança exceção → o safety-net (8s) ainda esconde o splash.
- Carregamento muito rápido → respeita os 1300ms mínimos (sem "flash").
- `prefers-reduced-motion` → cena estática, sem balanço/fumaça.
- Z-index: splash acima de header/nav/conteúdo, mas é removido do DOM ao fim
  (não intercepta cliques depois).

## Validação
Mudança visual num único arquivo, sem framework de teste:
- `node` checa a sintaxe dos blocos `<script>` do `index.html`.
- Validação visual no deploy (do **root** do repo): abrir o app e ver o splash
  balançar, a fumaça subir, o texto aparecer, e dissolver ao carregar; testar
  em celular; testar com "reduzir movimento" ligado (iOS: Ajustes →
  Acessibilidade → Movimento).

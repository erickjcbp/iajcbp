# Splash de Carregamento "Turíbulo" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o "Carregando..." simples do `index.html` por um splash litúrgico (turíbulo SVG balançando + incenso + "SOMOS DO ALTAR") que dissolve quando o app carrega.

**Architecture:** Overlay `#splash` em tela cheia (SVG + CSS + JS inline em `index.html`), com animações CSS (`@keyframes`) e um `hideSplash()` chamado via `init().catch().finally()` + safety-net. Respeita `prefers-reduced-motion`. Sem dependência de imagem.

**Tech Stack:** HTML/CSS/JS vanilla (sem framework de teste).

---

## Contexto técnico
- `index.html`: `<body>` em l.89, `<div id="app-header">` em l.90, `<div class="main" id="main">` com `<span class="loading">Carregando...</span>` em l.93. `</style>` fecha o CSS em ~l.86.
- `init()` (l.121): `const ctx = await initModulo();` → `if (!ctx) return;` (early-return; initModulo redireciona ao login internamente) → render. Chamado em **l.846** como `init();`.
- Paleta/fontes já disponíveis: `--gold`, `--gold-light`, `--gold-dim`, `--wine`, `--red-glow`, `--text-muted`; Sora, Oxanium, Lora.

Convenções: commits PT terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; commitar na `main`. Deploy **do root** do repo (`/Users/erickmartins/iajcbp`).

Sintaxe (raiz do repo):
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'sintaxe OK':'FALHOU');"
```

---

## File Structure
- Modify: `projetos/acolitos/index.html` — CSS do splash (Task 1), markup `#splash` (Task 1), JS `hideSplash` + wiring (Task 2).

---

## Task 1: CSS + markup do splash

**Files:** Modify `projetos/acolitos/index.html`

- [ ] **Step 1: Inserir o CSS do splash antes de `</style>`**

Localizar o fechamento do `<style>` (a linha `  </style>` logo após `.rank-fill { transition:width .5s ease; }`) e inserir ANTES dela:

```css
    /* ── Splash litúrgico (turíbulo) ── */
    #splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
      background:radial-gradient(circle at 50% 38%, #2a0e16 0%, #1a0a0f 55%, #0c0608 100%);overflow:hidden;transition:opacity .6s ease;}
    #splash.splash-out{opacity:0;pointer-events:none;}
    #splash .vignette{position:absolute;inset:0;box-shadow:inset 0 0 160px 40px rgba(0,0,0,.7);pointer-events:none;}
    #splash .glow{position:absolute;top:34%;left:50%;width:340px;height:340px;transform:translate(-50%,-50%);
      background:radial-gradient(circle,rgba(232,185,74,.22),rgba(232,185,74,0) 70%);filter:blur(6px);pointer-events:none;}
    #splash .turibulo-wrap{position:relative;width:160px;height:230px;}
    #splash .turibulo{transform-box:fill-box;transform-origin:50% 4%;animation:turSwing 3.2s ease-in-out infinite;}
    @keyframes turSwing{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
    #splash .smoke{position:absolute;left:50%;bottom:96px;width:16px;height:60px;border-radius:50%;
      background:radial-gradient(circle,rgba(232,185,74,.5),rgba(232,185,74,0) 70%);filter:blur(5px);opacity:0;transform:translateX(-50%);}
    #splash .smoke.s1{animation:smokeRise 4s ease-out infinite}
    #splash .smoke.s2{left:44%;animation:smokeRise 4.6s ease-out .8s infinite}
    #splash .smoke.s3{left:56%;animation:smokeRise 5.2s ease-out 1.6s infinite}
    @keyframes smokeRise{0%{opacity:0;transform:translate(-50%,0) scale(.6)}30%{opacity:.45}100%{opacity:0;transform:translate(-50%,-130px) scale(1.5)}}
    #splash .dust{position:absolute;bottom:92px;width:4px;height:4px;border-radius:50%;background:var(--gold-light,#ffd97a);box-shadow:0 0 6px var(--gold,#e8b94a);opacity:0;}
    @keyframes dustRise{0%{opacity:0;transform:translateY(0)}12%{opacity:.9}100%{opacity:0;transform:translateY(-170px)}}
    #splash .splash-title{font-family:'Oxanium','Sora',sans-serif;font-weight:800;font-size:22px;letter-spacing:6px;
      background:linear-gradient(90deg,#8a6a24,#ffd97a,#8a6a24);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:goldShimmer 3s linear infinite;}
    @keyframes goldShimmer{to{background-position:200% 0}}
    #splash .splash-sub{font-family:'Sora',sans-serif;font-size:11px;color:var(--text-muted,#9a8a8e);letter-spacing:2px;}
    #splash .splash-dots span{animation:dotPulse 1.4s infinite}
    #splash .splash-dots span:nth-child(2){animation-delay:.2s}
    #splash .splash-dots span:nth-child(3){animation-delay:.4s}
    @keyframes dotPulse{0%,100%{opacity:.2}50%{opacity:1}}
    @media (prefers-reduced-motion:reduce){
      #splash .turibulo,#splash .smoke,#splash .dust,#splash .splash-title,#splash .splash-dots span{animation:none!important}
      #splash .smoke,#splash .dust{opacity:.25}
    }
```

- [ ] **Step 2: Inserir o markup do splash logo após `<body>` (antes de `<div id="app-header">`)**

Trocar:
```html
<body>
<div id="app-header"></div>
```
por:
```html
<body>
<div id="splash" aria-hidden="true">
  <div class="glow"></div>
  <div class="turibulo-wrap">
    <svg class="turibulo" viewBox="0 0 160 230" width="160" height="230" fill="none" aria-hidden="true">
      <defs>
        <filter id="tglow"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="tgold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd97a"/><stop offset="1" stop-color="#8a6a24"/></linearGradient>
      </defs>
      <g filter="url(#tglow)" stroke="url(#tgold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="80" cy="10" r="5"/>
        <path d="M80 14 L58 132"/><path d="M80 14 L102 132"/><path d="M80 14 L80 120"/>
        <path d="M52 134 Q80 96 108 134 Z" fill="rgba(232,185,74,.08)"/>
        <line x1="66" y1="120" x2="66" y2="128"/><line x1="80" y1="112" x2="80" y2="122"/><line x1="94" y1="120" x2="94" y2="128"/>
        <path d="M80 92 L80 104 M75 97 L85 97"/>
        <path d="M50 136 Q80 132 110 136 L104 168 Q80 184 56 168 Z" fill="rgba(232,185,74,.10)"/>
        <ellipse cx="80" cy="160" rx="14" ry="6" fill="rgba(255,120,40,.35)" stroke="none"/>
      </g>
    </svg>
    <div class="smoke s1"></div><div class="smoke s2"></div><div class="smoke s3"></div>
    <div class="dust" style="left:46%;animation:dustRise 5s linear infinite"></div>
    <div class="dust" style="left:54%;animation:dustRise 5.6s linear .6s infinite"></div>
    <div class="dust" style="left:50%;animation:dustRise 4.6s linear 1s infinite"></div>
    <div class="dust" style="left:42%;animation:dustRise 6s linear 1.4s infinite"></div>
    <div class="dust" style="left:58%;animation:dustRise 5.2s linear 2s infinite"></div>
    <div class="dust" style="left:48%;animation:dustRise 6.4s linear 2.6s infinite"></div>
  </div>
  <div class="splash-title">SOMOS DO ALTAR</div>
  <div class="splash-sub">preparando a celebração<span class="splash-dots"><span>.</span><span>.</span><span>.</span></span></div>
  <div class="vignette"></div>
</div>
<div id="app-header"></div>
```

- [ ] **Step 3: Validar sintaxe** (comando acima). Expected: `sintaxe OK` (CSS/markup não afetam os blocos `<script>`, mas roda pra garantir que nada quebrou).

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/index.html
git commit -m "feat(acolitos): splash litúrgico de carregamento (turíbulo + incenso) — visual

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Comportamento — esconder o splash (min-dwell + safety-net)

**Files:** Modify `projetos/acolitos/index.html`

- [ ] **Step 1: Adicionar `hideSplash` + safety-net no início do `<script>` inline**

Logo após a abertura do segundo `<script>` (o inline, que vem depois de `<script src="shared.js"></script>` — onde está o comentário `// EQUIPE_ROLES já vem do shared.js...`), inserir no topo:

```js
// Splash litúrgico: permanência mínima p/ a animação aparecer + saída suave; nunca trava a tela.
const SPLASH_MIN_MS = 1300;
const _splashStart = Date.now();
let _splashGone = false;
function hideSplash(){
  if (_splashGone) return; _splashGone = true;
  const el = document.getElementById('splash');
  if (!el) return;
  const restante = Math.max(0, SPLASH_MIN_MS - (Date.now() - _splashStart));
  setTimeout(() => {
    el.classList.add('splash-out');
    setTimeout(() => { el.remove(); }, 700);
  }, restante);
}
setTimeout(hideSplash, 8000); // safety-net: some mesmo se init() travar/erro
```

- [ ] **Step 2: Acionar `hideSplash` quando `init()` terminar (qualquer caso)**

Localizar a chamada final `init();` (l.846) e trocar por:
```js
init().catch(err => console.error('init falhou:', err)).finally(hideSplash);
```

- [ ] **Step 3: Validar sintaxe** (comando acima). Expected: `sintaxe OK`.

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/index.html
git commit -m "feat(acolitos): esconder o splash ao carregar (min-dwell 1.3s + safety-net 8s)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Deploy e validação visual

**Files:** — (deploy)

- [ ] **Step 1: Push + deploy do ROOT**

Garantir cwd no root e deployar:
```bash
cd /Users/erickmartins/iajcbp && pwd   # precisa imprimir /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes
```
(Deploy deve sair como `iajcbp-...`. Se sair `acolitos-...`, a cwd estava errada — refazer do root.)

- [ ] **Step 2: Confirmar no ar**
```bash
curl -s "https://coroinhas.jcbplimeira.com.br/projetos/acolitos/index.html" | grep -o "SOMOS DO ALTAR\|id=\"splash\"" | sort -u
```
Expected: `SOMOS DO ALTAR` e `id="splash"`.

- [ ] **Step 3: Validação visual (humano)**

Abrir o app (logado) e conferir: o turíbulo balança, a fumaça/partículas sobem, "SOMOS DO ALTAR" com brilho, e o splash dissolve quando a home carrega (sem ficar preso). Testar no celular. Testar com "Reduzir movimento" ligado (iOS: Ajustes → Acessibilidade → Movimento) — cena fica estática e ainda dissolve.

---

## Self-Review (preenchido)

**1. Spec coverage:**
- Overlay #splash full-screen com glow/vinheta → Task 1 ✅
- Turíbulo SVG balançando → Task 1 (SVG + `turSwing`) ✅
- Fumaça + partículas douradas → Task 1 (`smoke`/`dust` + keyframes) ✅
- "SOMOS DO ALTAR" + shimmer + subtítulo com pontos → Task 1 ✅
- prefers-reduced-motion → Task 1 (media query) ✅
- hideSplash com min-dwell + ganchos (init finally) + safety-net → Task 2 ✅
- Só index.html, inline, sem imagem → ✅

**2. Placeholder scan:** sem TBD/TODO; CSS, markup e JS completos.

**3. Type consistency:** `hideSplash()` idempotente (`_splashGone`), usa `#splash`, classe `.splash-out` (definida no CSS da Task 1). `init().finally(hideSplash)` cobre sucesso/early-return/erro; safety-net cobre travamento.

**Riscos:** (a) garantir inserir o CSS dentro do `<style>` certo (o do index.html) e o JS no `<script>` inline (não no de shared.js). (b) z-index 9999 cobre header/nav; o nó é removido (`el.remove()`) ao fim, então não intercepta cliques depois.

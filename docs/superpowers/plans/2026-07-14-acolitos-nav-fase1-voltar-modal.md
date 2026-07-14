# Spec D · Fase 1 — Voltar fecha o modal (app-wide) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** O botão Voltar do navegador (e o gesto de voltar no celular) **fecha o modal aberto** em vez de sair da tela. App-wide, centralizado no `shared.js`, sem tocar em cada call-site de modal.

**Architecture:** Um controlador de histórico no `shared.js` que (a) detecta via `MutationObserver` quando um `.modal-overlay` fica visível (classe `.open` OU nó recém-inserido já com `.open`) ou some (classe removida, nó removido); (b) ao abrir, empilha `history.pushState`; (c) no `popstate` (Voltar), se há modal aberto, fecha o topo e consome o estado, sem navegar; (d) ao fechar por X/fundo/programático, descarta o estado empilhado com um `history.back()` "silencioso" (flag pra não reprocessar). Cobre os dois padrões de modal do app (fixos com `.open` e dinâmicos criados/removidos via JS).

**Tech Stack:** JS puro no `shared.js` (todas as telas do app o carregam). Sem dependência externa. Verificação: navegador (Playwright) com login coord — testar em várias telas + iOS/Android via emulação de viewport.

## Global Constraints
- Só `shared.js` (mais, se necessário, um opt-out `data-no-history` em modais efêmeros que NÃO devem entrar no histórico — ex.: toast/celebração de nível). NÃO editar os 28 call-sites de modal das telas.
- Cobrir os **dois padrões**: (1) fixos por tela — `.modal-overlay` no HTML, abre com `classList.add('open')`, fecha com `fecharModal(id)`/`classList.remove('open')`; (2) dinâmicos — `document.createElement('div').className='modal-overlay open'` + `appendChild`, fecham com `ov.remove()` (clique no fundo/X) — inclusive os criados no próprio shared.js (uiConfirm/uiAlert/uiPrompt, celebração de nível, PWA banner).
- **Idempotente e sem loop**: nunca empilhar dois estados pro mesmo modal; nunca disparar `popstate` em cadeia. Um flag interno controla o `history.back()` programático.
- Não quebrar navegação entre PÁGINAS (o Voltar sem modal aberto navega normal).
- Não brigar com os redirects de gate (`navGuard`/login) — o controlador só age quando há `.modal-overlay.open` no DOM.
- Modais **empilhados** (modal sobre modal): fechar um de cada vez (LIFO).
- Mobile-first; testar o gesto de voltar (iOS Safari / Android Chrome).

---

## Task 1: Controlador de histórico de modal no shared.js

**Files:**
- Modify: `projetos/acolitos/shared.js`

**Interfaces:**
- Produz: IIFE `modalHistory` (auto-inicializa no load). Sem API pública consumida por outras telas (é transparente). Marcador interno: cada overlay observado ganha `dataset.acmodalTracked='1'`.

- [ ] **Step 1: Escrever o controlador (IIFE) no fim do shared.js**

Adicionar ao final do `shared.js` (antes de qualquer `})();` global de fechamento, ou como novo bloco IIFE independente):

```js
// ── Histórico de modal: o Voltar do navegador/gesto fecha o modal aberto ──
// Transparente e app-wide: observa .modal-overlay.open no DOM (cobre modais fixos e
// dinâmicos), empilha um estado no history ao abrir, e no popstate fecha o topo.
(function modalHistory(){
  'use strict';
  if (window.__acModalHistory) return; window.__acModalHistory = true;

  var stack = [];          // overlays abertos, na ordem (LIFO)
  var closingProgrammatic = false; // evita reprocessar nosso próprio history.back()

  function isOpen(ov){ return ov && ov.classList && ov.classList.contains('open') && ov.classList.contains('modal-overlay'); }
  function optedOut(ov){ return ov.hasAttribute && ov.hasAttribute('data-no-history'); }

  function onOpen(ov){
    if (optedOut(ov) || stack.indexOf(ov) !== -1) return;
    stack.push(ov);
    // um estado por modal aberto
    try { history.pushState({ acmodal: true, depth: stack.length }, ''); } catch(e){}
  }

  // Chamado quando um modal deixou de estar aberto por QUALQUER via (X, fundo, programático, .open removido).
  function onClose(ov){
    var i = stack.indexOf(ov);
    if (i === -1) return;
    stack.splice(i, 1);
    // Se o fechamento NÃO veio de um popstate nosso, descartamos o estado empilhado.
    if (!closingProgrammatic) {
      closingProgrammatic = true;
      try { history.back(); } catch(e){ closingProgrammatic = false; }
      // o popstate resultante cai no handler abaixo, que reseta a flag.
    }
  }

  // Fecha visualmente um overlay (cobre os dois padrões).
  function closeOverlay(ov){
    if (!ov) return;
    if (ov.classList.contains('open')) ov.classList.remove('open');
    // dinâmicos que fecham via remove(): se ainda está no DOM e não tem 'open', deixa o app removê-lo;
    // mas se ele depende só de remove(), removemos aqui para o Voltar surtir efeito.
    if (ov.parentNode && !ov.classList.contains('open') && ov.dataset.acmodalDynamic === '1') {
      ov.parentNode.removeChild(ov);
    }
  }

  window.addEventListener('popstate', function(){
    if (closingProgrammatic) {           // foi o history.back() que nós disparamos ao fechar por X/fundo
      closingProgrammatic = false;
      return;
    }
    // Voltar do usuário: se há modal aberto, fecha o topo e NÃO navega.
    if (stack.length) {
      var ov = stack[stack.length - 1];
      // re-empilha o estado que o Voltar consumiu, para manter a página (evita sair da tela)
      // ao fechar 1 modal por vez sem "vazar" um Voltar extra para a navegação.
      stack.pop();
      closingProgrammatic = false;
      closeOverlay(ov);
      // Se ainda restam modais, o history já está no nível certo; se não, também.
    }
    // se stack vazio: navegação normal (não intervimos).
  });

  // Observa o DOM inteiro: entra/sai .open e nós adicionados/removidos.
  function scanNode(n, opened){
    if (!n || n.nodeType !== 1) return;
    if (n.classList && n.classList.contains('modal-overlay')) {
      if (opened && isOpen(n)) onOpen(n);
    }
  }
  var mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      if (m.type === 'attributes' && m.target && m.target.classList && m.target.classList.contains('modal-overlay')) {
        if (isOpen(m.target)) onOpen(m.target); else onClose(m.target);
      }
      if (m.type === 'childList') {
        m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function(n){
          if (n.nodeType===1 && n.classList && n.classList.contains('modal-overlay')) {
            n.dataset.acmodalDynamic = '1';           // criado dinamicamente
            if (isOpen(n)) onOpen(n);
          }
        });
        m.removedNodes && Array.prototype.forEach.call(m.removedNodes, function(n){
          if (n.nodeType===1 && n.classList && n.classList.contains('modal-overlay')) onClose(n);
        });
      }
    });
  });
  function start(){
    mo.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
    // captura modais já abertos no load (raro)
    Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay.open'), onOpen);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
```

> NOTA DE IMPLEMENTAÇÃO: este step é a lógica-núcleo. O implementador deve VALIDAR a interação `pushState`/`popstate`/`history.back` no navegador (Step 3) e ajustar o balanceamento de estados se um "Voltar extra" vazar para a navegação — o ponto mais delicado é garantir que fechar por X/fundo consuma exatamente 1 estido e o Voltar do usuário consuma exatamente 1. Se o comportamento divergir, preferir a abordagem "1 estado por modal + back() no fechamento manual" e testar cada caminho no Step 3 antes de commitar.

- [ ] **Step 2: Opt-out em modais efêmeros do shared.js**

Marcar com `data-no-history` os overlays que NÃO devem virar item de histórico (senão o Voltar "gasta" num toast). No `shared.js`, nos overlays de: celebração de nível (`showCeleb`/quest/estrela), banner PWA, e QUALQUER overlay puramente informativo de auto-dismiss. Ex.: onde cria `ov.className='modal-overlay open'` desses, adicionar `ov.setAttribute('data-no-history','1')`.
NÃO marcar uiConfirm/uiPrompt (esses DEVEM fechar no Voltar) — mas garantir que o Voltar neles equivale a cancelar (o `closeOverlay` remove; o `done(false/null)` do ui* é disparado pelo próprio remove? se não, ver Step 2b).

- [ ] **Step 2b: Garantir que fechar via Voltar dispare o cancelamento dos ui\* (se necessário)**

Se `uiConfirm/uiAlert/uiPrompt` resolvem a Promise só no clique dos botões (não no `remove()`), então fechar via Voltar removeria o overlay SEM resolver a Promise (trava). Conferir no shared.js: se `done()` não é chamado ao remover o nó, adicionar um guard — ex.: um `MutationObserver`/`ov` cujo `remove` chama `done(cancel)`. Alternativa mais simples: marcar os ui\* com `data-no-history` também (não fecham no Voltar) — decidir no Step 3 conforme o teste. Documentar a escolha.

- [ ] **Step 3: Verificação no navegador (login coord) — a fase mais delicada**

Servir root + Playwright, login `bot-teste@jcbplimeira.com` / `Coroinha-Bot-2026!`. Testar em MÚLTIPLAS telas:
1. **Escala**: abrir "Montar escala" (modal-montagem) → apertar Voltar (history.back via `page.goBack()`) → o **modal fecha** e a página CONTINUA na Escala (não sai). Repetir com modal-info, modal-modelos.
2. **Membros**: abrir um modal de membro → Voltar → fecha, fica em Membros.
3. **Modal dinâmico** (ex.: um `uiConfirm` ou o modal de troca/detalhe criado via createElement) → Voltar → fecha.
4. **Sem modal**: na Escala sem modal, Voltar → navega normal (volta pra tela anterior).
5. **Fechar por X/fundo** e DEPOIS Voltar → o Voltar deve navegar (não "engolir" um estado fantasma). Ou seja: abrir modal, fechar no X, apertar Voltar → sai da tela normalmente (não fica preso).
6. **Modal sobre modal** (se houver): abrir A, abrir B, Voltar fecha B, Voltar fecha A, Voltar navega.
7. Emular viewport mobile (390px) e repetir o caso 1.

Registrar cada caso PASS/FAIL com screenshot. Se algum "Voltar extra" vazar (sai da tela quando não devia) ou travar (Voltar não fecha), ajustar o Step 1 e re-testar ANTES de commitar.

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/shared.js
git commit -m "feat(acolitos): Voltar do navegador/gesto fecha o modal aberto (app-wide) — Spec D F1"
```

---

## Self-review (na escrita)
- **Cobertura:** F1 do spec (Voltar fecha modal, app-wide via shared.js, detecção automática, opt-out, não brigar com gate) → Task 1. ✔
- **Riscos conhecidos (por isso o Step 3 é extenso):** balanceamento pushState/popstate/back (o clássico "Voltar extra"); ui\* que resolvem Promise só no botão (Step 2b); modais empilhados; diferença de comportamento do gesto no iOS. O plano manda VALIDAR cada caminho no navegador antes de commitar — não é um "escreve e confia".
- **Placeholders:** o código-núcleo está completo; os Steps 2/2b dependem de inspeção do shared.js real (quais overlays são efêmeros / como os ui* resolvem) — descrito o que checar e o critério de decisão. ✔
- **Reversível:** é só `shared.js`; se algo der errado em produção, revert do commit + redeploy. ✔

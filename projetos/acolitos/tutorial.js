// Tutorial guiado do membro — a TELA (balão + destaque). A regra e os textos moram em tutorial-core.js.
// Abre sozinho na primeira vez que a pessoa entra em cada tela (abrirSeNovo) e de novo pelo botão "?" do topo (abrir).
// Gravar "já vi" é feito pelo banco (acolitos_tutorial_marcar), para valer em qualquer celular.
(function (global) {
  'use strict';
  var TC = global.TutorialCore;
  if (!TC || global.TutorialGuiado) return;

  var ID = 'tutorial-guiado';
  var ativo = null;

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function visivel(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = global.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  // Acha o elemento do passo: por CSS ou pelo texto que a pessoa lê. Sem achar, o balão vai para o centro.
  function achar(passo) {
    try {
      if (passo.seletor) { var e = document.querySelector(passo.seletor); return visivel(e) ? e : null; }
      if (!passo.ancora) return null;
      var alvo = norm(passo.ancora);
      var raiz = document.getElementById('main') || document.getElementById('main-content') || document.body;
      var todos = raiz.querySelectorAll('*');
      var melhor = null;
      for (var i = 0; i < todos.length; i++) {
        var el = todos[i];
        var tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'OPTION') continue;
        if (el.closest && el.closest('#' + ID)) continue;
        if (norm(el.textContent) !== alvo) continue;
        if (!visivel(el)) continue;
        // o mais fundo vence: é o próprio rótulo, e não o quadro inteiro que o contém
        if (!melhor || melhor.contains(el)) melhor = el;
      }
      return melhor;
    } catch (_) { return null; }
  }

  function injetarEstilo() {
    if (document.getElementById(ID + '-css')) return;
    var st = document.createElement('style');
    st.id = ID + '-css';
    st.textContent = [
      '#' + ID + '{position:fixed;inset:0;z-index:9500;touch-action:none}',
      '#' + ID + ' .tg-foco{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(8,3,5,.78);outline:2px solid var(--gold,#e8c15a);outline-offset:3px;pointer-events:none;transition:all .28s ease}',
      '#' + ID + ' .tg-foco.tg-sem{box-shadow:0 0 0 9999px rgba(8,3,5,.78);outline:none}',
      '#' + ID + ' .tg-balao{position:fixed;left:50%;width:min(calc(100vw - 32px),380px);box-sizing:border-box;transform:translateX(-50%);background:#200d12;color:#fff;border:1px solid var(--gold,#e8c15a);border-radius:16px;padding:16px 16px 12px;box-shadow:0 12px 36px rgba(0,0,0,.55);font-family:inherit}',
      '#' + ID + ' .tg-titulo{margin:0 0 6px;font-size:18px;font-weight:800;line-height:1.25;color:var(--gold,#e8c15a)}',
      '#' + ID + ' .tg-texto{margin:0 0 14px;font-size:16px;line-height:1.45;color:#f3e9e4}',
      '#' + ID + ' .tg-rodape{display:flex;align-items:center;gap:8px}',
      '#' + ID + ' .tg-pontos{flex:1;font-size:13px;color:#cdb8b0;letter-spacing:.02em}',
      '#' + ID + ' .tg-btn{min-height:44px;min-width:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer}',
      '#' + ID + ' .tg-btn.tg-principal{background:var(--gold,#e8c15a);border-color:var(--gold,#e8c15a);color:#2a1205}',
      '#' + ID + ' .tg-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}',
      '@media (prefers-reduced-motion:reduce){#' + ID + ' .tg-foco{transition:none}}',
    ].join('\n');
    document.head.appendChild(st);
  }

  function limpar() {
    var el = document.getElementById(ID);
    if (el) el.remove();
    document.removeEventListener('keydown', aoTeclar, true);
    if (ativo && ativo.relogio) clearInterval(ativo.relogio);
    global.removeEventListener('resize', reposicionar);
    global.removeEventListener('scroll', reposicionar, true);
    if (ativo && ativo.anterior && ativo.anterior.focus) { try { ativo.anterior.focus(); } catch (_) {} }
    ativo = null;
  }

  function aoTeclar(ev) {
    if (!ativo) return;
    if (ev.key === 'Escape') { ev.preventDefault(); terminar(true); }
    else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { if (ev.target && ev.target.tagName === 'BUTTON') return; ev.preventDefault(); avancar(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); voltar(); }
  }

  function reposicionar() {
    if (!ativo) return;
    var passo = ativo.passos[ativo.i];
    var alvo = achar(passo);
    var foco = ativo.foco, balao = ativo.balao;
    var vw = global.innerWidth, vh = global.innerHeight, folga = 8;
    if (!alvo) {
      foco.className = 'tg-foco tg-sem';
      foco.style.cssText = 'left:' + (vw / 2) + 'px;top:' + (vh / 2) + 'px;width:0;height:0';
      balao.style.top = Math.max(16, (vh - balao.offsetHeight) / 2) + 'px';
      return;
    }
    var r = alvo.getBoundingClientRect();
    var esq = Math.max(4, r.left - folga), topo = Math.max(4, r.top - folga);
    var larg = Math.min(vw - 8 - esq, r.width + folga * 2), alt = Math.min(vh - 8 - topo, r.height + folga * 2);
    foco.className = 'tg-foco';
    foco.style.cssText = 'left:' + esq + 'px;top:' + topo + 'px;width:' + larg + 'px;height:' + alt + 'px';
    var h = balao.offsetHeight, abaixo = topo + alt + 14, acima = topo - h - 14;
    var y = abaixo + h <= vh - 8 ? abaixo : (acima >= 8 ? acima : Math.max(8, vh - h - 8));
    balao.style.top = y + 'px';
  }

  function mostrar() {
    var passo = ativo.passos[ativo.i], total = ativo.passos.length;
    ativo.balao.querySelector('.tg-titulo').textContent = passo.titulo || ativo.titulo;
    ativo.balao.querySelector('.tg-texto').textContent = passo.texto;
    ativo.balao.querySelector('.tg-pontos').textContent = (ativo.i + 1) + ' de ' + total;
    ativo.voltarBtn.style.display = ativo.i > 0 ? '' : 'none';
    ativo.proximoBtn.textContent = ativo.i + 1 >= total ? 'Entendi!' : 'Próximo';
    var alvo = achar(passo);
    if (alvo && alvo.scrollIntoView) {
      var reduzir = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { alvo.scrollIntoView({ block: 'center', behavior: reduzir ? 'auto' : 'smooth' }); } catch (_) { alvo.scrollIntoView(); }
    }
    reposicionar();
    setTimeout(reposicionar, 380);   // depois da rolagem suave
    ativo.proximoBtn.focus({ preventScroll: true });
  }

  function avancar() {
    var n = TC.proximo(ativo.i, ativo.passos.length);
    if (n == null) return terminar(false);
    ativo.i = n; mostrar();
  }
  function voltar() { ativo.i = TC.anterior(ativo.i); mostrar(); }

  // Terminar ou pular: nos dois casos a tela conta como vista, senão voltaria a aparecer toda vez que a pessoa entrasse.
  function terminar() {
    var tela = ativo && ativo.tela, ctx = ativo && ativo.ctx, manual = ativo && ativo.manual;
    limpar();
    if (!tela || !ctx || !ctx.membro) return;
    ctx.membro.tutorial_visto = TC.aoCompletar(ctx.membro.tutorial_visto, tela, new Date().toISOString());
    if (manual) return;   // reabrir pelo "?" não precisa gravar de novo
    try {
      // `sb` é const do shared.js: fica no escopo global dos scripts, mas NÃO vira propriedade de window
      var cliente = typeof sb !== 'undefined' ? sb : null;
      if (cliente && cliente.rpc) {
        var p = cliente.rpc('acolitos_tutorial_marcar', { p_membro: ctx.membro.id, p_tela: tela });
        if (p && p.then) p.then(function () {}, function () {});
      }
    } catch (_) {}
  }

  function abrir(tela, ctx, opcoes) {
    var def = TC.tutorialDa(tela);
    if (!def || ativo) return false;
    injetarEstilo();
    var raiz = document.createElement('div');
    raiz.id = ID; raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-label', 'Tutorial: ' + def.titulo);
    var foco = document.createElement('div'); foco.className = 'tg-foco tg-sem';
    var balao = document.createElement('div'); balao.className = 'tg-balao';
    var tituloEl = document.createElement('h2'); tituloEl.className = 'tg-titulo';
    var textoEl = document.createElement('p'); textoEl.className = 'tg-texto';
    var rodape = document.createElement('div'); rodape.className = 'tg-rodape';
    var pontos = document.createElement('span'); pontos.className = 'tg-pontos';
    rodape.appendChild(pontos);
    balao.append(tituloEl, textoEl, rodape);
    var pular = document.createElement('button'); pular.type = 'button'; pular.className = 'tg-btn'; pular.textContent = 'Pular';
    var voltarBtn = document.createElement('button'); voltarBtn.type = 'button'; voltarBtn.className = 'tg-btn'; voltarBtn.textContent = 'Voltar';
    var proximoBtn = document.createElement('button'); proximoBtn.type = 'button'; proximoBtn.className = 'tg-btn tg-principal';
    rodape.append(pular, voltarBtn, proximoBtn);
    raiz.append(foco, balao);
    document.body.appendChild(raiz);
    ativo = { tela: tela, ctx: ctx, manual: !!(opcoes && opcoes.manual), titulo: def.titulo, passos: def.passos, i: 0, raiz: raiz, foco: foco, balao: balao,
      voltarBtn: voltarBtn, proximoBtn: proximoBtn, anterior: document.activeElement };
    pular.onclick = function () { terminar(true); };
    voltarBtn.onclick = voltar;
    proximoBtn.onclick = avancar;
    raiz.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('keydown', aoTeclar, true);
    global.addEventListener('resize', reposicionar);
    global.addEventListener('scroll', reposicionar, true);
    mostrar();
    // a tela de fundo carrega dados depois de abrir: reconfere o alvo enquanto o balão está na tela
    ativo.relogio = setInterval(reposicionar, 600);
    return true;
  }

  // Espera a tela "ficar livre": splash da abertura e janelas de aviso fechadas. Passou do limite, abre assim mesmo
  // se estiver livre; se ainda tiver janela, desiste desta vez e a pessoa vê da próxima.
  function aguardarLivre(limiteMs) {
    return new Promise(function (resolve) {
      var inicio = Date.now();
      (function olhar() {
        var ocupado = document.getElementById('splash') || document.querySelector('.modal-overlay.open, [role="dialog"]:not(#' + ID + ')');
        if (!ocupado) return resolve(true);
        if (Date.now() - inicio > limiteMs) return resolve(false);
        setTimeout(olhar, 400);
      })();
    });
  }

  function abrirSeNovo(ctx, tela, modo) {
    if (!TC.deveAbrirSozinho(tela, ctx && ctx.membro && ctx.membro.tutorial_visto, ctx, modo)) return Promise.resolve(false);
    return aguardarLivre(30000).then(function (livre) {
      if (!livre) return false;
      // a pessoa pode ter saído da tela ou aberto o tutorial pelo "?" enquanto esperávamos
      if (!TC.deveAbrirSozinho(tela, ctx.membro.tutorial_visto, ctx, modo)) return false;
      return abrir(tela, ctx, { manual: false });
    });
  }

  global.TutorialGuiado = { abrir: abrir, abrirSeNovo: abrirSeNovo, achar: achar };
})(typeof globalThis !== 'undefined' ? globalThis : this);

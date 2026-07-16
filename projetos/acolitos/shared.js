/* shared.js — módulo Acólitos e Coroinhas */

// Bloqueia zoom por pinça/gesto no iOS Safari (que ignora user-scalable=no no navegador).
// O viewport (maximum-scale=1) + touch-action no CSS cobrem PWA e Android; isto fecha o iOS web.
['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
  document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
});

// ── SUPABASE ─────────────────────────────────────────────────
const SUPABASE_URL = 'https://fttjgsotuosjfrasttds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGpnc290dW9zamZyYXN0dGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzU3NjUsImV4cCI6MjA5NTExMTc2NX0.BvofcR2cIXP7Bc3r2V0VOgc-JXPefX7JGGwtzv0d_eA';

// Apenas anon key no browser. Autorização feita via RLS no banco.
// service_role key pertence somente a Edge Functions (variável de ambiente no servidor).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sbAdmin = sb; // alias — todas as operações elevadas são via RLS com o JWT do usuário

// ── PWA (instalável na tela inicial) ──────────────────────────
(function setupPWA() {
  try {
    const head = document.head; if (!head) return;
    const addMeta = (name, content) => { if (document.querySelector('meta[name="' + name + '"]')) return; const m = document.createElement('meta'); m.name = name; m.content = content; head.appendChild(m); };
    if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.json'; head.appendChild(l); }
    addMeta('theme-color', '#150a0d'); addMeta('mobile-web-app-capable', 'yes'); addMeta('apple-mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent'); addMeta('apple-mobile-web-app-title', 'Acólitos JCBP');
    if (!document.querySelector('link[rel="apple-touch-icon"]')) { const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'icon-192.png'; head.appendChild(a); }
    if ('serviceWorker' in navigator) {
      // Auto-atualização: ao detectar nova versão (SW), recarrega sozinho. Guard evita reload no 1º registro.
      const hadController = !!navigator.serviceWorker.controller;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing || !hadController) return; refreshing = true; window.location.reload(); });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          reg.update().catch(() => {});
          // checa por nova versão sempre que o app volta ao foco (momento seguro p/ atualizar)
          document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
        }).catch(() => {});
      });
    }

    // banner "Instalar app"
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone || localStorage.getItem('pwa-dismiss') === '1') return;
    function banner(texto, btnLabel, onBtn) {
      if (document.getElementById('pwa-banner') || !document.body) return;
      const b = document.createElement('div'); b.id = 'pwa-banner';
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h,0px) + 14px);z-index:400;max-width:460px;margin:0 auto;background:#200d13;border:1px solid #8a6a24;border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(0,0,0,.55);';
      const ic = document.createElement('img'); ic.src = 'icon-192.png'; ic.width = 34; ic.height = 34; ic.style.cssText = 'border-radius:8px;flex:none;';
      const tx = document.createElement('div'); tx.style.cssText = 'flex:1;font-size:12.5px;color:#f7ebe7;line-height:1.35;'; tx.textContent = texto;
      b.append(ic, tx);
      if (onBtn) { const bt = document.createElement('button'); bt.textContent = btnLabel; bt.style.cssText = 'flex:none;background:linear-gradient(160deg,#ffd97a,#8a6a24);color:#2a1500;border:none;border-radius:8px;padding:8px 12px;font-weight:800;font-size:12px;cursor:pointer;'; bt.onclick = onBtn; b.appendChild(bt); }
      const cl = document.createElement('button'); cl.textContent = '×'; cl.title = 'Dispensar'; cl.style.cssText = 'flex:none;background:none;border:none;color:#b88a8f;font-size:20px;line-height:1;cursor:pointer;'; cl.onclick = () => { localStorage.setItem('pwa-dismiss', '1'); b.remove(); }; b.appendChild(cl);
      document.body.appendChild(b);
    }
    function showInstall() { const ev = window.__bip; if (!ev) return; const old = document.getElementById('pwa-banner'); if (old) old.remove(); banner('Instale o app na sua tela inicial.', 'Instalar', () => { ev.prompt(); ev.userChoice.finally(() => { window.__bip = null; const el = document.getElementById('pwa-banner'); if (el) el.remove(); }); }); }
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua), isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua), isAndroidChrome = /android/i.test(ua) && /chrome/i.test(ua);
    if (window.__bip) showInstall(); // evento já capturado no <head>
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__bip = e; showInstall(); });
    window.addEventListener('appinstalled', () => { const el = document.getElementById('pwa-banner'); if (el) el.remove(); });
    if (isIOS && isSafari) setTimeout(() => banner('Para instalar: toque em Compartilhar e depois “Adicionar à Tela de Início”.', null, null), 1500);
    else if (isAndroidChrome) setTimeout(() => { if (!document.getElementById('pwa-banner')) banner('Para instalar: abra o menu (⋮) do Chrome e toque em “Instalar app”.', null, null); }, 3000);
  } catch (e) { /* PWA é progressivo — falha não quebra o app */ }
})();

// ── UTILS ─────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
         .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Aceita apenas URLs http/https — bloqueia javascript:, data:, etc.
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return url;
  } catch { return ''; }
}

function calcIdade(dataNasc) {
  if (!dataNasc) return '—';
  const hoje = new Date(), nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function diasNaEtapa(etapaIniciada) {
  if (!etapaIniciada) return 0;
  return Math.floor((Date.now() - new Date(etapaIniciada)) / 86400000);
}

// ── AUTH GUARD ────────────────────────────────────────────────
// requiredRoles: null (qualquer membro integrado) ou array de roles permitidos
// Retorna { user, membership, membro } ou null (e redireciona)
// Toast de feedback rápido (sucesso/erro)
function toast(msg, tipo) {
  let t = document.getElementById('app-toast');
  if (!t) { t = document.createElement('div'); t.id = 'app-toast'; document.body.appendChild(t); }
  t.className = 'app-toast show' + (tipo === 'error' ? ' error' : '');
  t.textContent = msg;
  clearTimeout(t._tm); t._tm = setTimeout(() => { t.classList.remove('show'); }, 2600);
}

// ── Splash litúrgico (turíbulo) — mostrado em toda carga de página do app ──
const ACO_SPLASH_MIN_MS = 2200;
let _acoSplashStart = 0, _acoSplashGone = false;
const ACO_SPLASH_HTML =
  '<div class="glow"></div>'
+ '<div class="turibulo-wrap">'
+   '<svg class="turibulo" viewBox="0 0 160 230" width="160" height="230" fill="none" aria-hidden="true">'
+     '<defs>'
+       '<filter id="tglow"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
+       '<linearGradient id="tgold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd97a"/><stop offset="1" stop-color="#8a6a24"/></linearGradient>'
+     '</defs>'
+     '<g filter="url(#tglow)" stroke="url(#tgold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
+       '<path d="M52 140 Q80 116 104 140" fill="rgba(232,185,74,.08)"/>'
+       '<line x1="66" y1="129" x2="66" y2="136"/><line x1="80" y1="125" x2="80" y2="133"/><line x1="94" y1="129" x2="94" y2="136"/>'
+       '<path d="M52 140 Q80 137 108 140 L93 170 Q80 178 67 170 Z" fill="rgba(232,185,74,.12)"/>'
+       '<ellipse cx="80" cy="150" rx="24" ry="6" fill="rgba(255,120,40,.34)" stroke="none"/>'
+       '<circle cx="80" cy="179" r="4"/>'
+       '<path d="M80 183 L80 193"/>'
+       '<path d="M67 203 Q80 196 93 203"/>'
+       '<ellipse cx="80" cy="204" rx="16" ry="3.2" fill="rgba(232,185,74,.10)"/>'
+       '<g stroke="#e8c46a">'
+         '<path d="M80 16 L52 140"/>'
+         '<path d="M80 16 L80 138"/>'
+         '<path d="M80 16 L108 140"/>'
+       '</g>'
+       '<circle cx="80" cy="10" r="5"/>'
+     '</g>'
+   '</svg>'
+   '<div class="smoke s1"></div><div class="smoke s2"></div><div class="smoke s3"></div><div class="smoke s4"></div><div class="smoke s5"></div>'
+   '<div class="dust" style="left:46%;animation:dustRise 5s linear infinite"></div>'
+   '<div class="dust" style="left:54%;animation:dustRise 5.6s linear .6s infinite"></div>'
+   '<div class="dust" style="left:50%;animation:dustRise 4.6s linear 1s infinite"></div>'
+   '<div class="dust" style="left:42%;animation:dustRise 6s linear 1.4s infinite"></div>'
+   '<div class="dust" style="left:58%;animation:dustRise 5.2s linear 2s infinite"></div>'
+   '<div class="dust" style="left:48%;animation:dustRise 6.4s linear 2.6s infinite"></div>'
+ '</div>'
+ '<div class="splash-title">SOMOS DO ALTAR</div>'
+ '<div class="splash-sub">preparando sua jornada<span class="splash-dots"><i></i><i></i><i></i></span></div>'
+ '<div class="vignette"></div>';
function showSplash(){
  if (document.getElementById('splash')) return;
  if (/login\.html$/.test(location.pathname)) return;
  const el = document.createElement('div');
  el.id = 'splash'; el.setAttribute('aria-hidden','true'); el.innerHTML = ACO_SPLASH_HTML;
  (document.body || document.documentElement).appendChild(el);
  _acoSplashStart = Date.now();
  setTimeout(hideSplash, 8000);
}
function hideSplash(){
  if (_acoSplashGone) return; _acoSplashGone = true;
  const el = document.getElementById('splash');
  if (!el) return;
  const restante = Math.max(0, ACO_SPLASH_MIN_MS - (Date.now() - _acoSplashStart));
  setTimeout(() => { el.classList.add('splash-out'); setTimeout(() => el.remove(), 700); }, restante);
}
showSplash();

async function initModulo(requiredRoles = null) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }

  await loadListasCustom();
  try { await loadConfig(); } catch (e) {}

  const { data: modulo } = await sbAdmin
    .from('pastoral_modules').select('id').eq('slug','acolitos').maybeSingle();

  if (!modulo) {
    console.error('Módulo acolitos não encontrado no banco.');
    window.location.href = 'login.html';
    return null;
  }

  const { data: membership } = await sbAdmin
    .from('pastoral_members')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('module_id', modulo.id)
    .maybeSingle();

  // Sem vínculo → cadastro
  if (!membership) {
    if (!window.location.pathname.includes('novos.html')) {
      window.location.href = 'novos.html';
    }
    hideSplash();
    return { user: session.user, membership: null, membro: null };
  }

  // Em onboarding → index
  if (membership.role === 'novo') {
    const isIndex = window.location.pathname.includes('index.html') ||
                    window.location.pathname.endsWith('/acolitos/') ||
                    window.location.pathname.endsWith('/acolitos');
    if (!isIndex) { window.location.href = 'index.html'; return null; }
  }

  // Verificação de role
  if (requiredRoles && !requiredRoles.includes(membership.role)) {
    window.location.href = 'index.html'; return null;
  }

  // Busca ficha do membro (a conta logada)
  const { data: conta } = await sb
    .from('acolitos_membros').select('*').eq('user_id', session.user.id).maybeSingle();

  // Conta de família: só vale para irmãos que são escalados JUNTOS (escalar_com_irmao)
  let membro = conta;
  let grupoIrmaos = [];
  if (conta && conta.grupo_irmaos && conta.escalar_com_irmao) {
    const { data: irmaos } = await sb
      .from('acolitos_membros').select('*').eq('grupo_irmaos', conta.grupo_irmaos).eq('status', 'ativo');
    const juntos = (irmaos || []).filter(m => m.escalar_com_irmao);
    if (juntos.length >= 2) {
      juntos.sort((a, b) => (a.data_nascimento || '9999').localeCompare(b.data_nascimento || '9999'));
      grupoIrmaos = juntos;
      const savedId = localStorage.getItem('acolitos-perfil-' + conta.id);
      const ativo = savedId && grupoIrmaos.find(g => g.id === savedId);
      membro = ativo || conta;
    }
  }

  // etapa atual do CRM do membro — gateia "Complete seu cadastro" (só após aprovado)
  if (membro && membro.id) {
    const { data: _crm } = await sb.from('acolitos_crm')
      .select('etapa').eq('membro_id', membro.id)
      .order('etapa_iniciada_em', { ascending: false }).limit(1).maybeSingle();
    membro._crmEtapa = _crm ? _crm.etapa : null;
  }

  queueNotificacoes(membro);

  hideSplash();
  registrarUltimaTela(); // grava a tela atual p/ o chip "Continuar" da Home (só no caminho de sucesso, após todos os guards)
  return { user: session.user, membership, membro, conta, grupoIrmaos };
}

// Bloco visual do plano de evolução (engajamento), montado a partir do membro
function buildEngajamentoEl(membro) {
  const box = document.createElement('div');
  const slug = membro.nivel || nivelFromRole(membro.role || 'aspirante');
  const h = document.createElement('div'); h.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';
  h.appendChild(buildRankEmblem(slug, 48));
  const hn = document.createElement('div'); hn.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold-light);'; hn.textContent = 'Próximo objetivo: ' + nivelInfo(slug).label;
  h.appendChild(hn); box.appendChild(h);
  const sec = (title) => { const t = document.createElement('div'); t.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.5px;'; t.textContent = title; box.appendChild(t); };
  const chips = (title, vals, map, done) => {
    if (!vals || !vals.length) return; sec(title);
    const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    const css = done
      ? 'font-size:11px;font-weight:700;color:var(--success-text);background:rgba(30,80,30,.18);border:1px solid var(--success);border-radius:12px;padding:3px 10px;'
      : 'font-size:11px;font-weight:700;color:var(--gold);background:rgba(232,185,74,.1);border:1px solid var(--gold-dim);border-radius:12px;padding:3px 10px;';
    vals.forEach(v => { const c = document.createElement('span'); c.style.cssText = css; c.textContent = (done ? '✓ ' : '') + (map[v] || v); w.appendChild(c); });
    box.appendChild(w);
  };
  chips('✨ Virtudes formadas', membro.competencias_desenvolvidas, COMPETENCIA_LABEL, true);
  // Em formação: progresso vindo das quests (assíncrono; degrada se indisponível)
  if (membro && membro.id && typeof sb !== 'undefined') {
    (async () => {
      try {
        const { data } = await sb.rpc('acolitos_competencias_progresso', { p_membro: membro.id });
        const emForm = (data || []).filter(c => c.status === 'em_formacao' || c.status === 'candidata');
        if (!emForm.length) return;
        sec('Em formação');
        const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        emForm.forEach(c => {
          const line = document.createElement('div'); line.style.cssText = 'display:flex;align-items:center;gap:8px;';
          const lab = document.createElement('span'); lab.style.cssText = 'font-size:11px;color:var(--gold);min-width:110px;'; lab.textContent = c.label + (c.status === 'candidata' ? ' 🟡' : '');
          const bwp = document.createElement('div'); bwp.style.cssText = 'flex:1;height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;';
          const bb = document.createElement('div'); const pct = Math.min(100, Math.round(100 * c.progresso / Math.max(1, c.limiar))); bb.style.cssText = 'height:100%;background:var(--gold);width:' + pct + '%;'; bwp.appendChild(bb);
          const n = document.createElement('span'); n.style.cssText = 'font-size:10px;color:var(--text-muted);'; n.textContent = c.progresso + '/' + c.limiar;
          line.append(lab, bwp, n); w.appendChild(line);
        });
        box.appendChild(w);
      } catch (e) {}
    })();
  }
  return box;
}

// Modal "Meu Desenvolvimento" — visão (somente leitura) do plano do membro
function showMeuDesenvolvimento(membro) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '300';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Meu Desenvolvimento';
  const sub = document.createElement('p'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);margin:-8px 0 14px;font-weight:600;';
  sub.textContent = 'Feedback da coordenação sobre sua evolução.';
  modal.append(handle, tt, sub, buildEngajamentoEl(membro));
  const close = document.createElement('button'); close.className = 'btn gold'; close.style.marginTop = '14px'; close.textContent = 'Fechar'; close.onclick = () => ov.remove();
  modal.appendChild(close);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// Elemento de UM aviso (engajamento rico ou texto simples)
function avisoEl(aviso, membro) {
  if (aviso && aviso.tipo === 'engajamento') {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:14px;padding:12px;background:var(--surface);border-radius:6px;border-left:3px solid var(--gold);';
    const t = document.createElement('div'); t.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold);margin-bottom:8px;'; t.textContent = '🎯 Seu plano de evolução foi atualizado';
    wrap.append(t, buildEngajamentoEl(membro)); return wrap;
  }
  if (aviso && aviso.tipo === 'mensagem') {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:14px;padding:12px;background:var(--surface);border-radius:6px;border-left:3px solid var(--gold);';
    const t = document.createElement('div'); t.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold);margin-bottom:8px;'; t.textContent = '💬 Mensagem da coordenação';
    const p = document.createElement('div'); p.style.cssText = 'font-size:14px;color:var(--text);line-height:1.6;'; p.textContent = aviso.texto || aviso.msg || '';
    wrap.append(t, p); return wrap;
  }
  if (aviso && aviso.tipo === 'quest_exclusiva') {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:14px;padding:12px;background:rgba(155,89,212,.1);border-radius:6px;border-left:3px solid #9b59d4;';
    const t = document.createElement('div'); t.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:#cd9ef2;margin-bottom:6px;'; t.textContent = '✨ Quest Exclusiva';
    const p = document.createElement('div'); p.style.cssText = 'font-size:14px;color:var(--text);line-height:1.5;'; p.textContent = aviso.titulo || aviso.msg || '';
    wrap.append(t, p); return wrap;
  }
  const p = document.createElement('div'); p.style.cssText = 'font-size:14px;line-height:1.6;color:var(--text);margin-bottom:12px;padding:12px;background:var(--surface);border-left:3px solid var(--gold);border-radius:4px;';
  p.textContent = (aviso && aviso.msg) ? aviso.msg : String(aviso);
  return p;
}

// ── FILA DE NOTIFICAÇÕES (uma por vez; level-up "Parabéns" tem prioridade) ──
let _notifFila = [];
let _notifRodando = false;
function enqueueNotif(prio, render) { _notifFila.push({ prio, render }); }
function _notifNext() {
  const item = _notifFila.shift();
  if (!item) { _notifRodando = false; return; }
  item.render(() => _notifNext());          // cada pop-up chama done() ao fechar → próximo
}
function _notifStart() {
  if (_notifRodando || !_notifFila.length) return;
  _notifRodando = true;
  _notifFila.sort((a, b) => b.prio - a.prio); // maior prioridade primeiro (sort estável mantém a ordem dos avisos)
  _notifNext();
}

// Coleta o que precisa aparecer ao acessar e enfileira (mostra um de cada vez)
function queueNotificacoes(membro) {
  if (!membro) return;
  // 1) Parabéns de nível — PRIORIDADE MÁXIMA; só na home (onde showLevelUp existe)
  if (typeof window.showLevelUp === 'function') {
    const nivel = membro.nivel || nivelFromRole(membro.role || 'aspirante');
    const seenIdx = membro.nivel_visto ? nivelIndex(membro.nivel_visto) : -1;
    const curIdx = nivelIndex(nivel);
    if (curIdx > -1 && curIdx > seenIdx) {
      membro.nivel_visto = nivel;
      sb.from('acolitos_membros').update({ nivel_visto: nivel }).eq('id', membro.id).then(() => {}, () => {});
      enqueueNotif(100, (done) => window.showLevelUp(nivel, membro.nome || '', done));
    }
  }
  // 2) Cadastro incompleto — pede pra completar (prioridade alta; 1x por sessão de acesso)
  const faltando = camposIncompletos(membro);
  // pendente de aprovação (etapa inicial do CRM) → não pede dados ainda; sem CRM = membro já estabelecido (mostra normal)
  const aguardandoAprovacao = membro._crmEtapa === 'aprovacao_cadastro';
  if (faltando.length && !aguardandoAprovacao && !sessionStorage.getItem('cadastro-prompt-' + membro.id)) {
    sessionStorage.setItem('cadastro-prompt-' + membro.id, '1');
    enqueueNotif(50, (done) => showCompletarCadastroPrompt(membro, faltando, done));
  }
  // 3) Avisos não vistos — cada um no seu pop-up (logout vai por último)
  const avisos = Array.isArray(membro.avisos) ? membro.avisos : [];
  const naoVistos = avisos.filter(a => a && !a.seen);
  if (naoVistos.length) {
    const atualizados = avisos.map(a => ({ ...a, seen: true }));
    membro.avisos = atualizados;
    sb.from('acolitos_membros').update({ avisos: atualizados }).eq('id', membro.id).then(() => {}, () => {});
    const b = document.getElementById('sino-badge'); if (b) b.style.display = 'none';
    const _celebTipos = { xp_ganho: 1, medalha: 1, campeao: 1, estrela_nova: 1, quest_exclusiva: 1 };
    naoVistos.forEach(a => enqueueNotif(a && a.logout ? -10 : (a && _celebTipos[a.tipo] ? 10 : 0), (done) => showAvisoUnico(a, membro, done)));
  }
  _notifStart();
  // 4) Lembrete diário de XP (assíncrono; só se ainda não pontuou hoje)
  _checkXpDiario(membro);
}

// Notificação diária de engajamento: aparece 1x/dia, só na home, e SÓ se o membro
// ainda não ganhou nenhum XP hoje. Convida a fazer uma missão bônus.
async function _checkXpDiario(membro) {
  try {
    if (!membro || typeof window.showLevelUp !== 'function') return;     // só na home
    if (membro._crmEtapa === 'aprovacao_cadastro') return;               // aguardando aprovação: não incomoda
    const hojeKey = new Date().toLocaleDateString('sv');                 // YYYY-MM-DD (data local)
    const lsKey = 'xp-diario-' + membro.id + '-' + hojeKey;
    if (localStorage.getItem(lsKey)) return;                             // já mostrado hoje
    const { data: xpHoje, error } = await sb.rpc('acolitos_xp_hoje', { p_membro: membro.id });
    if (error) return;
    if ((xpHoje || 0) > 0) return;                                       // já pontuou hoje → não cobra
    localStorage.setItem(lsKey, '1');
    enqueueNotif(40, (done) => showXpDiarioPrompt(done));
    _notifStart();
  } catch (e) {}
}

// Pop-up do lembrete diário de XP
function showXpDiarioPrompt(done) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '505';
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Vai ficar sem XP hoje? 👀';
  const p = document.createElement('p'); p.style.cssText = 'font-size:14px;line-height:1.6;color:var(--text);margin:4px 0 14px;';
  p.textContent = 'Você ainda não ganhou XP hoje. Complete uma missão bônus para manter o engajamento e seguir evoluindo na sua jornada!';
  modal.append(handle, tt, p);
  const btn = document.createElement('button'); btn.className = 'btn gold'; btn.style.width = '100%'; btn.textContent = 'Ver missões bônus';
  btn.onclick = () => { ov.remove(); window.location.href = 'missoes.html'; };
  const skip = document.createElement('button'); skip.className = 'btn'; skip.style.cssText = 'width:100%;margin-top:8px;background:transparent;border:none;color:var(--text-muted);box-shadow:none;font-size:13px;';
  skip.textContent = 'Agora não';
  skip.onclick = () => { ov.remove(); if (typeof done === 'function') done(); };
  modal.append(btn, skip);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// Pop-up especial e bonito de Quest Exclusiva
// ── NÚCLEO DE CELEBRAÇÃO REUTILIZÁVEL ──────────────────────────────────────
// Overlay cinematográfico (raios girando, halo, anel de choque, faíscas radiais,
// confete) com cor temática. Usado por estrela, quest exclusiva, medalha e campeão.
// opts: { icon, tag, hero, sub(html-safe via heroStrong/subStrong), theme{--cg...},
//         actions:[{label,primary,onClick(close)}], sound:'star'|'level'|false, autoClose }
function _celebInject() {
  if (typeof _xpgEnsureStyle === 'function') _xpgEnsureStyle(); // garante os keyframes compartilhados
  if (document.getElementById('celeb-style')) return;
  const st = document.createElement('style'); st.id = 'celeb-style';
  st.textContent = `
  .celeb-overlay{position:fixed;inset:0;z-index:9991;display:flex;align-items:center;justify-content:center;padding:22px;background:radial-gradient(circle at 50% 40%,var(--cbg,rgba(120,20,30,.5)),rgba(6,3,5,.9) 62%);backdrop-filter:blur(4px);animation:xpgIn .35s ease both;
    --cg:var(--red-glow);--cg2:var(--gold-light);--cring:rgba(255,217,122,.85);--cspark:var(--gold);--cray:rgba(232,185,74,.18)}
  .celeb-overlay.closing{opacity:0;transition:opacity .3s ease}
  .celeb-card{position:relative;width:100%;max-width:340px;text-align:center;padding:30px 24px 24px;animation:xpgPop .6s cubic-bezier(.18,1.4,.4,1) both}
  .celeb-rays{position:absolute;top:0;left:50%;width:300px;height:300px;transform:translateX(-50%);pointer-events:none;z-index:0;opacity:.6;background:repeating-conic-gradient(from 0deg,transparent 0 8deg,var(--cray) 8deg 16deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 10%,transparent 60%);mask:radial-gradient(circle,#000 10%,transparent 60%);animation:xpgSpin 9s linear infinite}
  .celeb-halo{position:absolute;top:16px;left:50%;width:210px;height:210px;transform:translateX(-50%);pointer-events:none;z-index:0;background:radial-gradient(circle,var(--cg),transparent 62%);animation:xpgHalo 1.7s ease-in-out infinite}
  .celeb-iconwrap{position:relative;z-index:2;width:104px;height:92px;margin:8px auto 0;display:flex;align-items:center;justify-content:center}
  .celeb-icon{position:relative;z-index:2;font-size:76px;line-height:1;text-align:center;filter:drop-shadow(0 0 20px var(--cg2));transform:scale(0) rotate(-40deg);animation:celebIn .9s cubic-bezier(.18,1.6,.4,1) forwards,celebPulse 1.9s ease-in-out 1s infinite}
  @keyframes celebIn{0%{transform:scale(0) rotate(-40deg)}60%{transform:scale(1.25) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
  @keyframes celebPulse{0%,100%{filter:drop-shadow(0 0 16px var(--cg2))}50%{filter:drop-shadow(0 0 30px var(--cg2))}}
  .celeb-ring{position:absolute;top:50%;left:50%;width:20px;height:20px;border-radius:50%;transform:translate(-50%,-50%);z-index:1;box-shadow:0 0 0 0 var(--cring);animation:xpgRing .9s ease-out forwards}
  .celeb-rsparks{position:absolute;top:50%;left:50%;width:0;height:0;z-index:3}
  .celeb-rsparks i{position:absolute;top:0;left:0;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff,var(--cspark) 60%,transparent);transform:translate(-50%,-50%) scale(.3);opacity:0;animation:xpgRspark .95s ease-out forwards}
  .celeb-tag{position:relative;z-index:2;font-family:'Oxanium',sans-serif;font-weight:800;letter-spacing:3px;font-size:15px;color:var(--cg2);margin-top:14px;text-shadow:0 0 14px var(--cg);animation:xpgUp .5s ease .4s both}
  .celeb-hero{position:relative;z-index:2;font-family:'Sora',sans-serif;font-weight:800;font-size:21px;color:#fff;line-height:1.25;margin-top:8px;text-shadow:0 0 16px var(--cg);animation:xpgUp .5s ease .48s both}
  .celeb-sub{position:relative;z-index:2;font-size:13px;color:var(--text);margin-top:8px;line-height:1.5;animation:xpgUp .5s ease .56s both}
  .celeb-sub b{color:var(--cg2)}
  .celeb-actions{position:relative;z-index:2;display:flex;flex-direction:column;gap:9px;margin-top:20px;animation:xpgUp .5s ease .66s both}
  .celeb-btn{font-family:'Oxanium',sans-serif;font-weight:700;letter-spacing:.5px;font-size:13px;padding:12px 20px;border-radius:10px;cursor:pointer;border:1px solid var(--border-wine);background:transparent;color:var(--text-muted)}
  .celeb-btn.primary{border:none;color:#2a1a00;background:linear-gradient(180deg,var(--cg2),var(--cspark));box-shadow:0 4px 20px var(--cg)}
  .celeb-confetti{position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden}
  .celeb-confetti i{position:absolute;top:-10px;width:7px;height:12px;border-radius:1px;opacity:.9;animation:xpgFall linear forwards}`;
  document.head.appendChild(st);
}
function showCeleb(opts) {
  opts = opts || {}; _celebInject();
  if (opts.sound !== false) _celebrate(opts.sound === 'level' ? playLevelUpSound : playStarSound);
  const ov = document.createElement('div'); ov.className = 'celeb-overlay';
  const th = opts.theme || {}; Object.keys(th).forEach(k => ov.style.setProperty(k, th[k]));
  ov.innerHTML =
    '<div class="celeb-card">' +
      '<div class="celeb-rays"></div><div class="celeb-halo"></div><div class="celeb-confetti"></div>' +
      '<div class="celeb-iconwrap"><div class="celeb-ring"></div><div class="celeb-rsparks"></div><div class="celeb-icon"></div></div>' +
      '<div class="celeb-tag"></div><div class="celeb-hero"></div><div class="celeb-sub"></div>' +
      '<div class="celeb-actions"></div>' +
    '</div>';
  document.body.appendChild(ov);
  const card = ov.querySelector('.celeb-card');
  ov.querySelector('.celeb-icon').textContent = opts.icon || '⭐';
  ov.querySelector('.celeb-tag').textContent = opts.tag || '';
  const heroEl = ov.querySelector('.celeb-hero'); if (opts.hero) heroEl.textContent = opts.hero; else heroEl.style.display = 'none';
  const subEl = ov.querySelector('.celeb-sub');
  if (opts.subStrong) { subEl.append(document.createTextNode(opts.subPre || ''), Object.assign(document.createElement('b'), { textContent: opts.subStrong }), document.createTextNode(opts.subPost || '')); }
  else if (opts.sub) subEl.textContent = opts.sub; else subEl.style.display = 'none';
  // faíscas radiais
  const rs = ov.querySelector('.celeb-rsparks');
  for (let i = 0; i < 12; i++) { const ang = (i / 12) * Math.PI * 2, r = 62 + Math.random() * 26; const sp = document.createElement('i'); sp.style.setProperty('--dx', (Math.cos(ang) * r).toFixed(0) + 'px'); sp.style.setProperty('--dy', (Math.sin(ang) * r).toFixed(0) + 'px'); sp.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's'; rs.appendChild(sp); }
  // confete
  const conf = ov.querySelector('.celeb-confetti'); const cores = opts.confetti || ['var(--cspark)', 'var(--cg2)', '#fff', 'var(--red-soft)'];
  for (let i = 0; i < 20; i++) { const c = document.createElement('i'); c.style.cssText = 'left:' + (Math.random() * 100) + '%;background:' + cores[i % cores.length] + ';animation-duration:' + (1.4 + Math.random() * 1).toFixed(2) + 's;animation-delay:' + (Math.random() * 0.5).toFixed(2) + 's;'; conf.appendChild(c); }
  let closed = false;
  const close = () => { if (closed) return; closed = true; clearTimeout(ov._t); ov.classList.add('closing'); setTimeout(() => { ov.remove(); if (typeof opts.done === 'function') opts.done(); }, 300); };
  const acts = ov.querySelector('.celeb-actions');
  (opts.actions && opts.actions.length ? opts.actions : [{ label: 'Continuar' }]).forEach(a => {
    const b = document.createElement('button'); b.className = 'celeb-btn' + (a.primary ? ' primary' : ''); b.textContent = a.label;
    b.onclick = () => { if (a.onClick) a.onClick(close); else close(); };
    acts.appendChild(b);
  });
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  if (opts.autoClose) ov._t = setTimeout(close, opts.autoClose);
  return { close, ov, card };
}
const _TEMA_ROXO = { '--cbg': 'rgba(60,20,90,.58)', '--cg': 'rgba(155,89,212,.55)', '--cg2': '#cd9ef2', '--cring': 'rgba(155,89,212,.85)', '--cspark': '#a86fd6', '--cray': 'rgba(155,89,212,.20)' };

function showQuestExclusivaPop(aviso, done) {
  const titulo = aviso.titulo || String(aviso.msg || '').replace(/^[^:]*:\s*/, '').replace(/[!.].*$/, '') || 'Nova missão';
  showCeleb({
    icon: '✨', tag: 'QUEST EXCLUSIVA', hero: titulo, sub: 'Uma missão especial caiu pra você!',
    theme: _TEMA_ROXO, sound: 'star', done: done,
    actions: [
      { label: '🔥 Bora fazer!', primary: true, onClick: (close) => { close(); if (!location.pathname.endsWith('missoes.html')) location.href = 'missoes.html'; } },
      { label: 'Depois' }
    ]
  });
}

// ── ÁUDIO (arquivos WAV) — toca SOMENTE nas notificações animadas (estrela/level up).
// SEM "prime" silencioso no 1º gesto: aquilo ativava a sessão de áudio do iOS e
// acendia a ilha dinâmica mesmo sem comemoração. Agora a sessão de áudio só é
// ativada quando uma comemoração realmente toca o som. Sons são criados/carregados
// sob demanda (1ª comemoração), nada toca ao abrir telas ou ao tocar na tela.
let _sndStar = null, _sndLevel = null;
function _initSounds() {
  if (_sndStar) return;
  try {
    _sndStar = new Audio('/midia/som-estrela.wav'); _sndStar.preload = 'auto';
    _sndLevel = new Audio('/midia/som-levelup.wav'); _sndLevel.preload = 'auto';
  } catch (e) {}
}
function _playSnd(a) { if (!a) return null; try { a.pause(); a.currentTime = 0; a.muted = false; a.volume = 1; return a.play(); } catch (e) { return null; } }
function playStarSound() { _initSounds(); return _playSnd(_sndStar); }
function playLevelUpSound() { _initSounds(); return _playSnd(_sndLevel); }
// toca o som SÓ na hora do popup da comemoração
function _celebrate(soundFn) {
  try { const p = soundFn(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
}

// Pop-up de NOVA ESTRELA (micro-progressão do nível)
function showStarUp(n, done) {
  showCeleb({
    icon: '⭐', tag: 'NOVA ESTRELA!',
    hero: '⭐'.repeat(Math.min(n, 5)) + (n > 5 ? ' ×' + n : ''),
    subPre: 'Você conquistou sua ', subStrong: n + 'ª estrela', subPost: ' neste nível! Cada uma mostra seu empenho em servir bem. 🌟',
    sound: 'star', done: done,
    actions: [{ label: 'Continuar servindo 🙏', primary: true }]
  });
}
// 🏅 Medalha conquistada (missão com concede_badge aprovada)
function showMedalha(label, done) {
  showCeleb({
    icon: '🏅', tag: 'MEDALHA CONQUISTADA', hero: label || 'Nova insígnia',
    sub: 'Uma nova medalha brilha no seu mural de conquistas!', sound: 'level', done: done,
    actions: [
      { label: '🎖️ Ver no mural', primary: true, onClick: (close) => { close(); if (!location.pathname.endsWith('conquistas.html')) location.href = 'conquistas.html'; } },
      { label: 'Fechar' }
    ]
  });
}
// 🏆 Campeão de temporada (liga)
function showCampeao(liga, temporada, done) {
  const LL = { iniciantes: 'Iniciantes', acolitos: 'Acólitos', cerimoniarios: 'Cerimoniários' };
  showCeleb({
    icon: '🏆', tag: 'CAMPEÃO DA TEMPORADA', hero: 'Liga ' + (LL[liga] || liga || ''),
    subPre: 'Você foi o destaque da temporada ', subStrong: temporada || '', subPost: '! Que servo exemplar. 👏',
    sound: 'level', done: done,
    actions: [
      { label: '🏅 Ver destaques', primary: true, onClick: (close) => { close(); if (!location.pathname.endsWith('destaques.html')) location.href = 'destaques.html'; } },
      { label: 'Fechar' }
    ]
  });
}

// ── ANIMAÇÃO DE GANHO DE XP ────────────────────────────────────────────────
// gain=XP ganho · fromXp=XP que o membro já tinha DENTRO do nível atual (desde
// nivel_desde) · quest=título da missão. Se o ganho cruzar o limiar de estrela
// (200), encadeia a comemoração de NOVA ESTRELA (bem animada).
const XPG_LIMIAR = 200;
function _xpgEnsureStyle() {
  if (document.getElementById('xpg-style')) return;
  const st = document.createElement('style'); st.id = 'xpg-style';
  st.textContent = `
  .xpg-overlay{position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 38%,rgba(120,20,30,.42),rgba(6,3,5,.86) 62%);backdrop-filter:blur(3px);animation:xpgIn .35s ease both}
  .xpg-overlay.closing{opacity:0;transition:opacity .3s ease}
  @keyframes xpgIn{from{opacity:0}to{opacity:1}}
  .xpg-card{position:relative;width:100%;max-width:340px;text-align:center;padding:26px 22px 22px;animation:xpgPop .6s cubic-bezier(.18,1.4,.4,1) both}
  @keyframes xpgPop{0%{transform:scale(.7);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}
  .xpg-rays{position:absolute;top:6px;left:50%;width:280px;height:280px;transform:translateX(-50%);pointer-events:none;z-index:0;opacity:.55;background:repeating-conic-gradient(from 0deg,transparent 0 8deg,rgba(232,185,74,.16) 8deg 16deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 12%,transparent 62%);mask:radial-gradient(circle,#000 12%,transparent 62%);animation:xpgSpin 9s linear infinite}
  @keyframes xpgSpin{to{transform:translateX(-50%) rotate(360deg)}}
  .xpg-halo{position:absolute;top:14px;left:50%;width:200px;height:200px;transform:translateX(-50%);pointer-events:none;z-index:0;background:radial-gradient(circle,var(--red-glow),transparent 62%);animation:xpgHalo 1.7s ease-in-out infinite}
  @keyframes xpgHalo{0%,100%{opacity:.5;transform:translateX(-50%) scale(.92)}50%{opacity:.95;transform:translateX(-50%) scale(1.08)}}
  .xpg-orb{position:relative;z-index:1;width:96px;height:96px;margin:6px auto 0;border-radius:50%;background:radial-gradient(circle at 38% 32%,#fff3d0,var(--gold) 42%,#7a3a12 100%);box-shadow:0 0 0 3px rgba(255,217,122,.65),0 0 34px 6px var(--red-glow),inset 0 -8px 18px rgba(122,40,12,.7);display:flex;align-items:center;justify-content:center;animation:xpgOrb 2.2s ease-in-out infinite;transition:opacity .4s ease,transform .4s ease}
  @keyframes xpgOrb{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
  .xpg-orb.gone{opacity:0;transform:scale(.4)}
  .xpg-orb span{font-family:'Oxanium',sans-serif;font-size:46px;font-weight:800;color:#3a2102;text-shadow:0 1px 0 rgba(255,255,255,.5);line-height:1}
  .xpg-tag{position:relative;z-index:1;font-family:'Oxanium',sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;color:var(--gold-light);margin-top:16px;animation:xpgUp .5s ease .25s both}
  .xpg-num{position:relative;z-index:1;font-family:'Oxanium',sans-serif;font-weight:800;font-size:62px;line-height:1;margin-top:2px;color:var(--gold-light);text-shadow:0 0 18px var(--red-glow),0 2px 0 #7a3a12;animation:xpgUp .5s ease .3s both}
  .xpg-num b{font-size:34px;vertical-align:super;opacity:.9}
  .xpg-num small{font-family:'Oxanium',sans-serif;font-size:22px;font-weight:700;letter-spacing:2px;margin-left:6px;color:var(--gold)}
  .xpg-num.punch{animation:xpgPunch .26s ease}
  @keyframes xpgPunch{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}
  .xpg-quest{position:relative;z-index:1;font-size:13px;font-weight:600;color:var(--text);margin-top:8px;animation:xpgUp .5s ease .4s both}
  .xpg-quest b{color:var(--gold-light)}
  .xpg-barwrap{position:relative;z-index:1;margin-top:16px;animation:xpgUp .5s ease .5s both}
  .xpg-bar{position:relative;height:13px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid var(--border-wine);overflow:hidden}
  .xpg-fill{position:absolute;inset:0 auto 0 0;width:0%;border-radius:8px;background:linear-gradient(90deg,#b8341f,var(--gold) 70%,var(--gold-light));box-shadow:0 0 12px var(--red-glow);transition:width 1.1s cubic-bezier(.25,.9,.3,1)}
  .xpg-fill::after{content:'';position:absolute;inset:0;border-radius:8px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);transform:translateX(-100%);animation:xpgShine 1.3s ease .4s infinite}
  @keyframes xpgShine{to{transform:translateX(220%)}}
  .xpg-bar.flash{animation:xpgFlash .5s ease}
  @keyframes xpgFlash{0%,100%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 18px 4px var(--gold-light)}}
  .xpg-hint{font-family:'Oxanium',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--gold-light);margin-top:7px;text-shadow:0 0 8px var(--red-glow)}
  .xpg-btn{position:relative;z-index:1;margin-top:18px;font-family:'Oxanium',sans-serif;font-weight:700;letter-spacing:.5px;font-size:13px;padding:11px 26px;border-radius:10px;cursor:pointer;border:1px solid var(--border-wine);background:transparent;color:var(--text-muted);animation:xpgUp .5s ease .7s both}
  @keyframes xpgUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .xpg-sparks{position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden}
  .xpg-sparks i{position:absolute;bottom:30%;width:7px;height:7px;border-radius:50%;opacity:0;background:radial-gradient(circle,#fff,var(--gold) 60%,transparent);animation:xpgSpark 1.4s ease-out forwards}
  @keyframes xpgSpark{0%{opacity:0;transform:translateY(0) scale(.4)}15%{opacity:1}100%{opacity:0;transform:translateY(-150px) scale(1)}}
  /* ── estrela super animada ── */
  .xpg-starzone{position:absolute;top:6px;left:0;right:0;height:120px;z-index:3;pointer-events:none}
  .xpg-srays{position:absolute;top:-12px;left:50%;width:260px;height:260px;transform:translateX(-50%);background:repeating-conic-gradient(from 0deg,transparent 0 9deg,rgba(255,217,122,.30) 9deg 18deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 6%,transparent 56%);mask:radial-gradient(circle,#000 6%,transparent 56%);animation:xpgSpin2 5s linear infinite;opacity:0;animation-fill-mode:both}
  @keyframes xpgSpin2{to{transform:translateX(-50%) rotate(360deg)}}
  .xpg-sring{position:absolute;top:54px;left:50%;width:20px;height:20px;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 0 rgba(255,217,122,.85);animation:xpgRing .85s ease-out forwards}
  @keyframes xpgRing{0%{box-shadow:0 0 0 0 rgba(255,217,122,.85)}100%{box-shadow:0 0 0 110px rgba(255,217,122,0)}}
  .xpg-bigstar{position:absolute;top:54px;left:50%;font-size:82px;line-height:1;transform:translate(-50%,-50%) scale(0) rotate(-45deg);filter:drop-shadow(0 0 20px var(--gold-light));animation:xpgStarIn .9s cubic-bezier(.18,1.6,.4,1) forwards,xpgStarPulse 1.8s ease-in-out 1s infinite}
  @keyframes xpgStarIn{0%{transform:translate(-50%,-50%) scale(0) rotate(-45deg)}60%{transform:translate(-50%,-50%) scale(1.3) rotate(10deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0)}}
  @keyframes xpgStarPulse{0%,100%{filter:drop-shadow(0 0 16px var(--gold-light))}50%{filter:drop-shadow(0 0 30px var(--gold-light))}}
  .xpg-rspark{position:absolute;top:54px;left:50%;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff,var(--gold) 60%,transparent);transform:translate(-50%,-50%) scale(.3);opacity:0;animation:xpgRspark .95s ease-out forwards}
  @keyframes xpgRspark{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1)}}
  .xpg-starlbl{position:absolute;top:104px;left:0;right:0;font-family:'Oxanium',sans-serif;font-weight:800;letter-spacing:2px;font-size:15px;color:var(--gold-light);text-shadow:0 0 14px var(--gold-light);opacity:0;animation:xpgUp .5s ease .5s both}
  .xpg-confetti{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
  .xpg-confetti i{position:absolute;top:-10px;width:7px;height:12px;border-radius:1px;opacity:.9;animation:xpgFall linear forwards}
  @keyframes xpgFall{to{transform:translateY(420px) rotate(540deg)}}
  `;
  document.head.appendChild(st);
}
function showXpGain(gain, fromXp, quest, done) {
  _xpgEnsureStyle();
  _celebrate(playStarSound);
  gain = Number(gain) || 0; fromXp = Number(fromXp) || 0;
  const toXp = fromXp + gain;
  const crossesStar = Math.floor(toXp / XPG_LIMIAR) > Math.floor(fromXp / XPG_LIMIAR);
  const novaEstrela = Math.floor(toXp / XPG_LIMIAR);

  const ov = document.createElement('div'); ov.className = 'xpg-overlay';
  ov.innerHTML =
    '<div class="xpg-card">' +
      '<div class="xpg-rays"></div><div class="xpg-halo"></div>' +
      '<div class="xpg-sparks"></div><div class="xpg-confetti"></div>' +
      '<div class="xpg-orb"><span>✦</span></div>' +
      '<div class="xpg-tag">XP CONQUISTADO</div>' +
      '<div class="xpg-num"><b>+</b><span class="xpg-val">0</span><small>XP</small></div>' +
      '<div class="xpg-quest">Missão: <b class="xpg-qname"></b></div>' +
      '<div class="xpg-barwrap"><div class="xpg-bar"><div class="xpg-fill"></div></div><div class="xpg-hint"></div></div>' +
      '<button class="xpg-btn">Continuar 🙏</button>' +
    '</div>';
  document.body.appendChild(ov);
  ov.querySelector('.xpg-qname').textContent = quest || 'concluída'; // textContent: à prova de XSS (título vem do banco)

  const card = ov.querySelector('.xpg-card');
  const numEl = ov.querySelector('.xpg-num'), valEl = ov.querySelector('.xpg-val');
  const fill = ov.querySelector('.xpg-fill'), bar = ov.querySelector('.xpg-bar');
  const hint = ov.querySelector('.xpg-hint'), sparks = ov.querySelector('.xpg-sparks');
  const btn = ov.querySelector('.xpg-btn');

  for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.style.left = (8 + Math.random() * 84) + '%'; s.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's'; sparks.appendChild(s); }

  const startPct = (fromXp % XPG_LIMIAR) / XPG_LIMIAR * 100;
  fill.style.transition = 'none'; fill.style.width = startPct + '%'; void fill.offsetWidth; fill.style.transition = '';

  const t0 = performance.now(), DUR = 1000; let lastPunch = 0;
  function tick(now) {
    const t = Math.min(1, (now - t0) / DUR);
    const v = Math.round((1 - Math.pow(1 - t, 3)) * gain);
    valEl.textContent = v;
    if (v >= lastPunch + Math.max(1, Math.round(gain / 8))) { lastPunch = v; numEl.classList.remove('punch'); void numEl.offsetWidth; numEl.classList.add('punch'); }
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  setTimeout(() => {
    if (crossesStar) {
      fill.style.width = '100%';
      setTimeout(() => { _celebrate(playStarSound); bar.classList.add('flash'); _xpgStarShow(card, novaEstrela); }, 700);
      setTimeout(() => { fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = ''; fill.style.width = ((toXp % XPG_LIMIAR) / XPG_LIMIAR * 100) + '%'; }, 1100);
      hint.textContent = 'faltam ' + (XPG_LIMIAR - (toXp % XPG_LIMIAR)) + ' XP pra próxima ⭐';
    } else {
      fill.style.width = ((toXp % XPG_LIMIAR) / XPG_LIMIAR * 100) + '%';
      hint.textContent = 'faltam ' + (XPG_LIMIAR - (toXp % XPG_LIMIAR)) + ' XP pra próxima ⭐';
    }
  }, 450);

  let closed = false;
  const close = () => { if (closed) return; closed = true; clearTimeout(ov._timer); ov.classList.add('closing'); setTimeout(() => { ov.remove(); if (typeof done === 'function') done(); }, 300); };
  btn.onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov._timer = setTimeout(close, crossesStar ? 5600 : 4200);
}
// Comemoração de estrela dentro da animação de XP (raios, anel, faíscas radiais, confete)
function _xpgStarShow(card, n) {
  const orb = card.querySelector('.xpg-orb'); if (orb) orb.classList.add('gone');
  const zone = document.createElement('div'); zone.className = 'xpg-starzone';
  const rays = document.createElement('div'); rays.className = 'xpg-srays';
  const ring = document.createElement('div'); ring.className = 'xpg-sring';
  const star = document.createElement('div'); star.className = 'xpg-bigstar'; star.textContent = '⭐';
  const lbl = document.createElement('div'); lbl.className = 'xpg-starlbl'; lbl.textContent = 'NOVA ESTRELA!' + (n > 1 ? ' (' + n + 'ª)' : '');
  zone.append(rays, ring, star, lbl);
  // faíscas radiais
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2, r = 60 + Math.random() * 26;
    const sp = document.createElement('div'); sp.className = 'xpg-rspark';
    sp.style.setProperty('--dx', (Math.cos(ang) * r).toFixed(0) + 'px');
    sp.style.setProperty('--dy', (Math.sin(ang) * r).toFixed(0) + 'px');
    sp.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
    zone.appendChild(sp);
  }
  card.appendChild(zone);
  requestAnimationFrame(() => { rays.style.animationName = 'xpgSpin2'; rays.style.opacity = '.9'; });
  // confete
  const conf = card.querySelector('.xpg-confetti');
  if (conf) { const cores = ['var(--red-soft)', 'var(--gold)', 'var(--gold-light)', '#fff']; for (let i = 0; i < 18; i++) { const c = document.createElement('i'); c.style.cssText = 'left:' + (Math.random() * 100) + '%;background:' + cores[i % 4] + ';animation-duration:' + (1 + Math.random() * 0.8).toFixed(2) + 's;animation-delay:' + (Math.random() * 0.3).toFixed(2) + 's;'; conf.appendChild(c); } }
}

// Mostra UM aviso isolado; done() avança a fila (logout encerra a sessão)
function showAvisoUnico(aviso, membro, done) {
  if (aviso && aviso.tipo === 'quest_exclusiva') { showQuestExclusivaPop(aviso, done); return; }
  if (aviso && aviso.tipo === 'estrela_nova') { showStarUp(Number(aviso.n) || 1, done); return; }
  if (aviso && aviso.tipo === 'xp_ganho') { showXpGain(Number(aviso.gain) || 0, Number(aviso.from_xp) || 0, aviso.titulo || '', done); return; }
  if (aviso && aviso.tipo === 'medalha') { showMedalha(aviso.label || '', done); return; }
  if (aviso && aviso.tipo === 'campeao') { showCampeao(aviso.liga, aviso.temporada, done); return; }
  if (aviso && aviso.tipo === 'levelup_demo') { if (typeof window.showLevelUp === 'function') window.showLevelUp(aviso.nivel, aviso.nome || '', done); else if (typeof done === 'function') done(); return; }
  const precisaLogout = !!(aviso && aviso.logout);
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '500';
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Aviso da Coordenação';
  modal.append(handle, tt, avisoEl(aviso, membro));
  const btn = document.createElement('button'); btn.className = 'btn gold'; btn.style.marginTop = '8px';
  btn.textContent = precisaLogout ? 'Entendi — sair e entrar de novo' : 'Entendi';
  btn.onclick = async () => {
    if (precisaLogout) { try { await sb.auth.signOut(); } catch (e) {} window.location.href = 'login.html'; return; }
    ov.remove(); if (typeof done === 'function') done();
  };
  modal.appendChild(btn);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// ── CADASTRO INCOMPLETO (o membro precisa completar os próprios dados) ──
// TODOS os campos que PODEM ser exigidos no "Complete seu cadastro" (padrao = exigido por padrão).
// O superadmin liga/desliga cada um no Config → Campos do cadastro (chave cadastro_campos).
const CAMPOS_OBRIGATORIOS = [
  { key:'data_nascimento', label:'Data de nascimento', tipo:'date', padrao:true },
  { key:'telefone', label:'Telefone (use obrigatoriamente um número com WhatsApp)', tipo:'tel', padrao:true },
  { key:'telefone_whatsapp', label:'Esse número é WhatsApp? (obrigatoriamente use um telefone com WhatsApp)', tipo:'bool', padrao:true },
  { key:'comunidade', label:'Comunidade que frequenta', tipo:'select', opcoes:[['matriz','Matriz'],['santo_antonio','Santo Antônio'],['outra','Outra']], padrao:true },
  { key:'endereco', label:'Endereço', tipo:'text', padrao:true },
  { key:'celular_recado', label:'Telefone de recado (responsável/familiar)', tipo:'tel', padrao:true },
  { key:'responsavel', label:'Nome do responsável', tipo:'text', padrao:false },
  { key:'celular_mae', label:'Telefone da mãe', tipo:'tel', padrao:false },
  { key:'pode_outras_comunidades', label:'Pode servir em outras comunidades?', tipo:'bool', padrao:false },
  { key:'necessidades_especiais', label:'Necessidades especiais (TEA, TDAH, limitações…)', tipo:'text', padrao:false },
  { key:'batismo', label:'É batizado(a)?', tipo:'bool', padrao:true },
  { key:'primeira_eucaristia', label:'Fez a 1ª Eucaristia?', tipo:'bool', padrao:true },
  { key:'crisma', label:'É crismado(a)?', tipo:'bool', padrao:true },
  { key:'tem_tunica', label:'Possui túnica própria?', tipo:'bool', padrao:true },
  { key:'no_grupo_whatsapp', label:'Está no grupo do WhatsApp da pastoral?', tipo:'bool', padrao:true },
];
// idade em anos completos a partir de hoje; null se sem data válida
function idadeAnos(dataNasc) {
  if (!dataNasc) return null;
  const d = new Date(dataNasc); if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let a = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
  return a;
}
// um campo é exigido se o Config disser; sem config, usa o `padrao` do campo
function campoExigido(key, padrao) {
  const cc = (typeof cfg === 'function') ? cfg('cadastro_campos', null) : null;
  return (cc && (key in cc)) ? cc[key] !== false : padrao;
}
function camposIncompletos(membro) {
  const faltam = CAMPOS_OBRIGATORIOS.filter(c => {
    if (!campoExigido(c.key, !!c.padrao)) return false;
    if (c.key === 'telefone' && !(idadeAnos(membro.data_nascimento) > 12)) return false; // celular só obrigatório p/ 13+
    const v = membro[c.key];
    if (c.tipo === 'bool') return v === null || v === undefined;       // bool: precisa responder sim/não
    return v === null || v === undefined || String(v).trim() === '';    // texto/data/select: não pode vazio
  });
  if (campoExigido('foto', true) && !membro.foto_url) faltam.push({ key:'foto_url', label:'Foto de perfil', tipo:'foto' });
  return faltam;
}

// Pop-up inicial avisando que faltam dados (com botão Preencher)
function showCompletarCadastroPrompt(membro, faltando, done) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '505';
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Complete seu cadastro';
  const p = document.createElement('p'); p.style.cssText = 'font-size:14px;line-height:1.6;color:var(--text);margin:4px 0 6px;';
  p.textContent = 'Você possui informações incompletas. Preencha agora para que a coordenação possa te escalar e entrar em contato corretamente.';
  const sub = document.createElement('div'); sub.style.cssText = 'font-size:12px;color:var(--gold);font-weight:700;margin-bottom:12px;';
  sub.textContent = faltando.length + (faltando.length === 1 ? ' campo pendente' : ' campos pendentes');
  modal.append(handle, tt, p, sub);
  const btn = document.createElement('button'); btn.className = 'btn gold'; btn.style.width = '100%'; btn.textContent = 'Preencher agora';
  btn.onclick = () => { ov.remove(); showCompletarCadastroForm(membro, done); };
  const skip = document.createElement('button'); skip.className = 'btn'; skip.style.cssText = 'width:100%;margin-top:8px;background:transparent;border:none;color:var(--text-muted);box-shadow:none;font-size:13px;';
  skip.textContent = 'Agora não';
  skip.onclick = () => { ov.remove(); if (typeof done === 'function') done(); };
  modal.append(btn, skip);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// Formulário com todos os campos obrigatórios; salva e atualiza o registro do membro
function showCompletarCadastroForm(membro, done) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '510';
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Complete seu cadastro';
  const sub = document.createElement('p'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);margin:-8px 0 14px;font-weight:600;';
  sub.textContent = 'Confira e preencha os dados abaixo. Leva um minutinho.';
  modal.append(handle, tt, sub);

  // Foto de perfil — só aparece se for exigida (salva na hora; não trava o "Salvar", mas o lembrete volta até ter)
  if (campoExigido('foto', true)) {
    const fotoWrap = document.createElement('div'); fotoWrap.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:14px;padding:10px;background:var(--surface);border:1px solid var(--border-wine);border-radius:10px;';
    const fotoTxt = document.createElement('div'); fotoTxt.style.flex = '1';
    const fotoLab = document.createElement('div'); fotoLab.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;'; fotoLab.textContent = 'Foto de perfil';
    const fotoHint = document.createElement('div'); fotoHint.style.cssText = 'font-size:12px;color:var(--gold);margin-top:3px;'; fotoHint.textContent = membro.foto_url ? 'Toque na foto para trocar.' : 'Toque na foto para adicionar.';
    const av = buildAvatarEl(membro.foto_url, nivelInfo(membro.nivel || 'aspirante').base, 64, {
      editable: true, membro: membro, nivelSlug: membro.nivel || 'aspirante',
      onUpload: (url) => { membro.foto_url = url; fotoHint.textContent = '✓ Foto adicionada!'; fotoHint.style.color = 'var(--success-text)'; }
    });
    fotoTxt.append(fotoLab, fotoHint); fotoWrap.append(av, fotoTxt); modal.appendChild(fotoWrap);
  }

  const campos = [];
  CAMPOS_OBRIGATORIOS.filter(def => campoExigido(def.key, !!def.padrao)).forEach(def => {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:12px;';
    const lab = document.createElement('label'); lab.style.cssText = 'display:block;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;';
    lab.textContent = def.label; wrap.appendChild(lab);
    let getValue, isValid, markErr;
    if (def.tipo === 'bool') {
      let estado = membro[def.key] === true ? 'sim' : (membro[def.key] === false ? 'nao' : null);
      const seg = document.createElement('div'); seg.style.cssText = 'display:flex;gap:8px;';
      const mk = (val, txt) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
        const paint = () => { b.style.cssText = 'flex:1;padding:10px;border-radius:9px;font-family:Sora,sans-serif;font-weight:700;font-size:13px;cursor:pointer;border:1px solid ' + (estado === val ? 'var(--gold)' : 'var(--border-wine)') + ';background:' + (estado === val ? 'linear-gradient(165deg,rgba(232,185,74,.2),var(--surface2))' : 'var(--surface2)') + ';color:' + (estado === val ? 'var(--gold-light)' : 'var(--text)') + ';'; };
        paint(); b.onclick = () => { estado = val; seg.querySelectorAll('button').forEach(x => x._paint && x._paint()); wrap.style.outline = 'none'; };
        b._paint = paint; return b;
      };
      seg.append(mk('sim', 'Sim'), mk('nao', 'Não')); wrap.appendChild(seg);
      getValue = () => estado === 'sim' ? true : (estado === 'nao' ? false : null);
      isValid = () => estado !== null;
      markErr = () => { wrap.style.outline = '1px solid var(--danger,#c0392b)'; wrap.style.outlineOffset = '3px'; wrap.style.borderRadius = '8px'; };
    } else if (def.tipo === 'select') {
      const sel = document.createElement('select'); sel.className = 'form-input';
      (def.opcoes || []).forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((membro[def.key] || '') === v) o.selected = true; sel.appendChild(o); });
      if (!membro[def.key]) { const o = document.createElement('option'); o.value = ''; o.textContent = '— selecione —'; o.selected = true; sel.insertBefore(o, sel.firstChild); }
      wrap.appendChild(sel);
      getValue = () => sel.value; isValid = () => !!sel.value;
      markErr = () => { sel.style.borderColor = 'var(--danger,#c0392b)'; };
    } else {
      const inp = document.createElement('input'); inp.className = 'form-input';
      inp.type = def.tipo === 'date' ? 'date' : 'text';
      inp.value = membro[def.key] || '';
      if (def.tipo === 'tel') { inp.placeholder = '(00) 00000-0000'; attachTelMask(inp); }
      wrap.appendChild(inp);
      getValue = () => inp.value.trim(); isValid = () => inp.value.trim() !== '';
      markErr = () => { inp.style.borderColor = 'var(--danger,#c0392b)'; };
    }
    campos.push({ def, getValue, isValid, markErr });
    modal.appendChild(wrap);
  });

  const msg = document.createElement('div'); msg.style.cssText = 'font-size:12px;color:var(--danger,#e07a6a);min-height:16px;margin:2px 0 8px;';
  modal.appendChild(msg);
  const save = document.createElement('button'); save.className = 'btn gold'; save.style.width = '100%'; save.textContent = 'Salvar e atualizar';
  save.onclick = async () => {
    const faltam = campos.filter(c => !c.isValid());
    if (faltam.length) { faltam.forEach(c => c.markErr()); msg.textContent = 'Preencha todos os campos destacados.'; return; }
    save.disabled = true; save.textContent = 'Salvando...'; msg.textContent = '';
    const patch = {}; campos.forEach(c => { patch[c.def.key] = c.getValue(); });
    const { error } = await sb.from('acolitos_membros').update(patch).eq('id', membro.id);
    if (error) { msg.textContent = 'Erro ao salvar. Tente de novo.'; save.disabled = false; save.textContent = 'Salvar e atualizar'; return; }
    Object.assign(membro, patch);
    toast('✓ Cadastro atualizado!');
    ov.remove(); if (typeof done === 'function') done();
  };
  const fechar = document.createElement('button'); fechar.className = 'btn'; fechar.style.cssText = 'width:100%;margin-top:8px;background:transparent;border:none;color:var(--text-muted);box-shadow:none;font-size:13px;';
  fechar.textContent = 'Depois';
  fechar.onclick = () => { ov.remove(); if (typeof done === 'function') done(); };
  modal.append(save, fechar);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// Painel do sino: histórico de todas as notificações
async function openNotificacoes(membro) {
  const avisos = Array.isArray(membro.avisos) ? membro.avisos : [];
  if (avisos.some(a => a && !a.seen)) {
    const atualizados = avisos.map(a => ({ ...a, seen: true }));
    try { await sb.from('acolitos_membros').update({ avisos: atualizados }).eq('id', membro.id); } catch (e) {}
    membro.avisos = atualizados;
    const b = document.getElementById('sino-badge'); if (b) b.style.display = 'none';
  }
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.style.zIndex = '500';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Notificações';
  modal.append(handle, tt);
  if (!avisos.length) { const e = document.createElement('div'); e.style.cssText = 'font-size:13px;color:var(--text-muted);font-style:italic;'; e.textContent = 'Nenhuma notificação ainda.'; modal.appendChild(e); }
  else { avisos.slice().reverse().forEach(a => modal.appendChild(avisoEl(a, membro))); }
  const acts = document.createElement('div'); acts.style.cssText = 'display:flex;gap:10px;margin-top:10px;';
  if (avisos.length) {
    const limpar = document.createElement('button'); limpar.className = 'btn-sm gray'; limpar.style.flex = '1'; limpar.textContent = 'Limpar tudo';
    limpar.onclick = async () => { try { await sb.from('acolitos_membros').update({ avisos: [] }).eq('id', membro.id); } catch (e) {} membro.avisos = []; ov.remove(); };
    acts.appendChild(limpar);
  }
  const close = document.createElement('button'); close.className = 'btn gold'; close.style.flex = '1'; close.textContent = 'Fechar'; close.onclick = () => ov.remove();
  acts.appendChild(close);
  modal.appendChild(acts);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(theme, save) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('jcbp-theme', theme);
}

// ── HEADER ────────────────────────────────────────────────────
function renderHeader(ctx, activePage) {
  const el = document.getElementById('app-header');
  if (!el) return;
  const theme = 'dark'; // tema claro removido — somente escuro
  localStorage.setItem('jcbp-theme', 'dark');
  applyTheme('dark', false);
  el.className = 'app-header';
  el.textContent = '';

  // Logo
  const logo = document.createElement('a');
  logo.className = 'header-logo';
  logo.href = 'index.html';
  const logoImg = document.createElement('img');
  logoImg.src = theme === 'dark'
    ? '../../midia/logos/Logo%20Igreja%20branco.png'
    : '../../midia/logos/Logo%20Igreja%20colorido.png';
  logoImg.alt = 'JCBP';
  logoImg.id = 'header-logo-img';
  const logoText = document.createElement('span');
  logoText.textContent = 'Acólitos ';
  const goldSpan = document.createElement('span');
  goldSpan.className = 'gold';
  goldSpan.textContent = '&';
  const logoText2 = document.createElement('span');
  logoText2.textContent = ' Coroinhas';
  logo.append(logoImg, logoText, goldSpan, logoText2);

  // Grupo esquerdo: botão Voltar (telas internas) + logo
  const left = document.createElement('div'); left.className = 'header-left';
  if (activePage && activePage !== 'home') {
    const back = document.createElement('button');
    back.className = 'btn-icon header-back';
    back.title = 'Voltar';
    back.textContent = '‹';
    back.onclick = () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = 'index.html';
    };
    left.appendChild(back);
  }
  left.appendChild(logo);
  el.appendChild(left);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'header-actions';

  // Seletor de irmãos (conta de família)
  const fc = familyChip(ctx);
  if (fc) actions.appendChild(fc);

  const sairBtn = document.createElement('button');
  sairBtn.className = 'btn-icon';
  sairBtn.title = 'Sair';
  sairBtn.textContent = '⏻';
  sairBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  };

  const contaBtn = document.createElement('button');
  contaBtn.className = 'btn-icon';
  contaBtn.title = 'Minha conta';
  contaBtn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>'; // ícone hardcoded — seguro
  contaBtn.onclick = () => openContaModal(ctx);

  // Sino de notificações (membros) — pop-up ao acessar + histórico aqui
  if (ctx && ctx.membro) {
    const sino = document.createElement('button'); sino.className = 'btn-icon'; sino.title = 'Notificações'; sino.style.position = 'relative';
    sino.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'; // ícone hardcoded — seguro
    const naoVistos = (ctx.membro.avisos || []).filter(a => a && !a.seen).length;
    const badge = document.createElement('span'); badge.id = 'sino-badge';
    badge.style.cssText = 'position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;border-radius:8px;background:var(--red-soft);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 3px;' + (naoVistos ? '' : 'display:none;');
    badge.textContent = naoVistos > 9 ? '9+' : String(naoVistos);
    sino.appendChild(badge);
    sino.onclick = () => openNotificacoes(ctx.membro);
    actions.appendChild(sino);
  }

  actions.append(contaBtn, sairBtn);
  el.appendChild(actions);

  renderModeSwitch(ctx); // barra de alternância Jornada/Coordenação (se aplicável)
}

// ── CONTA DE FAMÍLIA (irmãos no mesmo login) ──────────────────────
function setPerfilAtivo(contaId, perfilId) {
  localStorage.setItem('acolitos-perfil-' + contaId, perfilId);
  window.location.reload();
}
function familyChip(ctx) {
  if (!ctx || !ctx.conta || !ctx.grupoIrmaos || ctx.grupoIrmaos.length < 2) return null;
  const a = ctx.membro || ctx.conta;
  const roleBase = nivelInfo(a.nivel || 'aspirante').base;
  const chip = document.createElement('button'); chip.className = 'family-chip'; chip.title = 'Trocar de irmão';
  const av = buildAvatarEl(a.foto_url, roleBase, 22, { nivelSlug: a.nivel || 'aspirante' }); av.style.flex = 'none';
  const nm = document.createElement('span'); nm.className = 'fc-nome'; nm.textContent = a.apelido || (a.nome || '').split(' ')[0];
  const car = document.createElement('span'); car.textContent = '▾'; car.style.opacity = '.7';
  chip.append(av, nm, car);
  chip.onclick = () => openFamilyPicker(ctx);
  return chip;
}
function openFamilyPicker(ctx) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay open';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const modal = document.createElement('div'); modal.className = 'modal'; modal.style.maxWidth = '360px';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Quem você vai administrar?';
  const sub = document.createElement('p'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);margin:-6px 0 14px;';
  sub.textContent = 'Tudo (jornada, faltas, avisos) passa a refletir o irmão escolhido.';
  modal.append(handle, tt, sub);
  ctx.grupoIrmaos.forEach(m => {
    const ativo = m.id === (ctx.membro ? ctx.membro.id : ctx.conta.id);
    const row = document.createElement('button'); row.className = 'fam-row' + (ativo ? ' ativo' : '');
    const av = buildAvatarEl(m.foto_url, nivelInfo(m.nivel || 'aspirante').base, 38, { nivelSlug: m.nivel || 'aspirante' }); av.style.flex = 'none';
    const info = document.createElement('div'); info.style.cssText = 'flex:1;text-align:left;min-width:0;';
    const n = document.createElement('div'); n.style.cssText = 'font-weight:700;font-size:14px;color:var(--text);'; n.textContent = m.apelido || m.nome;
    const s = document.createElement('div'); s.style.cssText = 'font-size:11px;color:var(--text-muted);'; s.textContent = nivelInfo(m.nivel || 'aspirante').label + (m.id === ctx.conta.id ? ' · sua conta' : '');
    info.append(n, s); row.append(av, info);
    if (ativo) { const c = document.createElement('span'); c.textContent = '✓'; c.style.cssText = 'color:var(--gold);font-weight:800;'; row.appendChild(c); }
    row.onclick = () => setPerfilAtivo(ctx.conta.id, m.id);
    modal.appendChild(row);
  });
  const close = document.createElement('button'); close.className = 'btn-sm gray'; close.style.marginTop = '12px'; close.textContent = 'Fechar'; close.onclick = () => ov.remove();
  modal.appendChild(close);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// ── MINHA CONTA (autosserviço: trocar próprio usuário/senha/nome) ──
// Garante um access_token válido (renova se vencido/perto de vencer)
async function freshToken() {
  let { data: { session } } = await sb.auth.getSession();
  if (!session) return '';
  const expMs = (session.expires_at || 0) * 1000;
  if (expMs - Date.now() < 60000) { // expira em menos de 60s → renova
    try { const r = await sb.auth.refreshSession(); if (r.data && r.data.session) session = r.data.session; } catch (e) {}
  }
  return session.access_token || '';
}
// POST autenticado com retry em 401 (token expirado → refresh → tenta de novo)
async function apiPost(path, body) {
  const call = (t) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify(body) });
  let r = await call(await freshToken());
  if (r.status === 401) {
    try { await sb.auth.refreshSession(); } catch (e) {}
    r = await call(await freshToken());
  }
  let data = {}; try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

// ── NOTIFICAÇÕES PUSH (🔔) ──
const VAPID_PUBLIC_KEY = 'BBoIEtOv8hVobFiYDSU4Xu5kbdwOdEtvWU95cFoGN5k41e_V4fHRAE6zOIO3MV-du7L7ix0qJJzbSPgMZKtVIaQ';
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function notifStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'nao-suportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
async function ativarNotificacoes(btn) {
  try {
    if (notifStatus() === 'nao-suportado') { toast('Seu navegador não suporta notificações.', 'error'); return; }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS && navigator.standalone !== true) {
      uiAlert('Para receber notificações no iPhone: toque em Compartilhar → "Adicionar à Tela de Início" e abra o app por lá. Depois volte aqui e ative.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permissão negada. Ative nas configurações do navegador.', 'error'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb.from('acolitos_push_subs').upsert({
      user_id: ctx.user.id, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent,
    }, { onConflict: 'endpoint' });
    if (error) { toast('Erro ao salvar a inscrição.', 'error'); return; }
    if (typeof desbloquearSomNotif === 'function') desbloquearSomNotif(); // gesto do usuário → libera o áudio (iOS)
    toast('Notificações ativadas! 🔔', 'success');
    if (btn) pintarBotaoNotif(btn, true);
  } catch (e) { toast('Não foi possível ativar as notificações.', 'error'); }
}
async function desativarNotificacoes(btn) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('acolitos_push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    toast('Notificações desativadas.');
    if (btn) pintarBotaoNotif(btn, false);
  } catch (e) { toast('Erro ao desativar.', 'error'); }
}
function pintarBotaoNotif(btn, ativo) {
  btn.textContent = ativo ? '🔔 Notificações ativadas ✓' : '🔔 Ativar notificações';
  btn.onclick = () => (ativo ? desativarNotificacoes(btn) : ativarNotificacoes(btn));
}
async function renderBotaoNotificacoes(container) {
  if (!container) return;
  const btn = document.createElement('button');
  btn.className = 'btn-sm gray'; btn.style.width = '100%'; btn.style.marginTop = '8px';
  let ativo = false;
  try { const reg = await navigator.serviceWorker.ready; ativo = !!(await reg.pushManager.getSubscription()); } catch (_) {}
  if (notifStatus() === 'nao-suportado') { btn.disabled = true; btn.textContent = '🔔 Notificações não suportadas'; }
  else pintarBotaoNotif(btn, ativo);
  container.appendChild(btn);
}

let _somNotif = null;
function _audioNotif() { if (!_somNotif) { _somNotif = new Audio('/midia/som-notificacao.wav'); _somNotif.preload = 'auto'; } return _somNotif; }
function desbloquearSomNotif() { try { const a = _audioNotif(); const v = a.volume; a.volume = 0; a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = v; }).catch(() => { a.volume = v; }); } catch (_) {} }
function tocarSomNotificacao() { try { const a = _audioNotif(); a.currentTime = 0; a.play().catch(() => {}); } catch (_) {} }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.tipo === 'push') tocarSomNotificacao(); });
}

async function meUpdate(action, payload, btn, msgEl) {
  const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Aguarde...';
  try {
    const { ok, status, data } = await apiPost('/api/me-update', { action, ...payload });
    if (status === 401) throw new Error('Sessão expirada. Saia e entre novamente.');
    if (!ok) throw new Error(data.error || 'Erro');
    msgEl.className = 'msg success';
    msgEl.textContent = action === 'password' ? 'Senha alterada!' : action === 'username' ? 'Usuário alterado!' : 'Salvo!';
  } catch (e) {
    msgEl.className = 'msg error'; msgEl.textContent = e.message || 'Não foi possível concluir.';
  } finally { btn.disabled = false; btn.textContent = prev; }
}

function openContaModal(ctx) {
  const email = (ctx && ctx.user && ctx.user.email) || '';
  const userAtual = email.includes('@coroinhas.') ? email.split('@')[0] : email;
  const ov = document.createElement('div'); ov.className = 'modal-overlay open';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const modal = document.createElement('div'); modal.className = 'modal';
  const handle = document.createElement('div'); handle.className = 'modal-handle';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Minha Conta';
  const sub = document.createElement('p'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);margin:-8px 0 16px;font-weight:600;';
  sub.textContent = 'Usuário atual: ' + userAtual;
  modal.append(handle, tt, sub);

  // Foto + patch (editável) — só para membros (sempre a conta logada)
  if (ctx && ctx.conta) {
    const avWrap = document.createElement('div'); avWrap.style.cssText = 'display:flex;justify-content:center;margin:2px 0 18px;';
    avWrap.appendChild(buildAvatarEl(ctx.conta.foto_url, ctx.membership.role, 96, {
      editable: true, membro: ctx.conta,
      nivelSlug: ctx.conta.nivel || nivelFromRole(ctx.membership.role),
      onUpload: (url) => { ctx.conta.foto_url = url; }
    }));
    modal.appendChild(avWrap);
  }

  const msgEl = document.createElement('div'); msgEl.id = 'conta-msg'; msgEl.className = 'msg';

  // Apelido (aparece em destaque acima do nome) — sempre a conta logada
  if (ctx && ctx.conta) {
    const ga = document.createElement('div'); ga.className = 'form-group';
    const la = document.createElement('label'); la.className = 'form-label'; la.textContent = 'Apelido (aparece em destaque)';
    const ia = document.createElement('input'); ia.className = 'form-input'; ia.value = ctx.conta.apelido || ''; ia.placeholder = 'como querem te chamar';
    const ba = document.createElement('button'); ba.className = 'btn-sm gold'; ba.style.marginTop = '8px'; ba.textContent = 'Salvar apelido';
    ba.onclick = async () => {
      ba.disabled = true; ba.textContent = 'Salvando...';
      const { error } = await sb.from('acolitos_membros').update({ apelido: ia.value.trim() || null }).eq('id', ctx.conta.id);
      ba.disabled = false; ba.textContent = 'Salvar apelido';
      if (error) { msgEl.className = 'msg error'; msgEl.textContent = 'Erro ao salvar apelido.'; }
      else { ctx.conta.apelido = ia.value.trim() || null; msgEl.className = 'msg success'; msgEl.textContent = 'Apelido salvo!'; }
    };
    ga.append(la, ia, ba); modal.appendChild(ga);
  }

  // Trocar usuário
  const g1 = document.createElement('div'); g1.className = 'form-group';
  const l1 = document.createElement('label'); l1.className = 'form-label'; l1.textContent = 'Novo usuário';
  const i1 = document.createElement('input'); i1.className = 'form-input'; i1.placeholder = 'ex: joao.silva';
  const b1 = document.createElement('button'); b1.className = 'btn-sm gold'; b1.style.marginTop = '8px'; b1.textContent = 'Trocar usuário';
  b1.onclick = () => { if (!i1.value.trim()) { msgEl.className='msg error'; msgEl.textContent='Digite o novo usuário.'; return; } meUpdate('username', { usuario: i1.value.trim() }, b1, msgEl); };
  g1.append(l1, i1, b1);

  // Trocar senha
  const g2 = document.createElement('div'); g2.className = 'form-group'; g2.style.marginTop = '14px';
  const l2 = document.createElement('label'); l2.className = 'form-label'; l2.textContent = 'Nova senha';
  const i2 = document.createElement('input'); i2.className = 'form-input'; i2.type = 'text'; i2.placeholder = 'mínimo 6 caracteres';
  const b2 = document.createElement('button'); b2.className = 'btn-sm gold'; b2.style.marginTop = '8px'; b2.textContent = 'Alterar senha';
  b2.onclick = () => { if ((i2.value||'').length < 6) { msgEl.className='msg error'; msgEl.textContent='Senha muito curta (mín. 6).'; return; } meUpdate('password', { password: i2.value }, b2, msgEl); };
  g2.append(l2, i2, b2);

  modal.append(g1, g2, msgEl);

  // Notificações push (🔔)
  const gNotif = document.createElement('div'); gNotif.className = 'form-group'; gNotif.style.marginTop = '14px';
  const lNotif = document.createElement('label'); lNotif.className = 'form-label'; lNotif.textContent = 'Notificações no celular';
  gNotif.appendChild(lNotif); modal.appendChild(gNotif);
  renderBotaoNotificacoes(gNotif);

  const close = document.createElement('button'); close.className = 'btn gold'; close.style.marginTop = '16px';
  close.textContent = 'Fechar'; close.onclick = () => ov.remove();
  modal.appendChild(close);
  ov.appendChild(modal); document.body.appendChild(ov);
}

// ── EQUIPE / COORDENAÇÃO ──────────────────────────────────────
const SETORES = [
  ['coordenacao','Coordenação'], ['vice_coordenacao','Vice-Coordenação'], ['secretaria','Secretaria'],
  ['tesouraria_compras','Tesouraria e Compras'], ['ordem_disciplina','Ordem e Disciplina'],
  ['eventos_viagens','Eventos e Viagens'], ['escala','Escala'], ['formacao','Formação'],
  ['espiritualidade','Espiritualidade'], ['almoxarifado','Almoxarifado'], ['midia','Mídia'],
];
const SETOR_LABEL = Object.fromEntries(SETORES);
// Engajamento — habilidades (funções) e competências (soft skills) p/ o próximo nível
const HABILIDADES = [
  ['cred_altar','Cerimoniário de Altar'], ['cred_credencia','Cerimoniário de Credência'],
  ['missal','Missal'], ['altar','Altar'], ['turibulo','Turíbulo'], ['naveta','Naveta'],
  ['cruz','Cruz'], ['vela','Velas'], ['sineta','Sineta'], ['sinao','Sinão'], ['apoio','Apoio'],
];
const COMPETENCIAS = [
  ['lideranca','Liderança'], ['postura','Postura'], ['paciencia','Paciência'],
  ['trabalho_equipe','Trabalho em equipe'], ['pontualidade','Pontualidade'],
  ['reverencia','Reverência'], ['comunicacao','Comunicação'], ['humildade','Humildade'],
  ['comprometimento','Comprometimento'], ['proatividade','Proatividade'], ['espiritualidade','Espiritualidade'],
];
const HABILIDADE_LABEL = Object.fromEntries(HABILIDADES);
const COMPETENCIA_LABEL = Object.fromEntries(COMPETENCIAS);
// Mescla habilidades/competências customizadas (tabela acolitos_listas) nas listas e nos rótulos
let _listasCarregadas = false;
async function loadListasCustom(force = false) {
  if (_listasCarregadas && !force) return;
  try {
    const { data } = await sb.from('acolitos_listas').select('tipo,valor,label').in('tipo', ['habilidade', 'competencia', 'setor']).order('label');
    const byTipo = { habilidade: [], competencia: [], setor: [] };
    (data || []).forEach(r => { if (byTipo[r.tipo]) byTipo[r.tipo].push([r.valor, r.label]); });
    // DB é a fonte da verdade: se há linhas no banco p/ o tipo, substitui a lista; vazio → mantém o padrão do código (fallback de fábrica)
    const aplicar = (arr, labelObj, rows) => {
      if (!rows.length) return;
      arr.length = 0; Object.keys(labelObj).forEach(k => delete labelObj[k]);
      rows.forEach(([v, l]) => { arr.push([v, l]); labelObj[v] = l; });
    };
    aplicar(HABILIDADES, HABILIDADE_LABEL, byTipo.habilidade);
    aplicar(COMPETENCIAS, COMPETENCIA_LABEL, byTipo.competencia);
    aplicar(SETORES, SETOR_LABEL, byTipo.setor);
    _listasCarregadas = true;
  } catch (e) { /* listas indisponíveis — segue com as padrão */ }
}
// ── CONFIG GLOBAL (tabela acolitos_config) ────────────────────
let _APP_CONFIG = {};
let _CONFIG_CARREGADO = false;
async function loadConfig() {
  try {
    const { data } = await sb.from('acolitos_config').select('chave,valor');
    _APP_CONFIG = {}; (data||[]).forEach(r => { _APP_CONFIG[r.chave] = r.valor; });
    // listas usadas como config (tipos de celebração e funções) — guardadas com prefixo __
    const { data: lst } = await sb.from('acolitos_listas').select('tipo,valor,label,meta').in('tipo', ['tipo_celebracao','funcao']);
    _APP_CONFIG.__tipos = (lst||[]).filter(x => x.tipo === 'tipo_celebracao');
    _APP_CONFIG.__funcoes = (lst||[]).filter(x => x.tipo === 'funcao');
    _CONFIG_CARREGADO = true;
    aplicarIdentidade();
    aplicarNiveisEstrutura();
    aplicarNiveis();
  } catch (e) { _APP_CONFIG = {}; }
}
// Estrutura dos níveis (Config → Níveis): se há 'niveis_full' (lista completa), substitui NIVEIS inteiro.
// Permite adicionar/reordenar/excluir. Sem isso, usa os níveis padrão do código.
function aplicarNiveisEstrutura() {
  const full = (_APP_CONFIG && _APP_CONFIG.niveis_full) || null;
  if (!Array.isArray(full) || !full.length || typeof NIVEIS === 'undefined') return;
  NIVEIS.length = 0;
  full.forEach((e, i) => {
    NIVEIS.push({
      slug: e.slug, label: e.label || e.slug, base: e.base || 'acolito',
      int: (e.int != null ? Number(e.int) : i), pips: (e.pips != null ? Number(e.pips) : 0),
      emoji: e.emoji || '', titulo: e.titulo || '',
      intro: e.intro || '', missao: e.missao || '', desafio: e.desafio || '', proximo: e.proximo || '',
      _patch: e.patch || e._patch || null,
    });
  });
}
// Override dos textos dos níveis (Config → Níveis): label, título e tudo do "O caminho".
function aplicarNiveis() {
  const ov = (_APP_CONFIG && _APP_CONFIG.niveis) || null;
  if (!ov || typeof NIVEIS === 'undefined') return;
  NIVEIS.forEach(n => {
    const o = ov[n.slug]; if (!o) return;
    ['label', 'titulo', 'intro', 'missao', 'desafio', 'proximo'].forEach(k => { if (o[k] !== undefined && o[k] !== null) n[k] = o[k]; });
    if (o.patch) n._patch = o.patch; // emblema customizado (gerador de patch)
  });
}
// Aplica identidade/tema (cores) do Config em runtime — fallback: tema padrão do CSS
function aplicarIdentidade() {
  const idn = (_APP_CONFIG && _APP_CONFIG.identidade) || null;
  if (!idn) return;
  const root = document.documentElement;
  if (idn.cor_ouro) { root.style.setProperty('--gold', idn.cor_ouro); root.style.setProperty('--gold-light', idn.cor_ouro); }
  if (idn.cor_primaria) { root.style.setProperty('--wine', idn.cor_primaria); root.style.setProperty('--red', idn.cor_primaria); root.style.setProperty('--red-soft', idn.cor_primaria); }
}
function cfg(chave, padrao) { return (_APP_CONFIG && (chave in _APP_CONFIG)) ? _APP_CONFIG[chave] : padrao; }
// Mescla os tipos de celebração customizados no objeto TIPO_LABEL da página (mutação de objeto — ok mesmo sendo const)
function mergeTiposLabel(obj) {
  const tps = cfg('__tipos', []) || [];
  if (!tps.length) return; // banco vazio → mantém os tipos padrão do código (fallback)
  Object.keys(obj).forEach(k => delete obj[k]); // banco é a fonte da verdade → substitui (excluir gruda)
  tps.forEach(t => { if (t && t.valor) obj[t.valor] = t.label || t.valor; });
}
function isSuperadmin(ctx) {
  const lista = cfg('superadmins', ['erickmartins','erickmartinsadmin']);
  const email = (ctx && ctx.user && ctx.user.email) || '';
  const usuario = email.includes('@') ? email.split('@')[0] : email;
  return Array.isArray(lista) && lista.includes(usuario);
}
// Link wa.me a partir de um telefone BR (adiciona 55 se faltar)
function waLink(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return 'https://wa.me/' + (d.startsWith('55') ? d : '55' + d);
}
// Normaliza texto para busca: minúsculas, sem acento, sem espaços nas pontas.
// "João" e "joao" passam a casar; usado em todos os campos de busca de nome.
function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
// Contato principal por idade: 13+ usa o número do próprio membro; menor usa o do
// responsável (celular da mãe). Sempre cai num número válido se houver.
function waMembro(m) {
  if (!m) return null;
  const idade = (typeof idadeAnos === 'function') ? idadeAnos(m.data_nascimento) : null;
  const proprio = m.telefone;
  const resp = m.celular_responsavel || m.celular_mae;
  const ordem = (idade !== null && idade >= 13)
    ? [proprio, resp, m.celular_mae]            // 13+ : número do membro como principal
    : [resp, m.celular_mae, proprio];           // menor: celular da mãe/responsável como principal
  for (const c of ordem) { const l = waLink(c); if (l) return l; }
  return null;
}
// Máscara de telefone brasileiro: (00) 00000-0000 ou (00) 0000-0000
function mascaraTel(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d*)/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d*)/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d*)/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d*)/, '($1) $2-$3');
}
function attachTelMask(el) {
  if (!el) return;
  el.setAttribute('inputmode', 'numeric'); el.maxLength = 16;
  el.value = mascaraTel(el.value);
  el.addEventListener('input', () => { el.value = mascaraTel(el.value); });
}
// Módulos que o admin pode liberar por pessoa (key, label, href). Hoje só os existentes.
const MODULOS_LIBERAVEIS = [
  ['escala','Escala','escala.html'], ['membros','Membros','membros.html'],
  ['crm','Integração (CRM)','crm.html'],
  ['tesouraria','Tesouraria','tesouraria.html'], ['casas','Casas','casas.html'],
]; // 'chamada' foi fundida na Escala (botão por card) — não é mais um módulo de nav separado

// ── BOTTOM NAV ────────────────────────────────────────────────
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];

// Módulos de coordenação na navegação (na ordem fixa); permissões controlam quais aparecem
const NAV_COORD_MODULOS = {
  membros:    { label:'Membros',    href:'membros.html',    icon:'users' },
  escala:     { label:'Escala',     href:'escala.html',     icon:'calendar' },
  crm:        { label:'CRM',        href:'crm.html',        icon:'shuffle' },
  tesouraria: { label:'Tesouraria', href:'tesouraria.html', icon:'dollar' },
  casas:      { label:'Casas',      href:'casas.html',      icon:'shield' },
};
const ORDEM_MODULOS = ['membros','escala','crm','tesouraria','casas']; // chamada fundida na Escala

// Rótulos amigáveis por arquivo, p/ o chip "Continuar" da Home (Fase 4).
// Cobre telas de coordenação (NAV_COORD_MODULOS) e de jornada.
const TELA_LABEL = {
  'membros.html':'Membros', 'escala.html':'Escala', 'crm.html':'CRM',
  'tesouraria.html':'Tesouraria', 'casas.html':'Casas',
  'missoes.html':'Quests', 'escalas-membro.html':'Minhas Escalas', 'agenda.html':'Agenda',
  'destaques.html':'Destaques', 'minha-casa.html':'Minha Casa', 'ausencias.html':'Ausências',
  'jornada-admin.html':'Jornada', 'conquistas.html':'Conquistas'
  // config.html propositalmente FORA: painel superadmin (gate por username, não perm) — não deve virar chip "Continuar"
};
// Telas que NÃO devem ser lembradas como "última tela"
const TELA_NAO_LEMBRAR = { 'login.html':1, 'novos.html':1, 'index.html':1, '':1 };

function registrarUltimaTela(){
  try{
    const file = (location.pathname.split('/').pop()||'');
    if (TELA_NAO_LEMBRAR[file]) return;
    const label = TELA_LABEL[file];
    if (!label) return;                       // só telas conhecidas
    localStorage.setItem('ultima-tela', JSON.stringify({ href:file, label:label }));
  }catch(e){}
}

// Capacidades do usuário p/ navegação
function navCaps(ctx) {
  const role = ctx && ctx.membership ? ctx.membership.role : null;
  const m = ctx ? (ctx.conta || ctx.membro) : null; // permissões/menu seguem a conta logada, não o perfil ativo
  const isAdmin = ['coord_admin', 'subadmin'].includes(role); // só admin vê todos os módulos
  const ehEquipe = isAdmin || EQUIPE_ROLES.includes(role) || !!(m && m.eh_equipe);
  const serve = m ? (m.serve !== false) : false;
  const nivel = (m && m.nivel) || nivelFromRole(role || 'aspirante');
  const isCerimo = nivelInfo(nivel).base === 'cerimonario';
  const perms = isAdmin ? ORDEM_MODULOS.slice() : ((m && Array.isArray(m.permissoes)) ? m.permissoes : []);
  return { isAdmin, ehEquipe, serve, isCerimo, perms, nivel };
}
// Modo atual: 'jornada' | 'coordenacao'
function navMode(ctx) {
  const c = navCaps(ctx);
  if (c.serve && c.ehEquipe) return localStorage.getItem('nav-mode') || 'jornada';
  if (c.ehEquipe && !c.serve) return 'coordenacao';
  return 'jornada';
}

function _svgIcon(name) {
  const d = {
    home:           'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    users:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    shuffle:        'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
    calendar:       'M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
    'calendar-days': 'M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01',
    'x-circle':     'M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0z M15 9l-6 6 M9 9l6 6',
    'message-circle':'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    dollar:         'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    star:           'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z',
    shield:         'M12 2l8 3v6c0 5-3.5 8.6-8 11-4.5-2.4-8-6-8-11V5z',
    settings:       'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  };
  return `<svg viewBox="0 0 24 24"><path d="${d[name] || ''}"/></svg>`;
}

// ── BRASÕES DAS CASAS (SVG próprio, sem emoji) ────────────────
const CASA_COR = { sanctaris:'#c0392b', seraphim:'#e67e22', veritatis:'#2980b9', templaris:'#27ae60', consilium:'#7d3c98' };
function getCasaBrasao(slug, size) {
  size = size || 80;
  const cor = CASA_COR[slug] || '#8a6a24';
  const uid = 'cb' + Math.random().toString(36).slice(2, 8);
  const simbolos = {
    sanctaris: '<g fill="#ffe9b0">'
      + '<path d="M32 16 L35.5 23 L35.5 42 L28.5 42 L28.5 23 Z"/>'
      + '<rect x="21" y="42" width="22" height="4.2" rx="1.6"/>'
      + '<rect x="30.3" y="46" width="3.4" height="7"/>'
      + '<circle cx="32" cy="55" r="2.8"/></g>'
      + '<path d="M32 20 L32 41" stroke="' + cor + '" stroke-width="1.5" stroke-linecap="round"/>',
    seraphim: '<path d="M32 18 C26 28 21 32 21 40 a11 11 0 0 0 22 0 C43 32 38 28 32 18 Z" fill="#ffe9b0"/>'
      + '<path d="M32 29 C29 34 26 36 26 41 a6 6 0 0 0 12 0 C38 36 35 34 32 29 Z" fill="' + cor + '"/>',
    veritatis: '<g fill="none" stroke="#ffe9b0" stroke-width="2.4" stroke-linejoin="round">'
      + '<path d="M32 27 C28 24 22 24 17 26 L17 47 C22 45 28 45 32 48 C36 45 42 45 47 47 L47 26 C42 24 36 24 32 27 Z"/>'
      + '<path d="M32 27 L32 48"/></g>'
      + '<circle cx="32" cy="19" r="2.8" fill="#ffe9b0"/>',
    templaris: '<g fill="#ffe9b0"><rect x="28.5" y="20" width="7" height="32" rx="2"/><rect x="19" y="30" width="26" height="7" rx="2"/></g>',
    consilium: '<g fill="#ffe9b0">'
      + '<path d="M32 15 C29.5 21 29 27 32 33 C35 27 34.5 21 32 15 Z"/>'
      + '<path d="M31 31 C24 27 18 30 19 36 C20 41 26 42 30 39 C27 36 28 33 31 31 Z"/>'
      + '<path d="M33 31 C40 27 46 30 45 36 C44 41 38 42 34 39 C37 36 36 33 33 31 Z"/>'
      + '<path d="M23 40 H41 V43.5 H23 Z"/>'
      + '<path d="M30 43.5 H34 L33 53 H31 Z"/></g>',
  };
  const s = String(size);
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="' + cor + '"/><stop offset="1" stop-color="#150a0d"/></linearGradient></defs>'
    + '<path d="M32 3 L61 11 L61 39 C61 58 32 69 32 69 C32 69 3 58 3 39 L3 11 Z" fill="url(#' + uid + ')" stroke="#e8b94a" stroke-width="2.5"/>'
    + '<path d="M32 9 L55.5 15.5 L55.5 38.5 C55.5 53 32 62.5 32 62.5 C32 62.5 8.5 53 8.5 38.5 L8.5 15.5 Z" fill="none" stroke="#8a6a24" stroke-width="1"/>'
    + (simbolos[slug] || '') + '</svg>';
}

function renderBottomNav(ctx, activePage) {
  const el = document.getElementById('app-nav');
  if (!el) return;
  el.className = 'app-nav';
  el.textContent = '';
  const c = navCaps(ctx); const mode = navMode(ctx);
  let items;
  if (mode === 'coordenacao') {
    items = [{ id:'home', href:'index.html', label:'Início', icon:'home' },
      { id:'agenda', href:'agenda.html', label:'Agenda', icon:'calendar-days' },
      { id:'jornada', href:'jornada-admin.html', label:'Jornada', icon:'star' }];
    ORDEM_MODULOS.forEach(k => { if (c.perms.includes(k)) { const mod = NAV_COORD_MODULOS[k]; items.push({ id:k, href:mod.href, label:mod.label, icon:mod.icon }); } });
    if (isSuperadmin(ctx)) items.push({ id:'config', href:'config.html', label:'Config', icon:'settings' });
  } else {
    items = [{ id:'home', href:'index.html', label:'Início', icon:'home' },
      { id:'quests', href:'missoes.html', label:'Quests', icon:'star' },
      { id:'escalas-membro', href:'escalas-membro.html', label:'Escalas', icon:'calendar' },
      { id:'agenda', href:'agenda.html', label:'Agenda', icon:'calendar-days' },
      { id:'destaques', href:'destaques.html', label:'Destaques', icon:'star' },
      { id:'minha-casa', href:'minha-casa.html', label:'Casa', icon:'shield' },
      { id:'ausencias', href:'ausencias.html', label:'Ausência', icon:'x-circle' }];
    // Chamada foi fundida na Escala: o cerimoniário faz a chamada pelo botão no card de escala.
  }
  // ordem customizável da barra (Config → Navegação); itens fora da lista vão pro fim na ordem padrão
  const _ordCfg = (typeof cfg === 'function') ? cfg(mode === 'coordenacao' ? 'nav_ordem_coord' : 'nav_ordem_jornada', null) : null;
  if (Array.isArray(_ordCfg) && _ordCfg.length) {
    items.sort((a, b) => { const ia = _ordCfg.indexOf(a.id), ib = _ordCfg.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  }
  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'nav-item' + (item.id === activePage ? ' active' : '');
    a.href = item.href;
    // Páginas ainda não construídas ficam desabilitadas
    if (!['home','membros','crm','index'].includes(item.id) && !item.href.includes('index')) {
      // só desabilita se o arquivo não existe ainda — deixamos habilitado por ora
    }
    const iconDiv = document.createElement('span');
    iconDiv.innerHTML = _svgIcon(item.icon); // hardcoded SVG paths — seguro
    const labelSpan = document.createElement('span');
    labelSpan.textContent = item.label;
    a.append(iconDiv, labelSpan);
    el.appendChild(a);
  });
  setupNavArrows(el);
}

// Setas de rolagem no rodapé (quando há mais submódulos do que cabem)
function setupNavArrows(el) {
  document.querySelectorAll('.nav-arrow').forEach(x => x.remove());
  const chevron = (dir) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + (dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>';
  const left = document.createElement('button'); left.className = 'nav-arrow left'; left.innerHTML = chevron('left'); left.setAttribute('aria-label', 'Mais à esquerda'); // SVG hardcoded — seguro
  const right = document.createElement('button'); right.className = 'nav-arrow right'; right.innerHTML = chevron('right'); right.setAttribute('aria-label', 'Mais submódulos'); // SVG hardcoded — seguro
  left.onclick = () => el.scrollBy({ left: -140, behavior: 'smooth' });
  right.onclick = () => el.scrollBy({ left: 140, behavior: 'smooth' });
  document.body.append(left, right);
  const upd = () => {
    const overflow = el.scrollWidth - el.clientWidth > 4;
    left.hidden = !overflow || el.scrollLeft <= 4;
    right.hidden = !overflow || el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
  };
  el.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  requestAnimationFrame(() => { upd(); if (!right.hidden) { right.classList.add('hint'); setTimeout(() => right.classList.remove('hint'), 2600); } });
}

// Switch "Minha Jornada ⇄ Coordenação" — barra fixa abaixo do header (só quem tem os dois)
function renderModeSwitch(ctx) {
  let bar = document.getElementById('mode-switch');
  const c = navCaps(ctx);
  if (!(c.serve && c.ehEquipe)) { if (bar) bar.remove(); document.body.classList.remove('has-switch'); return; }
  const mode = navMode(ctx);
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'mode-switch'; bar.className = 'mode-switch';
    const header = document.getElementById('app-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    else document.body.appendChild(bar);
  }
  document.body.classList.add('has-switch');
  bar.textContent = '';
  const seg = document.createElement('div'); seg.className = 'mode-seg';
  [['jornada','✦ Minha Jornada'], ['coordenacao','⚙ Coordenação']].forEach(([mk, label]) => {
    const b = document.createElement('button'); b.className = 'mode-btn' + (mode === mk ? ' active' : ''); b.textContent = label;
    b.onclick = () => { if (mode !== mk) { localStorage.setItem('nav-mode', mk); window.location.href = 'index.html'; } };
    seg.appendChild(b);
  });
  bar.appendChild(seg);
}

// ── PATCHES DE RANK (SVG) ────────────────────────────────────
function getPatchSvg(role, size) {
  size = size || 28;
  const s = String(size);
  const patches = {
    aspirante: `<svg width="${s}" height="${s}" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-aspirante">
      <path d="M16 2L30 8V22C30 30 16 34 16 34C16 34 2 30 2 22V8Z" fill="#2a2a2a" stroke="#7a7a7a" stroke-width="1.5"/>
      <path d="M16 6L26 11V22C26 28 16 32 16 32C16 32 6 28 6 22V11Z" fill="none" stroke="#4a4a4a" stroke-width="0.8"/>
      <line x1="16" y1="13" x2="16" y2="27" stroke="#a0a0a0" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="#a0a0a0" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    coroinha: `<svg width="${s}" height="${s}" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-coroinha">
      <path d="M16 2L30 8V22C30 30 16 34 16 34C16 34 2 30 2 22V8Z" fill="#0a1e33" stroke="#4a90c4" stroke-width="2"/>
      <path d="M16 6L26 11V22C26 28 16 32 16 32C16 32 6 28 6 22V11Z" fill="none" stroke="#2a6090" stroke-width="0.8"/>
      <path d="M10 27L10 20L13 23.5L16 17L19 23.5L22 20L22 27Z" fill="#c0d8f0" stroke="#e0f0ff" stroke-width="0.5"/>
      <line x1="10" y1="28.5" x2="22" y2="28.5" stroke="#c0d8f0" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    acolito: `<svg width="${s}" height="${s}" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-acolito">
      <path d="M18 2L34 10L34 28L18 38L2 28L2 10Z" fill="#2a1a00" stroke="#c9a84c" stroke-width="2"/>
      <path d="M18 7L29 13L29 27L18 33L7 27L7 13Z" fill="none" stroke="#7a5800" stroke-width="0.8"/>
      <ellipse cx="18" cy="18" rx="5" ry="7" fill="none" stroke="#ffd700" stroke-width="1.5"/>
      <line x1="18" y1="11" x2="18" y2="10" stroke="#ffd700" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="18" cy="25" rx="3" ry="1.5" fill="#c9a84c" opacity="0.6"/>
      <line x1="18" y1="25" x2="18" y2="30" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="14" y1="28" x2="22" y2="28" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    cerimonario: `<svg width="${s}" height="${s}" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-cerimonario">
      <path d="M18 2L34 20L18 42L2 20Z" fill="#1a0a2a" stroke="#9b59d4" stroke-width="2"/>
      <path d="M18 8L30 21L18 37L6 21Z" fill="none" stroke="#5a1a9a" stroke-width="0.8"/>
      <path d="M18 11L20.5 18H27L22 22.5L24 30L18 26L12 30L14 22.5L9 18H15.5Z" fill="#d4a0ff" stroke="#b060f0" stroke-width="0.5"/>
    </svg>`,
  };
  return patches[role] || patches.aspirante;
}

function getRoleForPatch(role) {
  if (role === 'cerimonario') return 'cerimonario';
  if (role === 'acolito') return 'acolito';
  if (role === 'coroinha') return 'coroinha';
  return 'aspirante';
}

// ── JORNADA: 10 NÍVEIS (rank) ────────────────────────────────
// base = forma do patch; int = intensidade da animação (0..9); pips = divisões.
const NIVEIS = [
  { slug:'aspirante', label:'Aspirante', base:'aspirante', int:0, pips:0, emoji:'🌱', titulo:'Aprendiz do Altar',
    intro:'Você acaba de ingressar na jornada. Ainda está conhecendo o caminho, aprendendo os primeiros ensinamentos e descobrindo o significado do serviço ao altar.',
    missao:'Aprender.', desafio:'Demonstrar disciplina, interesse e espírito de serviço.', proximo:'Tornar-se Coroinha.' },
  { slug:'coroinha', label:'Coroinha', base:'coroinha', int:1, pips:0, emoji:'🕯️', titulo:'Coroinha do Senhor',
    intro:'Você já faz parte da equipe de servidores. Agora não é apenas um observador: participa ativamente da celebração e ajuda a tornar a liturgia mais bela.',
    missao:'Servir.', desafio:'Aprender as funções básicas e crescer na responsabilidade.', proximo:'Ingressar na formação de Acólito.' },
  { slug:'acolito_aspirante', label:'Acólito Aspirante', base:'acolito', int:2, pips:1, emoji:'⚜️', titulo:'Servo do Altar',
    intro:'Você iniciou uma nova etapa. O altar agora está mais próximo e suas responsabilidades aumentam. É o momento de aprofundar seus conhecimentos e aperfeiçoar seu serviço.',
    missao:'Crescer.', desafio:'Dominar novas funções e amadurecer liturgicamente.', proximo:'Tornar-se um Guardião do Altar.' },
  { slug:'acolito_guardiao', label:'Acólito Guardião', base:'acolito', int:3, pips:2, emoji:'🛡️', titulo:'Guardião do Altar',
    intro:'Você conquistou a confiança da pastoral. Seu compromisso já é reconhecido e seu exemplo começa a influenciar os mais novos.',
    missao:'Proteger.', desafio:'Zelar pelo altar, pela organização e pelo bom exemplo.', proximo:'Alcançar o posto de Sentinela.' },
  { slug:'acolito_sentinela', label:'Acólito Sentinela', base:'acolito', int:4, pips:3, emoji:'👁️', titulo:'Sentinela do Altar',
    intro:'Você está entre os acólitos mais experientes. Sua atenção aos detalhes, sua maturidade e sua dedicação fazem de você uma referência para os demais.',
    missao:'Vigiar.', desafio:'Perceber o que os outros não percebem e ajudar a manter a excelência do serviço.', proximo:'Ser chamado para a formação de Cerimoniário.' },
  { slug:'aspirante_cerimoniario', label:'Aspirante a Cerimoniário', base:'acolito', int:5, pips:0, emoji:'📖', titulo:'Aprendiz dos Ritos',
    intro:'Você recebeu um chamado especial. Agora começa a aprender não apenas a servir, mas também a conduzir e organizar.',
    missao:'Preparar-se.', desafio:'Conhecer os bastidores da liturgia e desenvolver liderança.', proximo:'Concluir a formação e tornar-se Cerimoniário.' },
  { slug:'cerimoniario_aspirante', label:'Cerimoniário Aspirante', base:'cerimonario', int:6, pips:1, emoji:'🎖️', titulo:'Cerimoniário Iniciado',
    intro:'Você acaba de ingressar na Ordem dos Cerimoniários. Já possui formação básica e começa a colocar em prática tudo aquilo que aprendeu.',
    missao:'Aperfeiçoar-se.', desafio:'Transformar conhecimento em experiência.', proximo:'Tornar-se um Cerimoniário Guardião.' },
  { slug:'cerimoniario_guardiao', label:'Cerimoniário Guardião', base:'cerimonario', int:7, pips:2, emoji:'⚔️', titulo:'Guardião das Celebrações',
    intro:'Você domina todas as funções da pastoral. Pode assumir qualquer posição e auxiliar em qualquer necessidade litúrgica.',
    missao:'Garantir.', desafio:'Assegurar que cada celebração aconteça com ordem, reverência e beleza.', proximo:'Tornar-se uma referência para toda a pastoral.' },
  { slug:'cerimoniario_magistral', label:'Cerimoniário Magistral', base:'cerimonario', int:8, pips:3, emoji:'⚜️', titulo:'Mestre dos Ritos Sagrados',
    intro:'Você não é apenas experiente — você se tornou uma referência. Seu conhecimento, postura e dedicação inspiram os demais servidores.',
    missao:'Ensinar.', desafio:'Formar novos líderes e preservar a excelência litúrgica.', proximo:'Alcançar o mais alto posto da pastoral.' },
  { slug:'cerimoniario_mor', label:'Cerimoniário Mor', base:'cerimonario', int:9, pips:4, emoji:'👑',
    intro:'Este é o ápice da jornada. Você se tornou um dos principais guardiões da tradição, da organização e da beleza da liturgia.',
    missao:'Liderar.', desafio:'Garantir que o legado recebido seja transmitido às próximas gerações.', proximo:'🏆 Título conquistado: Guardião Supremo das Celebrações.',
    titulo:'Guardião Supremo das Celebrações' },
];
function nivelInfo(slug) { return NIVEIS.find(n => n.slug === slug) || NIVEIS[0]; }
function nivelIndex(slug) { return NIVEIS.findIndex(n => n.slug === slug); }
function nivelFromRole(role) {
  if (role === 'cerimonario') return 'cerimoniario_aspirante';
  if (role === 'acolito') return 'acolito_aspirante';
  if (role === 'coroinha') return 'coroinha';
  return 'aspirante';
}

// SVG do emblema por NÍVEL (escudo + símbolos que evoluem). Aspirante/Coroinha
// usam os patches base; acólito e cerimoniário ganham composições próprias.
// ── GERADOR DE PATCH (spec → SVG) ────────────────────────────
const PATCH_ESQUEMAS = {
  ouro:     { label:'Ouro',     fill:'#2a1a00', edge:'#e8b94a', edge2:'#7a5800', acc:'#ffe08a' },
  roxo:     { label:'Roxo',     fill:'#1c0b2e', edge:'#9b59d4', edge2:'#5a1a9a', acc:'#d8b3ff' },
  vermelho: { label:'Vermelho', fill:'#2e0b0e', edge:'#e0455a', edge2:'#7a1822', acc:'#ffb3bd' },
  azul:     { label:'Azul',     fill:'#0b1a2e', edge:'#4a90c4', edge2:'#1a4a7a', acc:'#b3dcff' },
  verde:    { label:'Verde',    fill:'#0b2e16', edge:'#3fae6b', edge2:'#1a7a3a', acc:'#b3ffce' },
  prata:    { label:'Prata',    fill:'#191c22', edge:'#c8cdd6', edge2:'#5a6068', acc:'#eef1f6' },
  bronze:   { label:'Bronze',   fill:'#241404', edge:'#c0793a', edge2:'#7a4316', acc:'#f3c089' },
  esmeralda:{ label:'Esmeralda',fill:'#04241c', edge:'#1fb89a', edge2:'#0a6e5a', acc:'#9cf6e0' },
  rubi:     { label:'Rubi',     fill:'#2a0414', edge:'#d62a6a', edge2:'#8a0f3e', acc:'#ffa6c8' },
  safira:   { label:'Safira',   fill:'#0a1038', edge:'#4a63e0', edge2:'#1e2a8a', acc:'#b9c4ff' },
  ametista: { label:'Ametista', fill:'#1a0a2e', edge:'#b06ce8', edge2:'#6a2aa0', acc:'#e3c2ff' },
  marfim:   { label:'Marfim',   fill:'#26221a', edge:'#e8dcc0', edge2:'#9a8a64', acc:'#fff6e4' },
  onix:     { label:'Ônix',     fill:'#0c0d10', edge:'#6b7280', edge2:'#2a2e36', acc:'#c4cad6' },
  rosa:     { label:'Rosa',     fill:'#2e0a22', edge:'#e85aa8', edge2:'#9a1a66', acc:'#ffc2e6' },
  ceu:      { label:'Céu',      fill:'#06212e', edge:'#34b6d6', edge2:'#0e6a86', acc:'#a6ecff' },
};
const PATCH_SIMBOLOS = ['cruz','crucifixo','espada','espadas','turibulo','coroa','calice','hostia','pomba','chama','vela','livro','trigo','uva','coracao','ancora','alfaomega','sino','estrela'];
function _patchSvg(spec, size) {
  const s = String(size || 80);
  const C = PATCH_ESQUEMAS[(spec && spec.esquema)] || PATCH_ESQUEMAS.ouro;
  const forma = (spec && spec.forma) || 'arredondada';
  const SHELL = {
    arredondada: { out:'M13 14 H51 V38 Q51 54 32 62 Q13 54 13 38 Z',                 in:'M18 19 H46 V37 Q46 50 32 57 Q18 50 18 37 Z' },
    pontuda:     { out:'M32 8 L51 15 V38 Q51 54 32 62 Q13 54 13 38 V15 Z',           in:'M32 13 L46 19 V37 Q46 50 32 57 Q18 50 18 37 V19 Z' },
    redonda:     { out:'M32 11 A21 21 0 1 1 31.99 11 Z',                              in:'M32 16 A16 16 0 1 1 31.99 16 Z' },
    ogival:      { out:'M32 7 Q49 18 49 24 V37 Q49 53 32 62 Q15 53 15 37 V24 Q15 18 32 7 Z', in:'M32 13 Q43 21 43 26 V37 Q43 50 32 57 Q21 50 21 37 V26 Q21 21 32 13 Z' },
  };
  const sh = SHELL[forma] || SHELL.arredondada;
  const shield = `<path d="${sh.out}" fill="${C.fill}" stroke="${C.edge}" stroke-width="2.6"/>`;
  const inner = !(spec && spec.anel) ? '' : `<path d="${sh.in}" fill="none" stroke="${C.edge2}" stroke-width="1.3"/>`;
  const SIMB = {
    cruz:    `<g stroke="${C.acc}" stroke-width="3" stroke-linecap="round"><line x1="32" y1="24" x2="32" y2="46"/><line x1="23" y1="33" x2="41" y2="33"/></g>`,
    crucifixo:`<g stroke="${C.acc}" stroke-linecap="round" fill="none"><g stroke-width="2.8"><line x1="32" y1="22" x2="32" y2="47"/><line x1="23" y1="30" x2="41" y2="30"/></g><path d="M32 33 q-4 2 -4 6 q0 3 4 4 q4 -1 4 -4 q0 -4 -4 -6Z" fill="${C.acc}" stroke="none"/><line x1="29" y1="22" x2="35" y2="22" stroke-width="2"/></g>`,
    espada:  `<g stroke="${C.acc}" stroke-linecap="round"><line x1="32" y1="20" x2="32" y2="40" stroke-width="3.2"/><line x1="25" y1="36" x2="39" y2="36" stroke-width="2.4"/><circle cx="32" cy="44" r="2.3" fill="${C.acc}" stroke="none"/></g>`,
    espadas: `<g stroke="${C.acc}" stroke-width="2.6" stroke-linecap="round"><line x1="22" y1="48" x2="43" y2="24"/><line x1="42" y1="48" x2="21" y2="24"/></g>`,
    turibulo:`<g stroke="${C.acc}" stroke-width="1.8" fill="none" stroke-linecap="round"><circle cx="32" cy="18" r="1.9"/><line x1="31" y1="19.5" x2="28" y2="29"/><line x1="33" y1="19.5" x2="36" y2="29"/><path d="M27 29 H37 L35.5 33 H28.5 Z" fill="${C.fill}"/><path d="M28 33 Q28 43 32 43 Q36 43 36 33" fill="${C.fill}"/><line x1="29" y1="37" x2="35" y2="37"/></g>`,
    coroa:   `<path d="M23 13 L24.5 5 L28.5 9.5 L32 3 L35.5 9.5 L39.5 5 L41 13 Z" fill="${C.acc}" stroke="${C.edge2}" stroke-width="0.5" stroke-linejoin="round"/>`,
    calice:  `<g stroke="${C.acc}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="20" r="4.5" fill="${C.fill}"/><path d="M24 28 Q24 39 32 39 Q40 39 40 28 Z" fill="${C.fill}"/><line x1="32" y1="39" x2="32" y2="47"/><line x1="25" y1="48" x2="39" y2="48" stroke-width="2.4"/></g>`,
    hostia:  `<g stroke="${C.acc}" fill="none" stroke-linecap="round"><g stroke-width="1.5"><line x1="32" y1="13" x2="32" y2="17"/><line x1="32" y1="47" x2="32" y2="51"/><line x1="13" y1="32" x2="17" y2="32"/><line x1="47" y1="32" x2="51" y2="32"/><line x1="19" y1="19" x2="22" y2="22"/><line x1="45" y1="45" x2="42" y2="42"/><line x1="45" y1="19" x2="42" y2="22"/><line x1="19" y1="45" x2="22" y2="42"/></g><circle cx="32" cy="32" r="10.5" stroke-width="2" fill="${C.fill}"/><g stroke-width="2"><line x1="32" y1="26.5" x2="32" y2="37.5"/><line x1="26.5" y1="32" x2="37.5" y2="32"/></g></g>`,
    pomba:   `<g fill="${C.acc}" stroke="none"><circle cx="32" cy="19" r="3"/><path d="M32 22 Q29.5 27 30 33 L32 45 L34 33 Q34.5 27 32 22 Z"/><path d="M30 27 Q21 27 17 36 Q23 32.5 30 35 Z"/><path d="M34 27 Q43 27 47 36 Q41 32.5 34 35 Z"/></g><g stroke="${C.acc}" stroke-width="1.5" fill="none" stroke-linecap="round"><line x1="32" y1="16" x2="32" y2="13"/></g>`,
    chama:   `<path d="M32 18 C28 27 23 30 23 38 a9 9 0 0 0 18 0 C41 32 38 31 37 27 C35 31 33 30 33 26 C33 23 33 21 32 18 Z" fill="${C.acc}"/>`,
    vela:    `<g stroke="${C.acc}" stroke-linecap="round" stroke-linejoin="round"><path d="M32 16 C29.5 20 28 22 28 25.5 a4 4 0 0 0 8 0 C36 22 34.5 20 32 16 Z" fill="${C.acc}" stroke="none"/><line x1="32" y1="29" x2="32" y2="32" stroke-width="1.4"/><rect x="27" y="32" width="10" height="16" rx="1.5" fill="${C.fill}" stroke-width="2"/><line x1="23" y1="48" x2="41" y2="48" stroke-width="2.4"/></g>`,
    livro:   `<g stroke="${C.acc}" stroke-width="2" fill="${C.fill}" stroke-linejoin="round" stroke-linecap="round"><path d="M32 24 C28 21.5 22 21.5 18 23.5 V43 C22 41 28 41 32 43.5 C36 41 42 41 46 43 V23.5 C42 21.5 36 21.5 32 24 Z"/><line x1="32" y1="24" x2="32" y2="43.5" stroke-width="1.5"/><g stroke-width="1.3"><line x1="25" y1="29.5" x2="25" y2="36.5"/><line x1="21.5" y1="33" x2="28.5" y2="33"/></g></g>`,
    trigo:   `<g stroke="${C.acc}" stroke-width="1.6" stroke-linecap="round"><line x1="32" y1="34" x2="32" y2="49"/><line x1="32" y1="42" x2="26" y2="38"/><line x1="32" y1="42" x2="38" y2="38"/><g fill="${C.acc}" stroke="none"><ellipse cx="32" cy="18" rx="2" ry="4"/><ellipse cx="27.5" cy="24" rx="1.9" ry="3.7" transform="rotate(-26 27.5 24)"/><ellipse cx="36.5" cy="24" rx="1.9" ry="3.7" transform="rotate(26 36.5 24)"/><ellipse cx="26.5" cy="31" rx="1.9" ry="3.7" transform="rotate(-30 26.5 31)"/><ellipse cx="37.5" cy="31" rx="1.9" ry="3.7" transform="rotate(30 37.5 31)"/></g></g>`,
    uva:     `<g><g stroke="${C.acc}" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M32 27 V22"/><path d="M32 22 Q37 21 40 17"/></g><g fill="${C.acc}" stroke="${C.fill}" stroke-width="0.6"><circle cx="32" cy="30" r="3.1"/><circle cx="26.5" cy="33" r="3.1"/><circle cx="37.5" cy="33" r="3.1"/><circle cx="29" cy="38" r="3.1"/><circle cx="35" cy="38" r="3.1"/><circle cx="32" cy="43" r="3.1"/></g></g>`,
    coracao: `<g><path d="M32 46 C18 36 21 24 28 24 Q32 24 32 29 Q32 24 36 24 C43 24 46 36 32 46 Z" fill="${C.fill}" stroke="${C.acc}" stroke-width="2" stroke-linejoin="round"/><path d="M32 14 C30.5 17 29.5 18.5 29.5 21 a2.5 2.5 0 0 0 5 0 C34.5 18.5 33.5 17 32 14 Z" fill="${C.acc}" stroke="none"/><line x1="32" y1="30" x2="32" y2="40" stroke="${C.acc}" stroke-width="1.6" stroke-linecap="round"/><line x1="28" y1="34" x2="36" y2="34" stroke="${C.acc}" stroke-width="1.6" stroke-linecap="round"/></g>`,
    ancora:  `<g stroke="${C.acc}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="18" r="3"/><line x1="32" y1="21" x2="32" y2="46"/><line x1="25" y1="28" x2="39" y2="28"/><path d="M21 37 Q21 47 32 47 Q43 47 43 37"/><path d="M21 37 L18 34 M21 37 L24.5 38"/><path d="M43 37 L46 34 M43 37 L39.5 38"/></g>`,
    lirio:   `<g fill="${C.acc}" stroke="none"><path d="M32 13 C30 19 30 26 32 31 C34 26 34 19 32 13 Z"/><path d="M31 31 C27 26 21 27 20 32 C19 38 25 40 30 36 C26 35 26 33 31 31 Z"/><path d="M33 31 C37 26 43 27 44 32 C45 38 39 40 34 36 C38 35 38 33 33 31 Z"/><path d="M30 33 H34 L33.2 48 C33 50 31 50 30.8 48 Z"/></g><rect x="26.5" y="32" width="11" height="3" rx="1.2" fill="${C.acc}"/><rect x="29" y="32.5" width="6" height="2" fill="${C.fill}"/>`,
    alfaomega:`<g fill="${C.acc}" stroke="none" font-family="Georgia,'Times New Roman',serif" font-weight="700"><text x="22.5" y="40" font-size="21" text-anchor="middle">Α</text><text x="42" y="40" font-size="21" text-anchor="middle">Ω</text></g>`,
    sino:    `<g stroke="${C.acc}" stroke-width="2" fill="${C.fill}" stroke-linejoin="round" stroke-linecap="round"><path d="M32 17 a2 2 0 0 1 2 2 C39.5 21 41 33 44 42 H20 C23 33 24.5 21 30 19 a2 2 0 0 1 2 -2 Z"/><line x1="18" y1="42" x2="46" y2="42" stroke-width="2.4"/><circle cx="32" cy="46.5" r="2.2" fill="${C.acc}" stroke="none"/></g>`,
    estrela: `<path d="M32 18 L35 28 L45 28 L37 34 L40 44 L32 38 L24 44 L27 34 L19 28 L29 28 Z" fill="${C.acc}"/>`,
  };
  const simb = ((spec && spec.simbolos) || []).map(k => SIMB[k] || '').join('');
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">${shield}${inner}${simb}</svg>`;
}
// Fileira de pips (diamantes dourados animados) ABAIXO do patch — usada em todo lugar que mostra o emblema.
// Retorna null se o nível não tem pips. size = tamanho do patch (escala os pips proporcionalmente).
function pipRowEl(slug, size, spec) {
  const info = (typeof nivelInfo === 'function') ? nivelInfo(slug) : { pips: 0 };
  const n = (spec && spec.pips != null) ? Number(spec.pips) : (info ? info.pips : 0);
  if (!n || n < 1) return null;
  size = size || 48;
  const ps = Math.max(5, Math.min(9, Math.round(size * 0.14)));
  const gap = Math.max(3, Math.round(size * 0.08));
  const pr = document.createElement('div');
  pr.style.cssText = `display:flex;gap:${gap}px;justify-content:center;margin-top:${Math.max(4, Math.round(size * 0.1))}px;line-height:0;`;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.className = 'emblem-pip';
    p.style.width = ps + 'px'; p.style.height = ps + 'px'; p.style.animationDelay = (i * 0.18).toFixed(2) + 's';
    pr.appendChild(p);
  }
  return pr;
}

// Spec PADRÃO de cada nível — FONTE ÚNICA de verdade (usada tanto pra desenhar o emblema atual
// quanto pra abrir o gerador "a partir do atual"). Tudo passa por _patchSvg → idêntico em todo lugar.
const _NIVEL_COMP = {
  aspirante:              { esquema:'prata', forma:'arredondada', anel:true,  simbolos:['cruz'] },
  coroinha:               { esquema:'azul',  forma:'arredondada', anel:true,  simbolos:['coroa'] },
  acolito_aspirante:      { esquema:'ouro',  forma:'arredondada', anel:false, simbolos:['cruz'] },
  acolito_guardiao:       { esquema:'ouro',  forma:'arredondada', anel:true,  simbolos:['cruz'] },
  acolito_sentinela:      { esquema:'ouro',  forma:'arredondada', anel:true,  simbolos:['espada'] },
  aspirante_cerimoniario: { esquema:'ouro',  forma:'arredondada', anel:true,  simbolos:['turibulo'] },
  cerimoniario_aspirante: { esquema:'roxo',  forma:'pontuda',     anel:false, simbolos:['turibulo'] },
  cerimoniario_guardiao:  { esquema:'roxo',  forma:'pontuda',     anel:true,  simbolos:['turibulo'] },
  cerimoniario_magistral: { esquema:'roxo',  forma:'pontuda',     anel:true,  simbolos:['espadas','turibulo'] },
  cerimoniario_mor:       { esquema:'roxo',  forma:'pontuda',     anel:true,  simbolos:['espada','turibulo','coroa'] },
};
function specPadraoNivel(slug) {
  const inf = (typeof nivelInfo === 'function') ? nivelInfo(slug) : { base:'acolito', pips:0, int:0 };
  const cer = inf.base === 'cerimonario';
  const d = _NIVEL_COMP[slug] || { esquema: cer?'roxo':'ouro', forma: cer?'pontuda':'arredondada', anel:true, simbolos:['cruz'] };
  return { esquema:d.esquema, forma:d.forma, anel:d.anel, simbolos:d.simbolos.slice(), pips:(inf.pips||0), glow:(inf.int!=null?inf.int:0) };
}
function getNivelSvg(slug, size, spec) {
  size = size || 80;
  // sem spec: usa o patch customizado salvo no nível, senão a spec PADRÃO do nível — tudo via _patchSvg
  if (!spec) { const _inf = (typeof nivelInfo === 'function') ? nivelInfo(slug) : null; spec = (_inf && _inf._patch) ? _inf._patch : specPadraoNivel(slug); }
  return _patchSvg(spec, size);
}

// Emblema do rank com animação que intensifica por nível (patch + raios + pips).
// spec opcional (gerador de patch); senão usa o _patch salvo no nível, senão o padrão por slug.
function buildRankEmblem(slug, size, spec) {
  const info = nivelInfo(slug); size = size || 80;
  spec = spec || info._patch || null;
  const intEff = (spec && spec.glow != null) ? Number(spec.glow) : info.int;
  const pipsEff = (spec && spec.pips != null) ? Number(spec.pips) : info.pips;
  const glow = 6 + intEff * 3, glow2 = 12 + intEff * 5;
  const spd = (2.5 - intEff * 0.14).toFixed(2);
  const sc = (1.05 + intEff * 0.007).toFixed(3);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:9px;';
  const core = document.createElement('div');
  core.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;line-height:0;';
  if (intEff >= 6) {
    const halo = document.createElement('div'); halo.className = 'emblem-halo';
    halo.style.cssText = `position:absolute;top:50%;left:50%;width:${Math.round(size*1.55)}px;height:${Math.round(size*1.55)}px;transform:translate(-50%,-50%);z-index:0;`;
    for (let k = 0; k < 3; k++) { const ring = document.createElement('i'); ring.style.animationDelay = (k * 0.8) + 's'; halo.appendChild(ring); }
    core.appendChild(halo);
  }
  const pdiv = document.createElement('div');
  pdiv.style.cssText = `position:relative;z-index:1;line-height:0;--glow:${glow}px;--glow2:${glow2}px;--spd:${spd}s;--sc:${sc};animation:emblemPulse var(--spd) ease-in-out infinite;`;
  pdiv.innerHTML = getNivelSvg(slug, size, spec); // SVG controlado (spec do gerador ou padrão)
  core.appendChild(pdiv);
  wrap.appendChild(core);
  const pr = pipRowEl(slug, size, spec); if (pr) wrap.appendChild(pr); // pips animados abaixo do logo
  return wrap;
}

// Bloco de nome com apelido em destaque + nome menor embaixo.
// Sem apelido, mostra só o nome (em destaque, na classe primária).
// trailing (opcional): elemento que vai INLINE na linha principal (apelido, ou
// nome se não houver apelido) — ex.: badge de estrelas. center=true centraliza
// a linha principal (usado em cards).
function nameBlock(nome, apelido, primaryClass, secondaryClass, trailing, center) {
  const wrap = document.createElement('div'); wrap.className = 'name-block';
  const ap = (apelido || '').trim();
  const primaryText = ap || (nome || '');
  const prim = document.createElement('div'); prim.className = primaryClass;
  if (trailing) {
    prim.style.display = 'flex'; prim.style.alignItems = 'center'; prim.style.gap = '5px';
    if (center) prim.style.justifyContent = 'center';
    const txt = document.createElement('span'); txt.textContent = primaryText;
    txt.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    prim.append(txt, trailing);
  } else {
    prim.textContent = primaryText;
  }
  wrap.append(prim);
  if (ap) { const n = document.createElement('div'); n.className = secondaryClass; n.textContent = nome || ''; wrap.append(n); }
  return wrap;
}

// ── ESTRELAS (micro-progressão visível para todos) ─────────────────────────
// Cache em memória de membro_id -> nº de estrelas, populado em lote via RPC
// pública acolitos_estrelas_lote. Visível a todos (qualquer membro vê as
// estrelas de qualquer outro nas listas / destaques).
const _estrelasCache = {};
async function acEstrelasLote(ids) {
  const faltam = (ids || []).filter(id => id && _estrelasCache[id] === undefined);
  if (faltam.length) {
    try {
      const { data } = await sb.rpc('acolitos_estrelas_lote', { p_membros: faltam });
      if (data && typeof data === 'object') {
        faltam.forEach(id => { _estrelasCache[id] = Number(data[id]) || 0; });
      }
    } catch (e) {}
  }
  const out = {};
  (ids || []).forEach(id => { out[id] = _estrelasCache[id] || 0; });
  return out;
}
// Badge compacto de estrelas (inline). n=0 retorna elemento vazio (sem ocupar
// espaço). Mostra até 5 ⭐ e "×N" quando passa disso.
function estrelaTag(n) {
  const el = document.createElement('span'); el.className = 'estrela-tag';
  n = Number(n) || 0;
  if (n > 0) el.textContent = '⭐'.repeat(Math.min(n, 5)) + (n > 5 ? '×' + n : '');
  return el;
}
// Atalho: já cria o badge e o preenche assincronamente a partir do cache/RPC.
function estrelaTagAsync(membroId) {
  const el = estrelaTag(0);
  if (membroId) (async () => {
    const mapa = await acEstrelasLote([membroId]);
    const n = mapa[membroId] || 0;
    if (n > 0) el.textContent = '⭐'.repeat(Math.min(n, 5)) + (n > 5 ? '×' + n : '');
  })();
  return el;
}

// Retorna HTMLElement (div container) com foto + patch sobreposto.
// opts (opcional): { editable, membro, onUpload } — quando editable, mostra um
// badge de câmera no canto inferior esquerdo que abre o seletor de arquivo e
// envia a foto via uploadAvatar(). onUpload(url) é chamado após sucesso.
function buildAvatarEl(fotoUrl, role, size, opts) {
  size = size || 56;
  opts = opts || {};
  const container = document.createElement('div');
  container.style.cssText = `position:relative;width:${size}px;height:${size}px;display:inline-block;`;

  function renderFoto(src) {
    const safeSrc = sanitizeUrl(src);
    if (safeSrc) {
      const img = document.createElement('img');
      img.src = escHtml(safeSrc);
      img.alt = '';
      img.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--border-wine);display:block;`;
      return img;
    }
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:var(--surface2);border:2px solid var(--border-wine);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size/2.5)}px;`;
    placeholder.textContent = '👤';
    return placeholder;
  }

  let fotoEl = renderFoto(fotoUrl);
  container.appendChild(fotoEl);

  const patchSize = Math.round(size * 0.42);
  const patchEl = document.createElement('div');
  patchEl.style.cssText = `position:absolute;bottom:-4px;right:-4px;line-height:0;`;
  // Usa o emblema do NÍVEL na jornada quando informado (opts.nivelSlug); senão, patch por papel
  patchEl.innerHTML = opts.nivelSlug ? getNivelSvg(opts.nivelSlug, patchSize) : getPatchSvg(getRoleForPatch(role), patchSize); // hardcoded SVG — seguro
  container.appendChild(patchEl);

  if (opts.editable && opts.membro) {
    const camSize = Math.max(16, Math.round(size * 0.24));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // sem 'capture': no celular abre o seletor nativo (galeria/Fotos + câmera)
    input.style.display = 'none';

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.title = 'Trocar foto';
    badge.textContent = '✎';
    badge.style.cssText = `position:absolute;bottom:0;left:0;width:${camSize}px;height:${camSize}px;border-radius:50%;border:1px solid var(--border-wine);background:rgba(18,9,11,.82);color:var(--gold-dim);font-size:${Math.round(camSize*0.62)}px;line-height:0;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;z-index:2;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);`;
    badge.onclick = () => input.click();

    input.onchange = () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      openCropper(file, async (croppedFile) => {
        const prev = badge.textContent;
        badge.textContent = '…'; badge.disabled = true;
        try {
          const url = await uploadAvatar(croppedFile, opts.membro);
          const novo = renderFoto(url);
          container.replaceChild(novo, fotoEl);
          fotoEl = novo;
          if (typeof opts.onUpload === 'function') opts.onUpload(url);
        } catch (err) {
          await uiAlert('Não foi possível enviar a foto. ' + (err?.message || ''));
        } finally {
          badge.textContent = prev; badge.disabled = false;
        }
      });
    };

    container.append(badge, input);
  }

  return container;
}

// ── INDICADORES / FREQUÊNCIA ─────────────────────────────────
// Sem membroId: retorna mapa { membro_id: row }. Com membroId: retorna a row (ou null).
async function fetchFrequencia(membroId) {
  let q = sb.from('acolitos_frequencia').select('*');
  if (membroId) q = q.eq('membro_id', membroId).maybeSingle();
  const { data } = await q;
  if (membroId) return data || null;
  const map = {};
  (data || []).forEach(r => { map[r.membro_id] = r; });
  return map;
}

// ── UPLOAD DE AVATAR (Supabase Storage) ──────────────────────
// Dono envia para {uid}/...; equipe envia para membro/{id}/... (políticas em 004).
async function uploadAvatar(file, membro) {
  if (!file || !membro) throw new Error('Arquivo ou membro ausente.');
  const { data: { session } } = await sb.auth.getSession();
  const uid = session?.user?.id;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const isSelf = !!(membro.user_id && membro.user_id === uid);
  const folder = isSelf ? uid : ('membro/' + membro.id);
  const path = `${folder}/avatar_${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage.from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (upErr) throw upErr;

  const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url) throw new Error('URL pública indisponível.');

  const { error: updErr } = await sb.from('acolitos_membros')
    .update({ foto_url: url }).eq('id', membro.id);
  if (updErr) throw updErr;

  membro.foto_url = url; // mantém cache local em sincronia
  return url;
}

// ── CROPPER DE FOTO (recorte circular antes do upload) ───────
function openCropper(file, onConfirm) {
  const objUrl = URL.createObjectURL(file);
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;';
  const title = document.createElement('div');
  title.style.cssText = "font-family:'Sora',sans-serif;font-weight:700;color:var(--gold-light,#ffd97a);letter-spacing:1.5px;text-transform:uppercase;font-size:13px;";
  title.textContent = 'Ajuste a foto';
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#b88a8f;font-weight:600;margin-top:-10px;';
  hint.textContent = 'Arraste para posicionar · use o zoom';

  const F = Math.min(300, window.innerWidth - 56, window.innerHeight - 240);
  const frame = document.createElement('div');
  frame.style.cssText = `position:relative;width:${F}px;height:${F}px;overflow:hidden;border-radius:50%;border:2px solid var(--gold,#e8b94a);box-shadow:0 0 30px rgba(255,38,54,.5);touch-action:none;background:#000;cursor:grab;`;
  const img = document.createElement('img');
  img.style.cssText = 'position:absolute;will-change:left,top;pointer-events:none;-webkit-user-drag:none;';
  img.src = objUrl; frame.appendChild(img);

  const zoomWrap = document.createElement('div'); zoomWrap.style.cssText = `display:flex;align-items:center;gap:10px;width:${F}px;`;
  const zi = document.createElement('span'); zi.textContent = '🔍'; zi.style.fontSize = '14px';
  const zoom = document.createElement('input'); zoom.type = 'range'; zoom.min = '1'; zoom.max = '3'; zoom.step = '0.01'; zoom.value = '1';
  zoom.style.cssText = 'flex:1;accent-color:var(--red-soft,#ff4654);';
  zoomWrap.append(zi, zoom);

  const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:10px;';
  const cancel = document.createElement('button'); cancel.className = 'btn-sm gray'; cancel.textContent = 'Cancelar';
  const ok = document.createElement('button'); ok.className = 'btn-sm gold'; ok.textContent = 'Cortar e enviar';
  btns.append(cancel, ok);
  ov.append(title, hint, frame, zoomWrap, btns); document.body.appendChild(ov);

  let nw = 0, nh = 0, base = 1, scale = 1, tx = 0, ty = 0, dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
  const dims = () => ({ dw: nw * scale, dh: nh * scale });
  function clamp() { const { dw, dh } = dims(); tx = Math.min(0, Math.max(F - dw, tx)); ty = Math.min(0, Math.max(F - dh, ty)); }
  function apply() { const { dw, dh } = dims(); img.style.width = dw + 'px'; img.style.height = dh + 'px'; img.style.left = tx + 'px'; img.style.top = ty + 'px'; }

  img.onload = () => {
    nw = img.naturalWidth; nh = img.naturalHeight;
    base = Math.max(F / nw, F / nh); scale = base;
    zoom.min = String(base); zoom.max = String(base * 3); zoom.step = String((base * 2) / 100); zoom.value = String(base);
    const { dw, dh } = dims(); tx = (F - dw) / 2; ty = (F - dh) / 2; apply();
  };
  zoom.oninput = () => {
    const ns = parseFloat(zoom.value), cx = F / 2, cy = F / 2;
    tx = cx - (cx - tx) * (ns / scale); ty = cy - (cy - ty) * (ns / scale);
    scale = ns; clamp(); apply();
  };
  const onStart = (x, y) => { dragging = true; sx = x; sy = y; stx = tx; sty = ty; frame.style.cursor = 'grabbing'; };
  const onMove = (x, y) => { if (!dragging) return; tx = stx + (x - sx); ty = sty + (y - sy); clamp(); apply(); };
  const onEnd = () => { dragging = false; frame.style.cursor = 'grab'; };
  function mm(e) { if (e.touches) { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); } else onMove(e.clientX, e.clientY); }
  frame.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
  frame.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) onStart(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('mousemove', mm); window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', mm, { passive: true }); window.addEventListener('touchend', onEnd);

  function cleanup() {
    URL.revokeObjectURL(objUrl); ov.remove();
    window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', mm); window.removeEventListener('touchend', onEnd);
  }
  cancel.onclick = cleanup;
  ok.onclick = () => {
    const target = 400, canvas = document.createElement('canvas');
    canvas.width = target; canvas.height = target;
    const c = canvas.getContext('2d');
    c.drawImage(img, -tx / scale, -ty / scale, F / scale, F / scale, 0, 0, target, target);
    canvas.toBlob(blob => {
      cleanup();
      if (blob) onConfirm(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };
}

// ── PATCH POR HABILITAÇÃO ────────────────────────────────────
// Deriva o nível (para o patch do avatar) a partir do mapa de habilitações
// { funcao: proficiencia } quando o role real não está disponível.
function patchRoleFromHabs(habs) {
  habs = habs || {};
  const apt = f => ['apto','experiente','referencia'].includes(habs[f]);
  if (apt('cred_credencia') || apt('cred_altar') || apt('missal')) return 'cerimonario';
  if (apt('altar') || apt('turibulo') || apt('naveta')) return 'acolito';
  if (apt('cruz') || apt('vela') || apt('sineta') || apt('sinao')) return 'coroinha';
  return 'aspirante';
}

// ── GRÁFICO DE PRESENÇA (6 meses) ────────────────────────────
// Recebe linhas de acolitos_escalas com acolitos_celebracoes(data) embutido.
// Retorna um elemento DOM (barras servidas vs faltas + legenda), estilos inline
// para ser portátil entre páginas. Usado no dashboard e na ficha do membro.
const _MES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function buildPresencaChart(escalas) {
  const buckets = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    buckets[k] = { serv: 0, falt: 0, mes: _MES_ABREV[d.getMonth()] };
  }
  (escalas || []).forEach(e => {
    const data = e.acolitos_celebracoes?.data; if (!data) return;
    const k = data.slice(0, 7); if (!buckets[k]) return;
    if (['presente','atrasado'].includes(e.status)) buckets[k].serv++;
    else if (['ausente','ausente_justificado'].includes(e.status)) buckets[k].falt++;
  });
  const arr = Object.values(buckets);
  const max = Math.max(1, ...arr.map(b => Math.max(b.serv, b.falt)));
  const total = arr.reduce((a, b) => a + b.serv + b.falt, 0);

  const box = document.createElement('div');
  if (!total) {
    box.style.cssText = 'color:var(--text-muted);font-size:12px;font-style:italic;text-align:center;padding:12px 0;';
    box.textContent = 'Sem chamadas registradas ainda.';
    return box;
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:flex-end;gap:6px;height:116px;';
  const H = 72; // altura máx. da barra (deixa espaço pro rótulo numérico em cima)
  const barCol = (val, cor, corNum) => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;';
    const num = document.createElement('div');
    num.style.cssText = 'font-size:9px;font-weight:700;line-height:1;margin-bottom:2px;color:' + corNum + ';';
    num.textContent = val > 0 ? val : '';
    const bar = document.createElement('div');
    bar.style.cssText = 'width:11px;border-radius:2px 2px 0 0;min-height:2px;background:' + cor + ';height:' + (val / max * H) + 'px;';
    col.append(num, bar); return col;
  };
  arr.forEach(b => {
    const g = document.createElement('div');
    g.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;';
    const pair = document.createElement('div');
    pair.style.cssText = 'display:flex;gap:3px;align-items:flex-end;height:88px;';
    pair.append(barCol(b.serv, 'var(--gold)', 'var(--gold-light)'), barCol(b.falt, 'var(--wine)', 'var(--wine-bright,#d45050)'));
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;color:var(--text-muted);font-family:Sora,sans-serif;margin-top:5px;text-transform:uppercase;';
    lbl.textContent = b.mes;
    g.append(pair, lbl); row.appendChild(g);
  });
  box.appendChild(row);

  const leg = document.createElement('div');
  leg.style.cssText = 'display:flex;gap:16px;justify-content:center;margin-top:12px;';
  [['var(--gold)','Servidas'], ['var(--wine)','Faltas']].forEach(([col, txt]) => {
    const it = document.createElement('div');
    it.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-muted);';
    const dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:2px;background:' + col + ';';
    const sp = document.createElement('span'); sp.textContent = txt;
    it.append(dot, sp); leg.appendChild(it);
  });
  box.appendChild(leg);
  return box;
}

// ── Central de Relatórios (impressão/PDF + CSV) ──
function relEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function relTabela(headers, rows){
  const th = headers.map(h=>'<th>'+relEsc(h)+'</th>').join('');
  const tb = rows.map(r=>'<tr>'+r.map(c=>{
    if(c && typeof c==='object') return '<td style="background:'+(c.bg||'transparent')+'">'+relEsc(c.t)+'</td>';
    return '<td>'+relEsc(c)+'</td>';
  }).join('')+'</tr>').join('');
  return '<table class="rel"><thead><tr>'+th+'</tr></thead><tbody>'+tb+'</tbody></table>';
}
// Confirmação com modal bonito (Promise<boolean>) — substitui o confirm() nativo
function uiConfirm(message, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    const ov=document.createElement('div'); ov.className='modal-overlay open';
    const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='400px';
    const msg=document.createElement('p'); msg.style.cssText='font-size:14px;color:var(--text);line-height:1.5;white-space:pre-line;margin:0 0 16px;'; msg.textContent=message;
    const acts=document.createElement('div'); acts.style.cssText='display:flex;gap:8px;';
    const no=document.createElement('button'); no.className='btn-sm gray'; no.style.flex='1'; no.textContent=opts.cancel||'Cancelar';
    const yes=document.createElement('button'); yes.className='btn-sm gold'; yes.style.flex='1'; yes.textContent=opts.ok||'Confirmar';
    let dn=false; function done(v){ if(dn)return; dn=true; ov.remove(); resolve(v); }
    ov._acResolveClose = function(){ done(false); }; // Voltar/gesto fecha == cancelar (evita Promise pendurada)
    no.onclick=function(){ done(false); }; yes.onclick=function(){ done(true); };
    ov.onclick=function(e){ if(e.target===ov) done(false); };
    acts.append(no, yes); md.append(msg, acts); ov.appendChild(md); document.body.appendChild(ov);
  });
}
// Alerta com modal bonito (Promise) — substitui o alert() nativo
function uiAlert(message, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    const ov=document.createElement('div'); ov.className='modal-overlay open';
    const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='400px';
    const msg=document.createElement('p'); msg.style.cssText='font-size:14px;color:var(--text);line-height:1.5;white-space:pre-line;margin:0 0 16px;'; msg.textContent=message;
    const ok=document.createElement('button'); ok.className='btn-sm gold'; ok.style.width='100%'; ok.textContent=opts.ok||'OK';
    let dn=false; function done(){ if(dn)return; dn=true; ov.remove(); resolve(); }
    ov._acResolveClose = done; // Voltar/gesto fecha == OK (evita Promise pendurada)
    ok.onclick=done; ov.onclick=function(e){ if(e.target===ov) done(); };
    md.append(msg, ok); ov.appendChild(md); document.body.appendChild(ov);
  });
}
// Prompt com modal bonito (Promise<string|null>) — substitui o prompt() nativo
function uiPrompt(message, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    const ov=document.createElement('div'); ov.className='modal-overlay open';
    const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='400px';
    const msg=document.createElement('p'); msg.style.cssText='font-size:14px;color:var(--text);line-height:1.5;white-space:pre-line;margin:0 0 10px;'; msg.textContent=message;
    const inp=document.createElement('input'); inp.className='form-input'; inp.style.width='100%'; inp.value=opts.value||'';
    const acts=document.createElement('div'); acts.style.cssText='display:flex;gap:8px;margin-top:14px;';
    const no=document.createElement('button'); no.className='btn-sm gray'; no.style.flex='1'; no.textContent=opts.cancel||'Cancelar';
    const yes=document.createElement('button'); yes.className='btn-sm gold'; yes.style.flex='1'; yes.textContent=opts.ok||'OK';
    let dn=false; function done(v){ if(dn)return; dn=true; ov.remove(); resolve(v); }
    ov._acResolveClose = function(){ done(null); }; // Voltar/gesto fecha == cancelar (evita Promise pendurada)
    no.onclick=function(){ done(null); }; yes.onclick=function(){ done(inp.value); };
    inp.onkeydown=function(e){ if(e.key==='Enter') done(inp.value); };
    ov.onclick=function(e){ if(e.target===ov) done(null); };
    acts.append(no, yes); md.append(msg, inp, acts); ov.appendChild(md); document.body.appendChild(ov);
    setTimeout(function(){ inp.focus(); }, 50);
  });
}
function abrirRelatorio(opts){
  const o = opts || {};
  const hoje = new Date().toLocaleDateString('pt-BR');
  const css = '<style>'
    + '*{ -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box; }'
    + 'body{ font-family:Georgia,serif; color:#1c1c1c; margin:0; padding:18px; }'
    + 'h1{ font-size:20px; margin:0; } h2{ font-size:15px; border-bottom:2px solid #8a6a24; color:#7a5a14; margin:22px 0 8px; } h3{ font-size:12px; margin:12px 0 4px; color:#333; }'
    + '.rel-hd{ display:flex; align-items:center; gap:12px; border-bottom:3px solid #8a6a24; padding-bottom:10px; }'
    + '.rel-hd img{ height:54px; } .rel-hd .sub{ font-size:11px; color:#666; }'
    + 'table{ border-collapse:collapse; width:100%; font-size:11px; margin:4px 0 10px; } th,td{ border:1px solid #bbb; padding:3px 6px; text-align:left; }'
    + 'td.nm{ white-space:nowrap; } .muted{ color:#777; font-size:11px; } .dev{ margin:6px 0; font-size:12px; }'
    + '.leg span{ display:inline-block; padding:1px 6px; border:1px solid #bbb; border-radius:3px; } tr.warn td{ font-weight:bold; color:#b00; }'
    + '@page{ margin:12mm; }'
    + (o.css||'')
    + '</style>';
  const cab = '<div class="rel-hd"><img src="'+location.origin+'/midia/logos/brasao-pastoral.png" onerror="this.style.display=\'none\'"><div><h1>'+relEsc(o.titulo||'Relatório')+'</h1><div class="sub">'+relEsc(o.subtitulo||'')+' · '+hoje+'</div></div></div>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+relEsc(o.titulo||'Relatório')+'</title>'+css+'</head><body>'+cab+(o.corpo||'')+'</body></html>';
  // Imprime via iframe oculto na própria página (não abre janela/aba — evita "prender" o app no iOS/PWA)
  const ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden','true');
  ifr.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
  ifr.onload = function(){
    setTimeout(function(){ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){} }, 300);
    try{ ifr.contentWindow.onafterprint = function(){ if(ifr.parentNode) ifr.remove(); }; }catch(e){}
    setTimeout(function(){ if(ifr.parentNode) ifr.remove(); }, 120000);
  };
  ifr.srcdoc = html;
  document.body.appendChild(ifr);
}
function baixarCSV(nomeBase, linhas){
  const esc=s=>{ s=String(s==null?'':s); return /[";\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const csv='﻿'+(linhas||[]).map(r=>r.map(esc).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=(nomeBase||'relatorio')+'-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url); toast('✓ CSV gerado');
}

// ── ARRASTAR-PARA-FECHAR (bottom-sheet no mobile) ──────────────
// Delegado no document: funciona p/ qualquer .modal-handle, inclusive modais
// criados dinamicamente. Modais com id (ex.: modal-ficha) só fecham (remove
// 'open'); modais dinâmicos são removidos do DOM.
(function () {
  let modal = null, overlay = null, startY = 0, curY = 0, dragging = false;
  function fechar(ov) {
    if (!ov) return;
    if (typeof ov._acResolveClose === 'function') { ov._acResolveClose(); return; } // ui* pendente: resolve a Promise (não só remove)
    if (ov.id) ov.classList.remove('open'); else ov.remove();
  }
  document.addEventListener('touchstart', (e) => {
    const h = e.target.closest && e.target.closest('.modal-handle');
    if (!h) return;
    modal = h.closest('.modal'); overlay = h.closest('.modal-overlay');
    if (!modal) return;
    dragging = true; startY = curY = e.touches[0].clientY;
    modal.style.transition = 'none';
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!dragging || !modal) return;
    curY = e.touches[0].clientY;
    const dy = Math.max(0, curY - startY);
    modal.style.transform = 'translateY(' + dy + 'px)';
    if (overlay) overlay.style.background = 'rgba(0,0,0,' + Math.max(0.4, 0.88 - dy / 600) + ')';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!dragging || !modal) return;
    dragging = false;
    const dy = curY - startY;
    modal.style.transition = 'transform .25s ease';
    modal.style.transform = '';
    if (overlay) overlay.style.background = '';
    if (dy > 110) fechar(overlay);
    modal = null; overlay = null;
  });
})();

// ── FECHAR/VOLTAR CONSISTENTE EM TODO MODAL (✕ no canto + tecla Esc) ──
(function () {
  function closeOverlay(ov) { if (!ov) return; if (typeof ov._acResolveClose === 'function') { ov._acResolveClose(); return; } if (ov.id) ov.classList.remove('open'); else ov.remove(); }
  function ensureClose(modal) {
    if (!modal || modal.querySelector(':scope > .modal-close')) return;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'modal-close'; x.setAttribute('aria-label', 'Fechar'); x.title = 'Fechar'; x.textContent = '✕';
    x.onclick = () => closeOverlay(modal.closest('.modal-overlay') || modal.parentElement);
    modal.appendChild(x);
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.classList && root.classList.contains('modal')) ensureClose(root);
    if (root.querySelectorAll) root.querySelectorAll('.modal').forEach(ensureClose);
  }
  new MutationObserver((muts) => {
    muts.forEach(m => m.addedNodes.forEach(scan));
  }).observe(document.documentElement, { childList: true, subtree: true });
  const init = () => scan(document.body || document.documentElement);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const opens = [...document.querySelectorAll('.modal-overlay.open')];
    if (opens.length) closeOverlay(opens[opens.length - 1]);
  });
})();

// ── Histórico de modal: o Voltar do navegador/gesto fecha o modal aberto ──
// Transparente e app-wide: observa .modal-overlay.open no DOM (cobre modais fixos e
// dinâmicos), empilha um estado no history ao abrir, e no popstate fecha o topo.
// Spec D · Fase 1. Opt-out: overlays com [data-no-history] não entram no histórico
// (nenhum overlay do shared.js precisou disso — celebração/PWA/cropper usam outras
// classes, não .modal-overlay; ver relatório em .superpowers/sdd/nav-f1-report.md).
(function modalHistory(){
  'use strict';
  if (window.__acModalHistory) return; window.__acModalHistory = true;

  var stack = [];          // overlays abertos, na ordem (LIFO)
  var pendingBacks = 0;    // nº de history.back() nossos ainda não consumidos por um popstate
  // (contador, não boolean: quando 2+ overlays fecham no mesmo tick — ex. uiConfirm
  // sobre um modal-avancar, confirmar fecha os dois de uma vez — cada onClose dispara
  // seu próprio back(); um boolean deixaria os subsequentes "perdidos" e o popstate real
  // só consumiria 1, sobrando estados fantasma no histórico.)

  function isOpen(ov){ return ov && ov.classList && ov.classList.contains('open') && ov.classList.contains('modal-overlay'); }
  function optedOut(ov){ return ov.hasAttribute && ov.hasAttribute('data-no-history'); }

  function onOpen(ov){
    if (optedOut(ov) || stack.indexOf(ov) !== -1) return;
    try {
      history.pushState({ acmodal: true, depth: stack.length + 1 }, '');
      stack.push(ov); // só entra na pilha se o pushState realmente aconteceu
    } catch(e){}
  }

  // Chamado quando um modal deixou de estar aberto por QUALQUER via (X, fundo, Esc, programático, .open removido).
  function onClose(ov){
    var i = stack.indexOf(ov);
    if (i === -1) return;
    stack.splice(i, 1);
    // Fechamento manual/programático (não veio de um popstate do usuário): descartamos
    // o estado empilhado. Cada onClose soma seu próprio back() ao contador — o popstate
    // handler consome exatamente um por vez, então N closes no mesmo tick = N backs = N consumos.
    pendingBacks++;
    try { history.back(); } catch(e){ pendingBacks--; }
  }

  // Fecha visualmente um overlay a pedido do Voltar (cobre os dois padrões + ui* com Promise pendente).
  function closeOverlay(ov){
    if (!ov) return;
    if (typeof ov._acResolveClose === 'function') { ov._acResolveClose(); return; } // uiConfirm/uiAlert/uiPrompt: resolve como cancelar/OK
    if (ov.classList.contains('open')) ov.classList.remove('open');
    if (ov.parentNode && !ov.classList.contains('open') && ov.dataset.acmodalDynamic === '1') {
      ov.parentNode.removeChild(ov);
    }
  }

  window.addEventListener('popstate', function(){
    if (pendingBacks > 0) {              // consome um dos nossos history.back() (X/fundo/Esc/programático)
      pendingBacks--;
      return;
    }
    // Voltar do usuário: se há modal aberto, fecha o topo e NÃO deixa a navegação prosseguir "vazia".
    // Não chamamos back() aqui — é o próprio Back do usuário que está sendo consumido.
    if (stack.length) {
      var ov = stack[stack.length - 1];
      stack.pop();
      closeOverlay(ov);
    }
    // se stack vazio: navegação normal (não intervimos).
  });

  // Observa o DOM inteiro: entra/sai .open e nós adicionados/removidos.
  var mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      if (m.type === 'attributes' && m.target && m.target.classList && m.target.classList.contains('modal-overlay')) {
        if (isOpen(m.target)) onOpen(m.target); else onClose(m.target);
      }
      if (m.type === 'childList') {
        m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function(n){
          if (n.nodeType===1 && n.classList && n.classList.contains('modal-overlay')) {
            n.dataset.acmodalDynamic = '1';           // criado dinamicamente (fecha com remove() completo, não só classList)
            if (isOpen(n)) onOpen(n);
          }
        });
        // Assume: .modal-overlay é sempre removido DIRETAMENTE (não dentro de um container
        // pai também removido). m.removedNodes só lista os nós de topo removidos — se um
        // overlay algum dia for aninhado dentro de outro elemento e o pai inteiro for
        // desmontado de uma vez, este ramo não vê o overlay e o estado dele fica órfão
        // na pilha. Hoje todo overlay dinâmico é anexado direto em document.body, então
        // não ocorre; um novo call-site que aninhe overlay precisa revisar isto.
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

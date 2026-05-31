/* shared.js — módulo Acólitos e Coroinhas */

// ── SUPABASE ─────────────────────────────────────────────────
const SUPABASE_URL = 'https://fttjgsotuosjfrasttds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGpnc290dW9zamZyYXN0dGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzU3NjUsImV4cCI6MjA5NTExMTc2NX0.BvofcR2cIXP7Bc3r2V0VOgc-JXPefX7JGGwtzv0d_eA';

// Apenas anon key no browser. Autorização feita via RLS no banco.
// service_role key pertence somente a Edge Functions (variável de ambiente no servidor).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sbAdmin = sb; // alias — todas as operações elevadas são via RLS com o JWT do usuário

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
async function initModulo(requiredRoles = null) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }

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

  // Busca ficha do membro
  const { data: membro } = await sb
    .from('acolitos_membros').select('*').eq('user_id', session.user.id).maybeSingle();

  return { user: session.user, membership, membro };
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

  actions.append(contaBtn, sairBtn);
  el.appendChild(actions);
}

// ── MINHA CONTA (autosserviço: trocar próprio usuário/senha/nome) ──
async function meUpdate(action, payload, btn, msgEl) {
  const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Aguarde...';
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch('/api/me-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify({ action, ...payload })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Erro');
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

  // Foto + patch (editável) — só para membros
  if (ctx && ctx.membro) {
    const avWrap = document.createElement('div'); avWrap.style.cssText = 'display:flex;justify-content:center;margin:2px 0 18px;';
    avWrap.appendChild(buildAvatarEl(ctx.membro.foto_url, ctx.membership.role, 96, {
      editable: true, membro: ctx.membro,
      nivelSlug: ctx.membro.nivel || nivelFromRole(ctx.membership.role),
      onUpload: (url) => { ctx.membro.foto_url = url; }
    }));
    modal.appendChild(avWrap);
  }

  const msgEl = document.createElement('div'); msgEl.id = 'conta-msg'; msgEl.className = 'msg';

  // Apelido (aparece em destaque acima do nome) — só para membros
  if (ctx && ctx.membro) {
    const ga = document.createElement('div'); ga.className = 'form-group';
    const la = document.createElement('label'); la.className = 'form-label'; la.textContent = 'Apelido (aparece em destaque)';
    const ia = document.createElement('input'); ia.className = 'form-input'; ia.value = ctx.membro.apelido || ''; ia.placeholder = 'como querem te chamar';
    const ba = document.createElement('button'); ba.className = 'btn-sm gold'; ba.style.marginTop = '8px'; ba.textContent = 'Salvar apelido';
    ba.onclick = async () => {
      ba.disabled = true; ba.textContent = 'Salvando...';
      const { error } = await sb.from('acolitos_membros').update({ apelido: ia.value.trim() || null }).eq('id', ctx.membro.id);
      ba.disabled = false; ba.textContent = 'Salvar apelido';
      if (error) { msgEl.className = 'msg error'; msgEl.textContent = 'Erro ao salvar apelido.'; }
      else { ctx.membro.apelido = ia.value.trim() || null; msgEl.className = 'msg success'; msgEl.textContent = 'Apelido salvo!'; }
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
// Módulos que o admin pode liberar por pessoa (key, label, href). Hoje só os existentes.
const MODULOS_LIBERAVEIS = [
  ['escala','Escala','escala.html'], ['membros','Membros','membros.html'],
  ['crm','Integração (CRM)','crm.html'], ['chamada','Chamada','chamada.html'],
];

// ── BOTTOM NAV ────────────────────────────────────────────────
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];

const NAV_EQUIPE = [
  { id:'home',    href:'index.html',   label:'Início',  icon:'home' },
  { id:'membros', href:'membros.html', label:'Membros', icon:'users' },
  { id:'escala',  href:'escala.html',  label:'Escala',  icon:'calendar' },
  { id:'crm',     href:'crm.html',     label:'CRM',     icon:'shuffle' },
];
const NAV_MEMBRO = [
  { id:'home',      href:'index.html',     label:'Início',   icon:'home' },
  { id:'ausencias', href:'ausencias.html', label:'Ausência', icon:'x-circle' },
  { id:'chamada',   href:'chamada.html',   label:'Chamada',  icon:'message-circle' },
];

function _svgIcon(name) {
  const d = {
    home:           'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    users:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    shuffle:        'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
    calendar:       'M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
    'x-circle':     'M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0z M15 9l-6 6 M9 9l6 6',
    'message-circle':'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  };
  return `<svg viewBox="0 0 24 24"><path d="${d[name] || ''}"/></svg>`;
}

function renderBottomNav(role, activePage, nivel) {
  const el = document.getElementById('app-nav');
  if (!el) return;
  el.className = 'app-nav';
  el.textContent = '';
  // Chamada aparece para quem está em NÍVEL de cerimoniário (decoupled do role);
  // equipe usa NAV_EQUIPE; aspirante/coroinha/acólito não veem chamada.
  const isCerimo = nivelInfo(nivel || nivelFromRole(role)).base === 'cerimonario';
  let items;
  if (EQUIPE_ROLES.includes(role)) items = NAV_EQUIPE;
  else if (isCerimo || role === 'cerimonario') items = NAV_MEMBRO;
  else items = NAV_MEMBRO.filter(i => i.id !== 'chamada');
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
function getNivelSvg(slug, size) {
  size = size || 80; const s = String(size);
  if (slug === 'aspirante') return getPatchSvg('aspirante', size);
  if (slug === 'coroinha')  return getPatchSvg('coroinha', size);
  const cer = nivelInfo(slug).base === 'cerimonario';
  const C = cer
    ? { fill:'#1c0b2e', edge:'#9b59d4', edge2:'#5a1a9a', acc:'#d8b3ff' }
    : { fill:'#2a1a00', edge:'#e8b94a', edge2:'#7a5800', acc:'#ffe08a' };

  const shieldA = `<path d="M13 14 H51 V38 Q51 54 32 62 Q13 54 13 38 Z" fill="${C.fill}" stroke="${C.edge}" stroke-width="2.6"/>`;
  const shieldB = `<path d="M32 8 L51 15 V38 Q51 54 32 62 Q13 54 13 38 V15 Z" fill="${C.fill}" stroke="${C.edge}" stroke-width="2.6"/>`;
  const innerA  = `<path d="M18 19 H46 V37 Q46 50 32 57 Q18 50 18 37 Z" fill="none" stroke="${C.edge2}" stroke-width="1.3"/>`;
  const innerB  = `<path d="M32 13 L46 19 V37 Q46 50 32 57 Q18 50 18 37 V19 Z" fill="none" stroke="${C.edge2}" stroke-width="1.3"/>`;
  const cross   = `<g stroke="${C.acc}" stroke-width="3" stroke-linecap="round"><line x1="32" y1="25" x2="32" y2="45"/><line x1="23" y1="33" x2="41" y2="33"/></g>`;
  const sword   = `<g stroke="${C.acc}" stroke-linecap="round"><line x1="32" y1="22" x2="32" y2="44" stroke-width="3.2"/><line x1="25" y1="40" x2="39" y2="40" stroke-width="2.4"/><circle cx="32" cy="48" r="2.3" fill="${C.acc}" stroke="none"/></g>`;
  const swords  = `<g stroke="${C.acc}" stroke-width="2.6" stroke-linecap="round"><line x1="22" y1="48" x2="43" y2="24"/><line x1="42" y1="48" x2="21" y2="24"/></g>`;
  const thurible= `<g stroke="${C.acc}" stroke-width="1.8" fill="none" stroke-linecap="round"><circle cx="32" cy="18" r="1.9"/><line x1="31" y1="19.5" x2="28" y2="29"/><line x1="33" y1="19.5" x2="36" y2="29"/><path d="M27 29 H37 L35.5 33 H28.5 Z" fill="${C.fill}"/><path d="M28 33 Q28 43 32 43 Q36 43 36 33" fill="${C.fill}"/><line x1="29" y1="37" x2="35" y2="37"/><circle cx="32" cy="46" r="1.3" fill="${C.acc}" stroke="none"/></g>`;
  const crown   = `<g fill="${C.acc}" stroke="${C.edge2}" stroke-width="0.6" stroke-linejoin="round"><path d="M20 12 L23 4 L28 9 L32 2 L36 9 L41 4 L44 12 Z"/></g>`;

  const map = {
    acolito_aspirante:      shieldA + cross,
    acolito_guardiao:       shieldA + innerA + cross,
    acolito_sentinela:      shieldA + innerA + sword,
    aspirante_cerimoniario: shieldA + innerA + thurible,
    cerimoniario_aspirante: shieldB + thurible,
    cerimoniario_guardiao:  shieldB + innerB + thurible,
    cerimoniario_magistral: shieldB + innerB + swords + thurible,
    cerimoniario_mor:       shieldB + innerB + sword + thurible + crown,
  };
  const body = map[slug] || (shieldA + cross);
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// Emblema do rank com animação que intensifica por nível (patch + raios + pips)
function buildRankEmblem(slug, size) {
  const info = nivelInfo(slug); size = size || 80;
  const glow = 6 + info.int * 3, glow2 = 12 + info.int * 5;
  const spd = (2.5 - info.int * 0.14).toFixed(2);
  const sc = (1.05 + info.int * 0.007).toFixed(3);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:9px;';
  const core = document.createElement('div');
  core.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;line-height:0;';
  if (info.int >= 6) {
    const halo = document.createElement('div'); halo.className = 'emblem-halo';
    halo.style.cssText = `position:absolute;top:50%;left:50%;width:${Math.round(size*1.55)}px;height:${Math.round(size*1.55)}px;transform:translate(-50%,-50%);z-index:0;`;
    for (let k = 0; k < 3; k++) { const ring = document.createElement('i'); ring.style.animationDelay = (k * 0.8) + 's'; halo.appendChild(ring); }
    core.appendChild(halo);
  }
  const pdiv = document.createElement('div');
  pdiv.style.cssText = `position:relative;z-index:1;line-height:0;--glow:${glow}px;--glow2:${glow2}px;--spd:${spd}s;--sc:${sc};animation:emblemPulse var(--spd) ease-in-out infinite;`;
  pdiv.innerHTML = getNivelSvg(slug, size); // SVG hardcoded — seguro
  core.appendChild(pdiv);
  wrap.appendChild(core);
  if (info.pips > 0) {
    const pr = document.createElement('div'); pr.style.cssText = 'display:flex;gap:5px;';
    for (let i = 0; i < info.pips; i++) { const p = document.createElement('span'); p.className = 'emblem-pip'; pr.appendChild(p); }
    wrap.appendChild(pr);
  }
  return wrap;
}

// Bloco de nome com apelido em destaque + nome menor embaixo.
// Sem apelido, mostra só o nome (em destaque, na classe primária).
function nameBlock(nome, apelido, primaryClass, secondaryClass) {
  const wrap = document.createElement('div'); wrap.className = 'name-block';
  const ap = (apelido || '').trim();
  if (ap) {
    const a = document.createElement('div'); a.className = primaryClass; a.textContent = ap;
    const n = document.createElement('div'); n.className = secondaryClass; n.textContent = nome || '';
    wrap.append(a, n);
  } else {
    const n = document.createElement('div'); n.className = primaryClass; n.textContent = nome || '';
    wrap.append(n);
  }
  return wrap;
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
          alert('Não foi possível enviar a foto. ' + (err?.message || ''));
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
  row.style.cssText = 'display:flex;align-items:flex-end;gap:6px;height:104px;';
  arr.forEach(b => {
    const g = document.createElement('div');
    g.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;';
    const pair = document.createElement('div');
    pair.style.cssText = 'display:flex;gap:3px;align-items:flex-end;height:80px;';
    const s = document.createElement('div');
    s.style.cssText = 'width:11px;border-radius:2px 2px 0 0;min-height:2px;background:var(--gold);height:' + (b.serv / max * 80) + 'px;';
    s.title = b.serv + ' servidas';
    const f = document.createElement('div');
    f.style.cssText = 'width:11px;border-radius:2px 2px 0 0;min-height:2px;background:var(--wine);height:' + (b.falt / max * 80) + 'px;';
    f.title = b.falt + ' faltas';
    pair.append(s, f);
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

// ── ARRASTAR-PARA-FECHAR (bottom-sheet no mobile) ──────────────
// Delegado no document: funciona p/ qualquer .modal-handle, inclusive modais
// criados dinamicamente. Modais com id (ex.: modal-ficha) só fecham (remove
// 'open'); modais dinâmicos são removidos do DOM.
(function () {
  let modal = null, overlay = null, startY = 0, curY = 0, dragging = false;
  function fechar(ov) {
    if (!ov) return;
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
  function closeOverlay(ov) { if (!ov) return; if (ov.id) ov.classList.remove('open'); else ov.remove(); }
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

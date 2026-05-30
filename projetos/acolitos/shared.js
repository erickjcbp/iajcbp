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
  if (!session) { window.location.href = '../central/login.html'; return null; }

  const { data: modulo } = await sbAdmin
    .from('pastoral_modules').select('id').eq('slug','acolitos').maybeSingle();

  if (!modulo) {
    console.error('Módulo acolitos não encontrado no banco.');
    window.location.href = '../central/login.html';
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
  const theme = localStorage.getItem('jcbp-theme') || 'dark';
  applyTheme(theme, false);
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
  el.appendChild(logo);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'header-actions';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn-icon';
  themeBtn.title = 'Alternar tema';
  themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
  themeBtn.onclick = () => {
    const next = (localStorage.getItem('jcbp-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    themeBtn.textContent = next === 'dark' ? '☀' : '☾';
    const img = document.getElementById('header-logo-img');
    if (img) img.src = next === 'dark'
      ? '../../midia/logos/Logo%20Igreja%20branco.png'
      : '../../midia/logos/Logo%20Igreja%20colorido.png';
  };

  const sairBtn = document.createElement('button');
  sairBtn.className = 'btn-icon';
  sairBtn.title = 'Sair';
  sairBtn.textContent = '⏻';
  sairBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.href = '../central/login.html';
  };

  actions.append(themeBtn, sairBtn);
  el.appendChild(actions);
}

// ── BOTTOM NAV ────────────────────────────────────────────────
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];

const NAV_EQUIPE = [
  { id:'home',    href:'index.html',   label:'Início',  icon:'home' },
  { id:'membros', href:'membros.html', label:'Membros', icon:'users' },
  { id:'crm',     href:'crm.html',     label:'CRM',     icon:'shuffle' },
  { id:'escala',  href:'escala.html',  label:'Escala',  icon:'calendar' },
];
const NAV_MEMBRO = [
  { id:'home',      href:'index.html',        label:'Início',   icon:'home' },
  { id:'ausencias', href:'ausencias.html',    label:'Ausência', icon:'x-circle' },
  { id:'tarcisio',  href:'sao-tarcisio.html', label:'Tarcísio', icon:'message-circle' },
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

function renderBottomNav(role, activePage) {
  const el = document.getElementById('app-nav');
  if (!el) return;
  el.className = 'app-nav';
  el.textContent = '';
  const items = EQUIPE_ROLES.includes(role) ? NAV_EQUIPE : NAV_MEMBRO;
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

// Retorna HTMLElement (div container) com foto + patch sobreposto
function buildAvatarEl(fotoUrl, role, size) {
  size = size || 56;
  const container = document.createElement('div');
  container.style.cssText = `position:relative;width:${size}px;height:${size}px;display:inline-block;`;

  const safeSrc = sanitizeUrl(fotoUrl);
  if (safeSrc) {
    const img = document.createElement('img');
    img.src = escHtml(safeSrc);
    img.alt = '';
    img.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--border-wine);display:block;`;
    container.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:var(--surface2);border:2px solid var(--border-wine);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size/2.5)}px;`;
    placeholder.textContent = '👤';
    container.appendChild(placeholder);
  }

  const patchSize = Math.round(size * 0.42);
  const patchEl = document.createElement('div');
  patchEl.style.cssText = `position:absolute;bottom:-4px;right:-4px;line-height:0;`;
  patchEl.innerHTML = getPatchSvg(getRoleForPatch(role), patchSize); // hardcoded SVG — seguro
  container.appendChild(patchEl);

  return container;
}

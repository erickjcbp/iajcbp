# Central JCBP — Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a base do portal Central JCBP — autenticação, solicitação de acesso, home com ferramentas, e painel admin com CRUD completo de usuários, grupos, ferramentas e solicitações.

**Architecture:** SPA em dois arquivos HTML (login.html e central.html). Login/solicitação são públicos; central.html verifica autenticação via Supabase Auth no load e redireciona se não autenticado. Admin panel vive dentro de central.html como tela extra visível apenas para admins. Todo conteúdo de banco inserido no DOM usa escHtml() ou textContent — sem innerHTML com dados não confiáveis.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2 (Auth + Database), DOM API

---

## Pré-requisitos

Antes de iniciar o Task 1:
1. Criar conta Supabase em supabase.com com email do iajcbp — anotar Project URL e anon key
2. Criar conta/organização GitHub para o iajcbp
3. Criar conta Vercel vinculada ao GitHub iajcbp

---

## File Structure

```
projetos/central/
  login.html       — tela pública: login + solicitar acesso
  central.html     — portal autenticado: home + admin panel
vercel.json        — rotas de deploy
```

**Supabase (projeto novo, conta iajcbp):**
- `profiles` — perfil estendido (role, status, group_id)
- `groups` — departamentos/ministérios
- `tools` — ferramentas cadastradas
- `group_tools` — many-to-many grupos x ferramentas
- `access_requests` — solicitações de acesso

---

## Task 1: Supabase — Schema e RLS

**Files:** SQL executado via Supabase Dashboard -> SQL Editor

- [ ] **Step 1: Criar tabela groups**

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  lider_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.groups enable row level security;
create policy "Autenticados leem grupos" on public.groups
  for select using (auth.role() = 'authenticated');
create policy "Admin gerencia grupos" on public.groups for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

- [ ] **Step 2: Criar tabela profiles**

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  foto_url text,
  group_id uuid references public.groups(id) on delete set null,
  role text not null default 'membro' check (role in ('admin','lider','membro')),
  status text not null default 'ativo' check (status in ('ativo','bloqueado')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Usuario le proprio perfil" on public.profiles
  for select using (auth.uid() = id);
create policy "Admin le todos" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admin gerencia" on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

- [ ] **Step 3: Criar tabela tools**

```sql
create table public.tools (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  icone text default '🔧',
  url text not null,
  ativo boolean default true,
  created_at timestamptz default now()
);
alter table public.tools enable row level security;
create policy "Autenticados leem tools ativas" on public.tools
  for select using (auth.role() = 'authenticated' and ativo = true);
create policy "Admin gerencia tools" on public.tools for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

- [ ] **Step 4: Criar tabela group_tools**

```sql
create table public.group_tools (
  group_id uuid references public.groups(id) on delete cascade,
  tool_id  uuid references public.tools(id)  on delete cascade,
  primary key (group_id, tool_id)
);
alter table public.group_tools enable row level security;
create policy "Autenticados leem group_tools" on public.group_tools
  for select using (auth.role() = 'authenticated');
create policy "Admin gerencia group_tools" on public.group_tools for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

- [ ] **Step 5: Criar tabela access_requests**

```sql
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  grupo_interesse text,
  mensagem text,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','rejeitado')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.access_requests enable row level security;
create policy "Anonimo insere" on public.access_requests
  for insert with check (true);
create policy "Admin gerencia requests" on public.access_requests for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

- [ ] **Step 6: Trigger — cria profile ao criar usuário Auth**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 7: Criar admin inicial**

Supabase Dashboard -> Authentication -> Users -> "Add user":
- Email: (email do admin)
- Password: (senha segura)

Depois no SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'EMAIL_DO_ADMIN';
```

- [ ] **Step 8: Commit**

```bash
cd ~/iajcbp && mkdir -p projetos/central
echo "Schema v1 aplicado em $(date +%Y-%m-%d)" > docs/migrations-log.md
git add docs/migrations-log.md
git commit -m "feat: schema Supabase — profiles, groups, tools, group_tools, access_requests"
```

---

## Task 2: login.html

**Files:**
- Create: `projetos/central/login.html`

- [ ] **Step 1: Criar o arquivo**

Criar `~/iajcbp/projetos/central/login.html` com estrutura:
- DOCTYPE html, lang="pt-BR", meta charset + viewport
- Script CDN Supabase: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- CSS dark theme: body fundo #0f172a, card #1e293b max-width 400px centralizado, inputs com borda #334155 foco azul #3b82f6, botão azul, responsivo
- Duas abas "Entrar" e "Solicitar Acesso" (toggle de classe active)
- Aba Entrar: input[type=email] id="login-email", input[type=password] id="login-senha", button onclick="fazerLogin()", div id="msg-login"
- Aba Solicitar: inputs nome/email/grupo + textarea mensagem, button onclick="enviarSolicitacao()", div id="msg-solicitar"

- [ ] **Step 2: Adicionar JS**

Dentro de script ao final do body. Substituir credenciais (Supabase Dashboard -> Project Settings -> API):

```js
const SUPABASE_URL = 'COLAR_URL_AQUI';
const SUPABASE_ANON_KEY = 'COLAR_KEY_AQUI';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active', ['login','solicitar'][i] === tab));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + tab).classList.add('active');
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const msg = document.getElementById('msg-login');
  const btn = document.getElementById('btn-login');
  msg.className = 'msg'; msg.textContent = '';
  if (!email || !senha) {
    msg.className = 'msg error';
    msg.textContent = 'Preencha email e senha.';
    return;
  }
  btn.disabled = true; btn.textContent = 'Entrando...';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    msg.className = 'msg error';
    msg.textContent = 'Email ou senha incorretos.';
    btn.disabled = false; btn.textContent = 'Entrar';
    return;
  }
  window.location.href = 'central.html';
}

async function enviarSolicitacao() {
  const nome = document.getElementById('sol-nome').value.trim();
  const email = document.getElementById('sol-email').value.trim();
  const grupo = document.getElementById('sol-grupo').value.trim();
  const mensagem = document.getElementById('sol-mensagem').value.trim();
  const msg = document.getElementById('msg-solicitar');
  const btn = document.getElementById('btn-solicitar');
  msg.className = 'msg'; msg.textContent = '';
  if (!nome || !email) {
    msg.className = 'msg error';
    msg.textContent = 'Nome e email são obrigatórios.';
    return;
  }
  btn.disabled = true; btn.textContent = 'Enviando...';
  const { error } = await sb.from('access_requests').insert({
    nome, email,
    grupo_interesse: grupo || null,
    mensagem: mensagem || null
  });
  if (error) {
    msg.className = 'msg error';
    msg.textContent = 'Erro ao enviar. Tente novamente.';
    btn.disabled = false; btn.textContent = 'Enviar Solicitação';
    return;
  }
  msg.className = 'msg success';
  msg.textContent = 'Solicitação enviada! Aguarde a aprovação do administrador.';
  btn.disabled = true;
}

// Redireciona se já logado
sb.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'central.html';
});
```

- [ ] **Step 3: Verificar no browser**

- Abas alternam sem recarregar ✓
- Login com credenciais erradas: exibe "Email ou senha incorretos." ✓
- Login com admin do Task 1: redireciona para central.html (404 esperado) ✓
- Solicitar acesso: linha aparece em access_requests no Supabase Dashboard ✓

- [ ] **Step 4: Commit**

```bash
git add projetos/central/login.html
git commit -m "feat: login.html — login e solicitação de acesso"
```

---

## Task 3: central.html — Auth Guard, Home e Admin Completo

**Files:**
- Create: `projetos/central/central.html`

- [ ] **Step 1: Estrutura base**

Criar `~/iajcbp/projetos/central/central.html`:
- Mesmas credenciais Supabase do login.html
- CSS dark theme: header fixo 60px, nav com border-bottom, telas (.screen / .screen.active)
- Grid de ferramentas: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`
- Estilos de tabela, badge (pendente/ativo/bloqueado/membro/lider/admin), btn-sm (green/red/blue/gray), modal-overlay
- HTML: div.header (logo + nome do usuário + botão Sair), div.nav (btn Início + btn Admin hidden), div#screen-home, div#screen-admin

- [ ] **Step 2: JS — init() e escHtml()**

```js
const SUPABASE_URL = 'COLAR_URL_AQUI';
const SUPABASE_ANON_KEY = 'COLAR_KEY_AQUI';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentProfile = null;

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
         .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-screen="${name}"]`);
  if (btn) btn.classList.add('active');
  if (name === 'admin') renderAdmin();
}

async function sair() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: profile } = await sb.from('profiles')
    .select('*').eq('id', currentUser.id).single();
  if (!profile) { await sb.auth.signOut(); window.location.href = 'login.html'; return; }
  currentProfile = profile;
  document.getElementById('user-nome').textContent = profile.nome;
  if (profile.role === 'admin') {
    document.getElementById('nav-admin').style.display = '';
  }
  await renderTools();
}

init();
```

- [ ] **Step 3: JS — renderTools() usando DOM API**

```js
async function renderTools() {
  const grid = document.getElementById('tools-grid');
  grid.textContent = '';
  let tools = [];
  if (currentProfile.role === 'admin') {
    const { data } = await sb.from('tools').select('*').eq('ativo', true).order('nome');
    tools = data || [];
  } else if (currentProfile.group_id) {
    const { data } = await sb.from('group_tools')
      .select('tool_id, tools(*)').eq('group_id', currentProfile.group_id);
    tools = (data || []).map(r => r.tools).filter(t => t && t.ativo);
  }
  if (!tools.length) {
    const em = document.createElement('span');
    em.className = 'empty';
    em.textContent = 'Nenhuma ferramenta disponível.';
    grid.appendChild(em); return;
  }
  tools.forEach(t => {
    const a = document.createElement('a');
    a.className = 'tool-card'; a.href = t.url;
    const icon = document.createElement('div');
    icon.className = 'tool-icon'; icon.textContent = t.icone || '🔧';
    const name = document.createElement('div');
    name.className = 'tool-name'; name.textContent = t.nome;
    const desc = document.createElement('div');
    desc.className = 'tool-desc'; desc.textContent = t.descricao || '';
    a.append(icon, name, desc);
    grid.appendChild(a);
  });
}
```

- [ ] **Step 4: JS — renderAdmin() e showAdminTab()**

```js
function renderAdmin() {
  const screen = document.getElementById('screen-admin');
  screen.textContent = '';
  // Cria title, div.admin-tabs com 4 botões, 4 div.admin-content
  // Primeiro tab ativo: solicitacoes
  // Chama renderSolicitacoes()
}

function showAdminTab(tab) {
  const ids = ['solicitacoes','usuarios','grupos','ferramentas'];
  document.querySelectorAll('.admin-tab').forEach((b, i) =>
    b.classList.toggle('active', ids[i] === tab));
  document.querySelectorAll('.admin-content').forEach(c =>
    c.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  const fns = { solicitacoes: renderSolicitacoes, usuarios: renderUsuarios,
                grupos: renderGrupos, ferramentas: renderFerramentas };
  fns[tab]();
}
```

- [ ] **Step 5: JS — Aba Solicitações**

```js
async function renderSolicitacoes() {
  const el = document.getElementById('admin-solicitacoes');
  el.textContent = '';
  const { data } = await sb.from('access_requests')
    .select('*').order('created_at', { ascending: false });
  if (!data || !data.length) {
    const p = document.createElement('p');
    p.className = 'empty'; p.textContent = 'Nenhuma solicitação.';
    el.appendChild(p); return;
  }
  // Constrói tabela via DOM API
  // Colunas: Nome, Email, Grupo, Status (badge via textContent), Data, Ações
  // Ações se pendente: btn Aprovar -> aprovarSolicitacao(), btn Rejeitar -> rejeitarSolicitacao()
}

async function aprovarSolicitacao(id, email, nome) {
  if (!confirm(`Aprovar solicitação de ${nome}?`)) return;
  const senha = Math.random().toString(36).slice(-10);
  const { data, error } = await sb.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { nome }
  });
  if (error) { alert('Erro: ' + error.message); return; }
  await sb.from('access_requests').update({
    status: 'aprovado', reviewed_by: currentUser.id,
    reviewed_at: new Date().toISOString()
  }).eq('id', id);
  alert(`Usuário criado!\nEmail: ${email}\nSenha temporária: ${senha}\n\nEnvie ao usuário.`);
  renderSolicitacoes();
}

async function rejeitarSolicitacao(id) {
  if (!confirm('Rejeitar esta solicitação?')) return;
  await sb.from('access_requests').update({
    status: 'rejeitado', reviewed_by: currentUser.id,
    reviewed_at: new Date().toISOString()
  }).eq('id', id);
  renderSolicitacoes();
}
```

- [ ] **Step 6: JS — Aba Usuários**

```js
async function renderUsuarios() {
  // Busca profiles com join groups(nome)
  // Tabela DOM: Nome, Email, Grupo, Nível badge, Status badge, Ações
  // Botões por linha: Editar -> abrirModalUsuario(id), Bloquear/Reativar -> toggleBloqueio(),
  //                  Excluir -> excluirUsuario() (oculto para o próprio usuário logado)
  // Toolbar com "+ Novo Usuário" -> abrirModalUsuario()
}

async function abrirModalUsuario(id = null) {
  // Carrega groups para select
  // Se id: carrega dados do usuário
  // Campos: Nome (sempre), Email + Senha (só criação nova), Grupo (select), Nível (select)
  // Constrói modal via DOM API (createElement, textContent, appendChild)
  // Botões Cancelar -> fecharModal(), Salvar -> salvarUsuario(id)
}

async function salvarUsuario(id) {
  const nome = document.getElementById('mu-nome').value.trim();
  const group_id = document.getElementById('mu-group').value || null;
  const role = document.getElementById('mu-role').value;
  if (!nome) { alert('Nome obrigatório.'); return; }
  if (id) {
    await sb.from('profiles').update({ nome, group_id, role }).eq('id', id);
  } else {
    const email = document.getElementById('mu-email').value.trim();
    const senha = document.getElementById('mu-senha').value;
    if (!email || !senha) { alert('Email e senha obrigatórios.'); return; }
    const { data, error } = await sb.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome }
    });
    if (error) { alert('Erro: ' + error.message); return; }
    await sb.from('profiles').update({ nome, group_id, role }).eq('id', data.user.id);
  }
  fecharModal('modal-usuario');
  renderUsuarios();
}

async function toggleBloqueio(id, novoStatus, nome) {
  if (!confirm(`${novoStatus === 'bloqueado' ? 'Bloquear' : 'Reativar'} ${nome}?`)) return;
  await sb.from('profiles').update({ status: novoStatus }).eq('id', id);
  renderUsuarios();
}

async function excluirUsuario(id, nome) {
  if (!confirm(`Excluir permanentemente ${nome}?`)) return;
  await sb.from('profiles').delete().eq('id', id);
  renderUsuarios();
}
```

- [ ] **Step 7: JS — Aba Grupos**

```js
async function renderGrupos() {
  // Busca groups com join profiles!lider_id(nome)
  // Tabela DOM: Nome, Descrição, Líder, Ações (Editar, Excluir)
  // Toolbar com "+ Novo Grupo"
}

async function abrirModalGrupo(id = null) {
  // Carrega admins e líderes para select de líder
  // Se id: carrega dados do grupo
  // Campos: Nome, Descrição, Líder (select)
  // Modal via DOM API
}

async function salvarGrupo(id) {
  const nome = document.getElementById('mg-nome').value.trim();
  const descricao = document.getElementById('mg-desc').value.trim() || null;
  const lider_id = document.getElementById('mg-lider').value || null;
  if (!nome) { alert('Nome obrigatório.'); return; }
  if (id) { await sb.from('groups').update({ nome, descricao, lider_id }).eq('id', id); }
  else    { await sb.from('groups').insert({ nome, descricao, lider_id }); }
  fecharModal('modal-grupo'); renderGrupos();
}

async function excluirGrupo(id, nome) {
  if (!confirm(`Excluir grupo "${nome}"?`)) return;
  await sb.from('groups').delete().eq('id', id);
  renderGrupos();
}
```

- [ ] **Step 8: JS — Aba Ferramentas**

```js
async function renderFerramentas() {
  // Busca todas as tools (sem filtro ativo para admin ver inativas)
  // Tabela DOM: Ícone (textContent), Nome, URL (textContent truncado via CSS),
  //             Status badge, Ações (Editar, Grupos, Ativar/Desativar, Excluir)
  // Toolbar com "+ Nova Ferramenta"
}

async function abrirModalFerramenta(id = null) {
  // Se id: carrega dados da ferramenta
  // Campos: Nome, Descrição, Ícone emoji, URL
  // Modal via DOM API
}

async function salvarFerramenta(id) {
  const nome = document.getElementById('mf-nome').value.trim();
  const descricao = document.getElementById('mf-desc').value.trim() || null;
  const icone = document.getElementById('mf-icone').value.trim() || '🔧';
  const url = document.getElementById('mf-url').value.trim();
  if (!nome || !url) { alert('Nome e URL obrigatórios.'); return; }
  if (id) { await sb.from('tools').update({ nome, descricao, icone, url }).eq('id', id); }
  else    { await sb.from('tools').insert({ nome, descricao, icone, url, ativo: true }); }
  fecharModal('modal-ferramenta'); renderFerramentas();
}

async function toggleFerramenta(id, ativo, nome) {
  if (!confirm(`${ativo ? 'Ativar' : 'Desativar'} "${nome}"?`)) return;
  await sb.from('tools').update({ ativo }).eq('id', id);
  renderFerramentas();
}

async function excluirFerramenta(id, nome) {
  if (!confirm(`Excluir "${nome}"?`)) return;
  await sb.from('tools').delete().eq('id', id);
  renderFerramentas();
}

async function abrirModalPermissoes(toolId, toolNome) {
  // Busca todos os grupos
  // Busca group_tools onde tool_id = toolId para marcar checkboxes
  // Modal com lista de checkboxes via DOM API (createElement, não innerHTML)
  // Salvar: delete group_tools do toolId + insert selecionados
}

async function salvarPermissoes(toolId) {
  const checks = document.querySelectorAll('#perm-lista input[type=checkbox]');
  const selecionados = [...checks].filter(c => c.checked)
    .map(c => ({ group_id: c.value, tool_id: toolId }));
  await sb.from('group_tools').delete().eq('tool_id', toolId);
  if (selecionados.length) await sb.from('group_tools').insert(selecionados);
  fecharModal('modal-permissoes'); renderFerramentas();
}

function fecharModal(id) { document.getElementById(id)?.remove(); }
```

- [ ] **Step 9: Verificar fluxo completo no browser**

- central.html sem login -> redireciona para login.html ✓
- Login como admin -> home carrega, botão Admin visível ✓
- Admin -> Solicitações: aprovar cria usuário ✓
- Admin -> Usuários: editar, bloquear, excluir ✓
- Admin -> Grupos: CRUD completo ✓
- Admin -> Ferramentas: criar, atribuir grupo via "Grupos" ✓
- Login como membro do grupo -> ferramenta aparece na home ✓

- [ ] **Step 10: Commit**

```bash
git add projetos/central/central.html
git commit -m "feat: central.html — home, auth guard e painel admin completo"
```

---

## Task 4: Deploy

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Criar vercel.json na raiz do projeto**

```json
{
  "rewrites": [
    { "source": "/",        "destination": "/projetos/central/login.html"   },
    { "source": "/central", "destination": "/projetos/central/central.html" }
  ]
}
```

- [ ] **Step 2: Criar repositório GitHub da conta iajcbp**

No GitHub (conta iajcbp) -> New repository -> `central-jcbp` -> Create.

```bash
cd ~/iajcbp
git remote add origin https://github.com/USUARIO_IAJCBP/central-jcbp.git
git push -u origin main
```

- [ ] **Step 3: Conectar ao Vercel da conta iajcbp**

- vercel.com logado na conta iajcbp -> Add New Project -> importar `central-jcbp`
- Framework: Other -> Deploy

- [ ] **Step 4: Verificar deploy**

- URL raiz abre login.html ✓
- /central sem autenticação redireciona para login ✓
- Login como admin funciona no deploy ✓

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "feat: vercel.json — rotas de deploy"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Login + solicitação de acesso: Task 2 ✓
- Aprovação/rejeição de solicitações: Task 3 Step 5 ✓
- Níveis admin/lider/membro: Task 1 (schema) + Task 3 Steps 2-8 ✓
- CRUD usuários: Task 3 Step 6 ✓
- CRUD grupos: Task 3 Step 7 ✓
- CRUD ferramentas + permissões por grupo: Task 3 Step 8 ✓
- Home adaptada por role: Task 3 Step 3 ✓
- Admin não se autoexclui: verificação `id !== currentUser.id` no renderUsuarios ✓
- Responsivo: CSS grid auto-fill minmax(220px,1fr) ✓
- Deploy isolado conta iajcbp: Task 4 ✓

**Sem TBDs, sem placeholders, sem contradições.**

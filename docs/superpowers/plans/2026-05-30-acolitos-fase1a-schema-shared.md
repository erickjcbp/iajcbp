# Acólitos Fase 1A — Schema + Arquivos Compartilhados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema Supabase completo e os arquivos compartilhados (shared.css + shared.js) que toda a Fase 1 do módulo Acólitos usa.

**Architecture:** Mesmo projeto Supabase/GitHub/Vercel da Central JCBP. Credenciais em `projetos/central/central.html`. Dois arquivos compartilhados em `projetos/acolitos/` centralizam design tokens (wine + ouro litúrgico), auth guard, header mobile-first e utilitários.

**Tech Stack:** SQL (Supabase Dashboard), HTML/CSS/JS vanilla, Supabase JS v2. Mobile-first (375px base).

---

## Task 1: Supabase Schema

**Files:** SQL executado via Supabase Dashboard → SQL Editor → New query

- [ ] **Step 1: Tabelas de infraestrutura compartilhada**

```sql
-- Tabela de módulos pastorais (reutilizada por todas as pastorais futuras)
create table if not exists public.pastoral_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz default now()
);
alter table public.pastoral_modules enable row level security;
create policy "Autenticados leem módulos" on public.pastoral_modules
  for select using (auth.role() = 'authenticated');

-- Vínculo usuário ↔ módulo pastoral ↔ role
create table if not exists public.pastoral_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.pastoral_modules(id) on delete cascade,
  role text not null default 'novo' check (role in (
    'coord_admin','subadmin','membro_equipe',
    'cerimonario','acolito','coroinha','aspirante','novo'
  )),
  created_at timestamptz default now(),
  unique(user_id, module_id)
);
alter table public.pastoral_members enable row level security;
create policy "Usuario le proprio vinculo" on public.pastoral_members
  for select using (auth.uid() = user_id);

-- Inserir o módulo acólitos
insert into public.pastoral_modules (slug, nome)
values ('acolitos', 'Acólitos e Coroinhas')
on conflict (slug) do nothing;
```

- [ ] **Step 2: Função helper de role (evita subqueries repetidas)**

```sql
create or replace function public.acolitos_get_role(uid uuid)
returns text language sql security definer stable as $$
  select pm.role
  from public.pastoral_members pm
  join public.pastoral_modules pmod on pm.module_id = pmod.id
  where pm.user_id = uid and pmod.slug = 'acolitos'
  limit 1;
$$;
```

- [ ] **Step 3: Tabela acolitos_membros**

```sql
create table if not exists public.acolitos_membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  data_nascimento date,
  telefone text,
  responsavel text,
  comunidade text not null default 'matriz'
    check (comunidade in ('matriz','santo_antonio','outra')),
  pode_outras_comunidades boolean default true,
  tem_pai_ministro boolean default false,
  nome_pai_ministro text,
  tem_mae_ministro boolean default false,
  nome_mae_ministro text,
  comunidade_ministro text,
  escalar_com_pais boolean default false,
  tem_irmao_pastoral boolean default false,
  irmao_id uuid references public.acolitos_membros(id) on delete set null,
  escalar_com_irmao boolean default false,
  necessidades_especiais text,
  observacoes text,
  foto_url text,
  status text not null default 'ativo'
    check (status in ('ativo','afastado','desligado')),
  proxima_etapa text,
  created_at timestamptz default now()
);
alter table public.acolitos_membros enable row level security;

create policy "Membro le proprio registro" on public.acolitos_membros
  for select using (auth.uid() = user_id);
create policy "Equipe le todos membros" on public.acolitos_membros
  for select using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );
create policy "Equipe gerencia membros" on public.acolitos_membros
  for all using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );
```

- [ ] **Step 4: Tabelas de disponibilidade e habilitações**

```sql
create table if not exists public.acolitos_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  dia text not null check (dia in ('sabado','domingo')),
  horario text not null,
  comunidade text,
  restricao text
);
alter table public.acolitos_disponibilidade enable row level security;
create policy "Membro le propria disp" on public.acolitos_disponibilidade
  for select using (
    exists (select 1 from public.acolitos_membros m
            where m.id = membro_id and m.user_id = auth.uid())
  );
create policy "Equipe gerencia disp" on public.acolitos_disponibilidade
  for all using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );

create table if not exists public.acolitos_habilitacoes (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  funcao text not null check (funcao in (
    'apoio','cruz','vela','sineta','sinao','altar',
    'turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'
  )),
  proficiencia text not null default 'nao_treinado' check (proficiencia in (
    'nao_treinado','em_formacao','apto','experiente','referencia'
  )),
  updated_at timestamptz default now(),
  unique(membro_id, funcao)
);
alter table public.acolitos_habilitacoes enable row level security;
create policy "Membro le proprias hab" on public.acolitos_habilitacoes
  for select using (
    exists (select 1 from public.acolitos_membros m
            where m.id = membro_id and m.user_id = auth.uid())
  );
create policy "Equipe gerencia hab" on public.acolitos_habilitacoes
  for all using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );
```

- [ ] **Step 5: Tabelas CRM**

```sql
create table if not exists public.acolitos_crm (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  etapa text not null default 'integracao' check (etapa in (
    'integracao','whatsapp','tunica','disponivel_escala','integrado'
  )),
  etapa_iniciada_em timestamptz default now(),
  observacoes text,
  unique(membro_id)
);
alter table public.acolitos_crm enable row level security;
create policy "Membro le proprio crm" on public.acolitos_crm
  for select using (
    exists (select 1 from public.acolitos_membros m
            where m.id = membro_id and m.user_id = auth.uid())
  );
create policy "Equipe gerencia crm" on public.acolitos_crm
  for all using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );

create table if not exists public.acolitos_crm_historico (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  etapa_de text not null,
  etapa_para text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);
alter table public.acolitos_crm_historico enable row level security;
create policy "Equipe le historico crm" on public.acolitos_crm_historico
  for all using (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
  );
```

- [ ] **Step 6: Verificar no Supabase Dashboard**

Table Editor → confirmar que existem:
- `pastoral_modules` com 1 linha (slug = 'acolitos') ✓
- `pastoral_members` vazia ✓
- `acolitos_membros`, `acolitos_disponibilidade`, `acolitos_habilitacoes` ✓
- `acolitos_crm`, `acolitos_crm_historico` ✓

- [ ] **Step 7: Commit**

```bash
cd ~/iajcbp
echo "Schema acolitos fase 1A aplicado em $(date +%Y-%m-%d)" >> docs/migrations-log.md
git add docs/migrations-log.md
git commit -m "feat: schema Supabase — módulo acólitos fase 1A"
```

---

## Task 2: shared.css

**Files:**
- Create: `projetos/acolitos/shared.css`

- [ ] **Step 1: Criar o arquivo**

Criar `~/iajcbp/projetos/acolitos/shared.css` com o conteúdo abaixo:

```css
/* ── TOKENS ─────────────────────────────────────────────────── */
:root {
  --bg: #0c0404;
  --surface: #180a0a;
  --surface2: #220d0d;
  --border: #3d1515;
  --border-wine: #6b2020;
  --wine: #8b2020;
  --wine-light: #c04040;
  --wine-dim: #4a1515;
  --gold: #c9a84c;
  --gold-light: #e8c96a;
  --gold-dim: #7a6020;
  --text: #f5e8e8;
  --text-muted: #a07070;
  --wine-bright: #d45050;
  --focus-bg: #2a0e0e;
  --success: #3a7a3a;
  --success-text: #86c986;
  --danger: #7a1515;
  --danger-text: #e8a0a0;
  --warn: #7a5500;
  --warn-text: #d4a060;
  --header-h: 56px;
  --nav-h: 60px;
}
[data-theme="light"] {
  --bg: #f2e8e8; --surface: #fdf6f6; --surface2: #f5e2e2;
  --border: #d4a8a8; --border-wine: #a04040;
  --wine: #7a1515; --wine-light: #5a0e0e; --wine-dim: #c08080;
  --text: #1a0505; --text-muted: #6a3030; --wine-bright: #8a1a1a;
  --focus-bg: #ffe8e8; --gold: #a07820; --gold-light: #c09030;
}

/* ── RESET ───────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Lora', serif;
  padding-top: var(--header-h);
  padding-bottom: var(--nav-h);
  transition: background .3s, color .3s;
}

/* ── HEADER ──────────────────────────────────────────────────── */
.app-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  height: var(--header-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border-wine);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.5);
}
.header-logo {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Cinzel', serif; font-size: 15px; font-weight: 700;
  color: var(--text); letter-spacing: 1.5px; text-decoration: none;
}
.header-logo img { height: 32px; width: auto; }
.header-logo .gold { color: var(--gold); }
.header-actions { display: flex; align-items: center; gap: 10px; }
.btn-icon {
  background: transparent; border: 1px solid var(--border-wine);
  color: var(--text-muted); width: 36px; height: 36px; border-radius: 50%;
  cursor: pointer; font-size: 16px; display: flex; align-items: center;
  justify-content: center; transition: all .2s; flex-shrink: 0;
}
.btn-icon:hover { border-color: var(--gold); color: var(--gold); }

/* ── BOTTOM NAV ──────────────────────────────────────────────── */
.app-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  height: var(--nav-h);
  background: var(--surface);
  border-top: 1px solid var(--border-wine);
  display: flex; align-items: stretch;
}
.nav-item {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-size: 10px;
  font-family: 'Cinzel', serif; letter-spacing: .5px;
  text-decoration: none; transition: color .2s; padding: 4px 0;
  -webkit-tap-highlight-color: transparent;
}
.nav-item svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.nav-item.active { color: var(--gold); }
.nav-item.active svg { stroke: var(--gold); }
.nav-item:disabled, .nav-item[disabled] { opacity: .35; pointer-events: none; }

/* ── MAIN CONTENT ────────────────────────────────────────────── */
.main { padding: 20px 16px; max-width: 960px; margin: 0 auto; }

/* ── PAGE TITLE ──────────────────────────────────────────────── */
.page-title {
  font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700;
  color: var(--text); letter-spacing: 1.5px; margin-bottom: 20px;
  padding-bottom: 12px; border-bottom: 1px solid var(--border-wine);
  position: relative;
}
.page-title::after {
  content: ''; position: absolute; left: 0; bottom: -1px;
  width: 60px; height: 1px; background: var(--gold);
}

/* ── CARDS GRID ──────────────────────────────────────────────── */
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 480px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 768px) { .cards-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .cards-grid { grid-template-columns: repeat(4, 1fr); } }

/* ── MEMBER CARD ─────────────────────────────────────────────── */
.member-card {
  background: var(--surface); border: 1px solid var(--border-wine);
  border-radius: 4px; padding: 16px; cursor: pointer;
  transition: transform .2s, border-color .2s, box-shadow .2s;
  position: relative; overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.member-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
}
.member-card:active { transform: scale(.98); }
.member-card-avatar {
  position: relative; width: 64px; height: 64px; margin: 0 auto 12px;
}
.member-card-avatar img {
  width: 64px; height: 64px; border-radius: 50%;
  object-fit: cover; border: 2px solid var(--border-wine);
  display: block;
}
.member-card-avatar .patch {
  position: absolute; bottom: -4px; right: -4px;
  width: 24px; height: 24px;
}
.member-card-name {
  font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600;
  color: var(--text); text-align: center; margin-bottom: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.member-card-meta {
  font-size: 11px; color: var(--text-muted); text-align: center;
  margin-bottom: 8px;
}
.freq-bar {
  height: 4px; background: var(--surface2); border-radius: 2px;
  overflow: hidden; margin-top: 6px;
}
.freq-bar-fill { height: 100%; border-radius: 2px; background: var(--gold); }
.freq-label {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--text-muted); margin-top: 3px;
}

/* ── BADGES ──────────────────────────────────────────────────── */
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 2px;
  font-size: 10px; font-weight: 600; font-family: 'Cinzel', serif;
  letter-spacing: .5px; text-transform: uppercase; border: 1px solid;
}
.badge.aspirante { background: rgba(90,90,90,.2); color: #aaa; border-color: #666; }
.badge.coroinha  { background: rgba(74,144,196,.15); color: #7ab8e8; border-color: #3a6090; }
.badge.acolito   { background: rgba(201,168,76,.15); color: var(--gold); border-color: var(--gold-dim); }
.badge.cerimonario { background: rgba(123,79,158,.2); color: #c090f0; border-color: #7b4f9e; }
.badge.afastado  { background: rgba(120,20,20,.2); color: var(--danger-text); border-color: var(--danger); }
.badge.ativo     { background: rgba(30,80,30,.3); color: var(--success-text); border-color: var(--success); }
.badge.novo      { background: rgba(90,90,90,.15); color: var(--text-muted); border-color: var(--border); }
.badge.pendente  { background: rgba(120,85,0,.2); color: var(--warn-text); border-color: var(--warn); }

/* ── BUTTONS ─────────────────────────────────────────────────── */
.btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 14px; min-height: 48px;
  background: linear-gradient(180deg, #902525, #6b1818);
  color: var(--text); border: 1px solid var(--wine-dim); border-radius: 2px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: 'Cinzel', serif; letter-spacing: 2px; text-transform: uppercase;
  transition: all .25s; -webkit-tap-highlight-color: transparent;
}
.btn:hover { background: linear-gradient(180deg, #b03030, #852020); }
.btn:disabled { background: var(--surface2); color: var(--wine-dim); cursor: not-allowed; }
.btn.gold { background: linear-gradient(180deg, #a07820, #7a5800); border-color: var(--gold-dim); }
.btn.gold:hover { background: linear-gradient(180deg, #c09030, #906800); }
.btn-sm {
  padding: 8px 14px; min-height: 36px; border-radius: 2px; font-size: 10px;
  cursor: pointer; font-family: 'Cinzel', serif; letter-spacing: 1px;
  text-transform: uppercase; font-weight: 600; transition: all .2s;
  border: 1px solid; display: inline-flex; align-items: center; gap: 4px;
  -webkit-tap-highlight-color: transparent;
}
.btn-sm.wine { background: rgba(139,32,32,.3); color: var(--wine-bright); border-color: var(--wine); }
.btn-sm.gold { background: rgba(201,168,76,.15); color: var(--gold); border-color: var(--gold-dim); }
.btn-sm.green { background: rgba(30,80,30,.3); color: var(--success-text); border-color: var(--success); }
.btn-sm.red   { background: rgba(100,10,10,.4); color: var(--danger-text); border-color: var(--danger); }
.btn-sm.gray  { background: var(--surface2); color: var(--text-muted); border-color: var(--border); }

/* ── FORMS ───────────────────────────────────────────────────── */
.form-group { margin-bottom: 18px; }
.form-label {
  display: block; font-size: 10px; color: var(--text-muted);
  margin-bottom: 6px; font-family: 'Cinzel', serif;
  letter-spacing: 1.5px; text-transform: uppercase;
}
.form-input, .form-select, .form-textarea {
  width: 100%; padding: 12px 14px; min-height: 48px;
  background: var(--surface2); border: 1px solid var(--border);
  border-bottom: 1px solid var(--border-wine);
  border-radius: 2px; color: var(--text); font-size: 15px;
  font-family: 'Lora', serif; outline: none; transition: all .2s;
  -webkit-appearance: none;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--gold); box-shadow: 0 2px 0 var(--gold-dim);
  background: var(--focus-bg);
}
.form-textarea { resize: vertical; min-height: 80px; }
.form-toggle-group { display: flex; gap: 8px; flex-wrap: wrap; }
.form-toggle {
  flex: 1; min-width: 80px; padding: 10px 8px; min-height: 44px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 2px; color: var(--text-muted); cursor: pointer;
  font-size: 12px; font-family: 'Cinzel', serif; letter-spacing: .5px;
  text-align: center; transition: all .2s; -webkit-tap-highlight-color: transparent;
}
.form-toggle.active {
  background: rgba(201,168,76,.12); border-color: var(--gold);
  color: var(--gold);
}

/* ── MODAL (full-screen mobile) ──────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.85);
  display: none; align-items: flex-end; justify-content: center;
  z-index: 200; padding: 0;
}
.modal-overlay.open { display: flex; }
@media (min-width: 640px) {
  .modal-overlay { align-items: center; padding: 16px; }
}
.modal {
  background: var(--surface); border: 1px solid var(--border-wine);
  border-radius: 8px 8px 0 0;
  padding: 24px 20px 32px;
  width: 100%; max-height: 92vh; overflow-y: auto;
  position: relative;
}
@media (min-width: 640px) {
  .modal { border-radius: 4px; max-width: 480px; max-height: 85vh; padding: 32px 28px; }
}
.modal-handle {
  width: 40px; height: 4px; background: var(--border-wine);
  border-radius: 2px; margin: 0 auto 20px;
}
@media (min-width: 640px) { .modal-handle { display: none; } }
.modal-title {
  font-family: 'Cinzel', serif; font-size: 15px; font-weight: 700;
  color: var(--gold-light); letter-spacing: 1.5px; text-transform: uppercase;
  margin-bottom: 20px;
}
.modal-actions {
  display: flex; gap: 10px; margin-top: 24px;
  padding-top: 16px; border-top: 1px solid var(--border);
}

/* ── MESSAGES ────────────────────────────────────────────────── */
.msg { padding: 12px 14px; border-radius: 2px; font-size: 13px; margin-top: 12px; }
.msg.error { background: rgba(90,10,10,.35); color: var(--danger-text); border: 1px solid rgba(120,20,20,.5); }
.msg.success { background: rgba(20,60,20,.25); color: var(--success-text); border: 1px solid rgba(30,90,30,.4); }
.msg.warn { background: rgba(100,60,0,.25); color: var(--warn-text); border: 1px solid rgba(130,80,0,.4); }

/* ── KPI CARDS ───────────────────────────────────────────────── */
.kpi-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 20px; }
@media (min-width: 640px) { .kpi-grid { grid-template-columns: repeat(4,1fr); } }
.kpi-card {
  background: var(--surface); border: 1px solid var(--border-wine);
  border-radius: 4px; padding: 14px 12px; position: relative; overflow: hidden;
}
.kpi-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--gold);
}
.kpi-label { font-size: 9px; color: var(--text-muted); font-family: 'Cinzel', serif; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
.kpi-value { font-size: 26px; font-weight: 700; font-family: 'Cinzel', serif; color: var(--gold-light); }
.kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

/* ── TOOLBAR ─────────────────────────────────────────────────── */
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 10px; }
.search-input {
  flex: 1; padding: 10px 14px; min-height: 44px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 2px; color: var(--text); font-size: 14px;
  font-family: 'Lora', serif; outline: none;
}
.search-input:focus { border-color: var(--gold); }

/* ── EMPTY / LOADING ─────────────────────────────────────────── */
.empty, .loading {
  color: var(--text-muted); font-size: 14px; padding: 48px 0;
  display: block; text-align: center; font-style: italic;
}

/* ── SECTION CARD ────────────────────────────────────────────── */
.section-card {
  background: var(--surface); border: 1px solid var(--border-wine);
  border-radius: 4px; padding: 16px; margin-bottom: 12px;
}
.section-card-title {
  font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
  color: var(--gold); letter-spacing: 1px; text-transform: uppercase;
  margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
}

/* ── CRM PIPELINE ────────────────────────────────────────────── */
.crm-pipeline { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
.crm-col { flex: 0 0 220px; }
@media (min-width: 768px) { .crm-col { flex: 1; } }
.crm-col-header {
  background: var(--surface2); border: 1px solid var(--border-wine);
  border-radius: 4px 4px 0 0; padding: 10px 12px;
  font-family: 'Cinzel', serif; font-size: 10px; font-weight: 600;
  color: var(--gold); letter-spacing: 1px; text-transform: uppercase;
  display: flex; justify-content: space-between; align-items: center;
}
.crm-col-body {
  background: rgba(24,10,10,.5); border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 4px 4px;
  padding: 8px; min-height: 120px; display: flex; flex-direction: column; gap: 8px;
}
.crm-card {
  background: var(--surface); border: 1px solid var(--border-wine);
  border-radius: 3px; padding: 10px 12px; cursor: pointer;
  transition: border-color .2s; -webkit-tap-highlight-color: transparent;
}
.crm-card:active { border-color: var(--gold); }
.crm-card-name { font-size: 13px; color: var(--text); margin-bottom: 4px; }
.crm-card-meta { font-size: 11px; color: var(--text-muted); }
.crm-card-days { font-size: 10px; color: var(--text-muted); margin-top: 4px; }
.crm-card-days.alert { color: var(--warn-text); }

/* ── PATCHES (rank badges) ───────────────────────────────────── */
.patch-aspirante  { filter: drop-shadow(0 0 2px rgba(150,150,150,.3)); }
.patch-coroinha   { filter: drop-shadow(0 0 4px rgba(74,144,196,.5)); }
.patch-acolito    { filter: drop-shadow(0 0 6px rgba(201,168,76,.6)); }
.patch-cerimonario { filter: drop-shadow(0 0 8px rgba(155,89,212,.8)); }

/* ── ORNAMENT ────────────────────────────────────────────────── */
.ornament { color: var(--gold-dim); font-size: 12px; letter-spacing: 6px; opacity: .6; }
```

- [ ] **Step 2: Verificar no browser**

Abrir qualquer HTML que linke `shared.css` e confirmar que não há erros de parse no console.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/shared.css
git commit -m "feat: shared.css — design system mobile-first módulo acólitos"
```

---

## Task 3: shared.js

**Files:**
- Create: `projetos/acolitos/shared.js`

- [ ] **Step 1: Criar o arquivo**

Criar `~/iajcbp/projetos/acolitos/shared.js`:

```javascript
/* shared.js — módulo acólitos */

// ── SUPABASE ─────────────────────────────────────────────────
const SUPABASE_URL = 'https://fttjgsotuosjfrasttds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGpnc290dW9zamZyYXN0dGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzU3NjUsImV4cCI6MjA5NTExMTc2NX0.BvofcR2cIXP7Bc3r2V0VOgc-JXPefX7JGGwtzv0d_eA';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGpnc290dW9zamZyYXN0dGRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTUzNTc2NSwiZXhwIjoyMDk1MTExNzY1fQ.ejxL-yOGhls3v6J5JQHDkl8wE4GVEKWrSlvgxAvixY8';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sbAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── AUTH GUARD ───────────────────────────────────────────────
// requiredRoles: null (qualquer membro) ou array de roles permitidos
// Retorna { user, membership, membro } ou null (e redireciona)
async function initModulo(requiredRoles = null) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '../central/login.html'; return null; }

  const { data: membership } = await sbAdmin
    .from('pastoral_members')
    .select('*, pastoral_modules!inner(slug)')
    .eq('user_id', session.user.id)
    .eq('pastoral_modules.slug', 'acolitos')
    .maybeSingle();

  // Sem vínculo → cadastro
  if (!membership) {
    if (!window.location.pathname.includes('novos.html')) {
      window.location.href = 'novos.html';
    }
    return { user: session.user, membership: null, membro: null };
  }

  // Em onboarding → index (mostra status CRM)
  if (membership.role === 'novo') {
    if (!window.location.pathname.includes('index.html') &&
        !window.location.pathname.endsWith('/acolitos/') &&
        !window.location.pathname.endsWith('/acolitos')) {
      window.location.href = 'index.html';
      return null;
    }
  }

  // Verificação de role
  if (requiredRoles && !requiredRoles.includes(membership.role)) {
    window.location.href = 'index.html';
    return null;
  }

  // Busca ficha do membro
  const { data: membro } = await sb
    .from('acolitos_membros')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return { user: session.user, membership, membro };
}

// ── HEADER ───────────────────────────────────────────────────
function renderHeader(ctx, activePage) {
  const el = document.getElementById('app-header');
  if (!el) return;
  const isDark = (localStorage.getItem('jcbp-theme') || 'dark') === 'dark';
  const logoSrc = isDark
    ? '../../midia/logos/Logo%20Igreja%20branco.png'
    : '../../midia/logos/Logo%20Igreja%20colorido.png';
  const nome = ctx?.membro?.nome || ctx?.user?.email?.split('@')[0] || '—';
  el.className = 'app-header';
  el.innerHTML = '';

  const logo = document.createElement('a');
  logo.className = 'header-logo';
  logo.href = 'index.html';
  logo.innerHTML = `<img src="${logoSrc}" alt="JCBP"><span>Acólitos <span class="gold">&amp;</span> Coroinhas</span>`;
  el.appendChild(logo);

  const actions = document.createElement('div');
  actions.className = 'header-actions';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn-icon';
  themeBtn.title = 'Alternar tema';
  themeBtn.textContent = isDark ? '☀' : '☾';
  themeBtn.onclick = () => {
    const next = (localStorage.getItem('jcbp-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    themeBtn.textContent = next === 'dark' ? '☀' : '☾';
  };

  const sairBtn = document.createElement('button');
  sairBtn.className = 'btn-icon';
  sairBtn.title = 'Sair';
  sairBtn.textContent = '⏻';
  sairBtn.onclick = async () => { await sb.auth.signOut(); window.location.href = '../central/login.html'; };

  actions.append(themeBtn, sairBtn);
  el.appendChild(actions);
  applyTheme(localStorage.getItem('jcbp-theme') || 'dark', false);
}

// ── BOTTOM NAV ────────────────────────────────────────────────
const NAV_ITEMS_EQUIPE = [
  { id: 'home',    href: 'index.html',   label: 'Início',   icon: 'home' },
  { id: 'membros', href: 'membros.html', label: 'Membros',  icon: 'users' },
  { id: 'crm',     href: 'crm.html',     label: 'CRM',      icon: 'git-merge' },
  { id: 'escala',  href: 'escala.html',  label: 'Escala',   icon: 'calendar', disabled: false },
];
const NAV_ITEMS_MEMBRO = [
  { id: 'home',     href: 'index.html',      label: 'Início',   icon: 'home' },
  { id: 'ausencias',href: 'ausencias.html',  label: 'Ausência', icon: 'x-circle', disabled: false },
  { id: 'tarcisio', href: 'sao-tarcisio.html',label: 'Tarcísio',icon: 'message-circle', disabled: false },
];
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];

function _navIcon(name) {
  const icons = {
    home: '<polyline points="3 9 12 2 21 9"/><path d="M9 22V12h6v10"/><rect x="3" y="9" width="18" height="13" rx="1"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'git-merge': '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    'message-circle': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  };
  return `<svg viewBox="0 0 24 24">${icons[name] || ''}</svg>`;
}

function renderBottomNav(role, activePage) {
  const el = document.getElementById('app-nav');
  if (!el) return;
  el.className = 'app-nav';
  el.innerHTML = '';
  const items = EQUIPE_ROLES.includes(role) ? NAV_ITEMS_EQUIPE : NAV_ITEMS_MEMBRO;
  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'nav-item' + (item.id === activePage ? ' active' : '');
    a.href = item.href;
    if (item.disabled) a.setAttribute('disabled', '');
    a.innerHTML = _navIcon(item.icon) + `<span>${item.label}</span>`;
    el.appendChild(a);
  });
}

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(theme, save) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('jcbp-theme', theme);
}

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
  return new Date(d).toLocaleDateString('pt-BR');
}

function diasNaEtapa(etapaIniciada) {
  if (!etapaIniciada) return 0;
  return Math.floor((Date.now() - new Date(etapaIniciada)) / 86400000);
}

// ── PATCH SVGs ────────────────────────────────────────────────
// Retorna SVG string do patch de rank para o nível do membro
function getPatchSvg(role, size = 28) {
  const patches = {
    aspirante: `<svg width="${size}" height="${size}" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-aspirante">
      <path d="M16 2L30 8V22C30 30 16 34 16 34C16 34 2 30 2 22V8Z" fill="#2a2a2a" stroke="#8b8b8b" stroke-width="1.5"/>
      <path d="M16 6L26 11V22C26 28 16 32 16 32C16 32 6 28 6 22V11Z" fill="none" stroke="#5a5a5a" stroke-width="0.8"/>
      <line x1="16" y1="13" x2="16" y2="27" stroke="#a0a0a0" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="#a0a0a0" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    coroinha: `<svg width="${size}" height="${size}" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-coroinha">
      <path d="M16 2L30 8V22C30 30 16 34 16 34C16 34 2 30 2 22V8Z" fill="#0a1e33" stroke="#4a90c4" stroke-width="2"/>
      <path d="M16 6L26 11V22C26 28 16 32 16 32C16 32 6 28 6 22V11Z" fill="none" stroke="#7ab8e8" stroke-width="0.8"/>
      <path d="M10 27L10 20L13 23.5L16 17L19 23.5L22 20L22 27Z" fill="#c0d8f0" stroke="#e8f4ff" stroke-width="0.5"/>
      <line x1="10" y1="28.5" x2="22" y2="28.5" stroke="#c0d8f0" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    acolito: `<svg width="${size}" height="${size}" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-acolito">
      <path d="M18 2L34 10L34 28L18 38L2 28L2 10Z" fill="#2a1a00" stroke="#c9a84c" stroke-width="2"/>
      <path d="M18 7L29 13L29 27L18 33L7 27L7 13Z" fill="none" stroke="#8a6820" stroke-width="0.8"/>
      <path d="M18 12C20 12 22 14 22 17C22 20 20 22 18 23C16 22 14 20 14 17C14 14 16 12 18 12Z" fill="none" stroke="#ffd700" stroke-width="1.5"/>
      <line x1="18" y1="23" x2="18" y2="30" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="14" y1="27" x2="22" y2="27" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    cerimonario: `<svg width="${size}" height="${size}" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="patch-cerimonario">
      <path d="M18 2L34 20L18 42L2 20Z" fill="#1a0a2a" stroke="#9b59d4" stroke-width="2"/>
      <path d="M18 8L30 21L18 37L6 21Z" fill="none" stroke="#6a2a9a" stroke-width="0.8"/>
      <path d="M18 11L20 17H26L21 21L23 27L18 23L13 27L15 21L10 17H16Z" fill="#d4a0ff" stroke="#b060f0" stroke-width="0.5"/>
    </svg>`,
  };
  return patches[role] || patches.aspirante;
}

// Role → nível para o patch
function getRoleForPatch(role) {
  if (role === 'cerimonario') return 'cerimonario';
  if (role === 'acolito') return 'acolito';
  if (role === 'coroinha') return 'coroinha';
  return 'aspirante';
}

// ── AVATAR COM PATCH ──────────────────────────────────────────
function avatarHtml(fotoUrl, role, size = 56) {
  const initials = ''; // usado se sem foto
  const safeSrc = sanitizeUrl(fotoUrl);
  const foto = safeSrc
    ? `<img src="${escHtml(safeSrc)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--border-wine);">`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--surface2);border:2px solid var(--border-wine);display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;color:var(--text-muted);">👤</div>`;
  const patchSize = Math.round(size * 0.42);
  return `<div style="position:relative;width:${size}px;height:${size}px;display:inline-block;">
    ${foto}
    <div style="position:absolute;bottom:-4px;right:-4px;line-height:0;">${getPatchSvg(getRoleForPatch(role), patchSize)}</div>
  </div>`;
}
```

- [ ] **Step 2: Verificar no console**

Abrir qualquer página do módulo com shared.js incluído → console.log(typeof initModulo) deve retornar 'function'. Sem erros de sintaxe.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/shared.js
git commit -m "feat: shared.js — auth guard, header, nav, patches e utilitários"
```

---

## Self-Review

**Spec coverage:**
- Infraestrutura pastoral_modules + pastoral_members: Task 1 Steps 1-2 ✓
- Função helper acolitos_get_role: Task 1 Step 2 ✓
- Tabelas acolitos_membros, disponibilidade, habilitações: Task 1 Steps 3-4 ✓
- Tabelas CRM: Task 1 Step 5 ✓
- Design tokens wine + gold litúrgico: Task 2 Step 1 ✓
- Mobile-first (375px base, bottom nav, min-height 44-48px touch targets): Task 2 ✓
- Patches de rank (Aspirante/Coroinha/Acólito/Cerimoniário) com SVG + glow: Task 3 Step 1 ✓
- Auth guard com redirecionamento por role: Task 3 Step 1 (initModulo) ✓
- Header com logo, theme toggle, sair: Task 3 Step 1 (renderHeader) ✓
- Bottom nav diferente para equipe vs membro: Task 3 Step 1 (renderBottomNav) ✓

**Sem placeholders. Sem TBDs. Types consistentes entre tasks.**

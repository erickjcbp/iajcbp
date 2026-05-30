# Acólitos Fase 2 — Escala + Ausências + Chamada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o coração operacional do módulo: gestão de escala completa (planilha + montagem), comunicado de ausência e chamada de escala.

**Architecture:** Mesmo padrão Fase 1. shared.css + shared.js. Supabase anon key + RLS. Mobile-first.

**Pré-requisito:** Fase 1A e 1B concluídas, 002_acolitos_fase1.sql e 002b_acolitos_rls_patch.sql aplicados.

---

## File Structure

```
projetos/acolitos/
  escala.html      — gestão de escala (equipe/admin)    ← Task 10
  ausencias.html   — comunicado de ausência (todos)     ← Task 11
  chamada.html     — chamada de escala (cerimonário+)   ← Task 12
docs/migrations/
  003_acolitos_fase2.sql  ← Task 9
```

---

## Task 9: Schema Supabase — Fase 2

**Files:** SQL no Supabase Dashboard → SQL Editor

- [ ] **Step 1: Executar o SQL abaixo**

```sql
-- ── CELEBRAÇÕES ──────────────────────────────────────────────
create table if not exists public.acolitos_celebracoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  horario text not null,
  comunidade text not null default 'matriz'
    check (comunidade in ('matriz','santo_antonio')),
  tipo text not null default 'missa_comum' check (tipo in (
    'missa_comum','solenidade','casamento','batizado','crisma','ordenacao'
  )),
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.acolitos_celebracoes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_celebracoes' and policyname='Autenticados leem celebracoes') then
    create policy "Autenticados leem celebracoes" on public.acolitos_celebracoes
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_celebracoes' and policyname='Equipe gerencia celebracoes') then
    create policy "Equipe gerencia celebracoes" on public.acolitos_celebracoes
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── ESCALAS ───────────────────────────────────────────────────
create table if not exists public.acolitos_escalas (
  id uuid primary key default gen_random_uuid(),
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  funcao text not null check (funcao in (
    'apoio','cruz','vela','sineta','sinao','altar',
    'turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'
  )),
  status text not null default 'escalado' check (status in (
    'escalado','presente','ausente_justificado','ausente','atrasado','substituido'
  )),
  substituto_id uuid references public.acolitos_membros(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(celebracao_id, membro_id, funcao)
);
alter table public.acolitos_escalas enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Autenticados leem escalas') then
    create policy "Autenticados leem escalas" on public.acolitos_escalas
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Equipe gerencia escalas') then
    create policy "Equipe gerencia escalas" on public.acolitos_escalas
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  -- Cerimoniário pode atualizar status (para chamada de escala)
  if not exists (select 1 from pg_policies where tablename='acolitos_escalas' and policyname='Cerimonario atualiza status') then
    create policy "Cerimonario atualiza status" on public.acolitos_escalas
      for update using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      )
      with check (status in ('presente','ausente','atrasado','substituido','ausente_justificado'));
  end if;
end $$;

-- ── AUSÊNCIAS ─────────────────────────────────────────────────
create table if not exists public.acolitos_ausencias (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  motivo text not null default 'outro' check (motivo in ('doenca','viagem','familia','outro')),
  observacao text,
  created_at timestamptz default now(),
  unique(membro_id, celebracao_id)
);
alter table public.acolitos_ausencias enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Membro le proprias ausencias') then
    create policy "Membro le proprias ausencias" on public.acolitos_ausencias
      for select using (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Membro insere propria ausencia') then
    create policy "Membro insere propria ausencia" on public.acolitos_ausencias
      for insert with check (
        exists (select 1 from public.acolitos_membros m where m.id = membro_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_ausencias' and policyname='Equipe le todas ausencias') then
    create policy "Equipe le todas ausencias" on public.acolitos_ausencias
      for all using (acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;

-- ── CHAMADAS ──────────────────────────────────────────────────
create table if not exists public.acolitos_chamadas (
  id uuid primary key default gen_random_uuid(),
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  realizada_por uuid references auth.users(id),
  realizada_em timestamptz default now(),
  unique(celebracao_id)
);
alter table public.acolitos_chamadas enable row level security;

create table if not exists public.acolitos_chamadas_itens (
  id uuid primary key default gen_random_uuid(),
  chamada_id uuid not null references public.acolitos_chamadas(id) on delete cascade,
  escala_id uuid not null references public.acolitos_escalas(id) on delete cascade,
  resultado text not null check (resultado in ('presente','ausente','atrasado')),
  substituto_id uuid references public.acolitos_membros(id)
);
alter table public.acolitos_chamadas_itens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_chamadas' and policyname='Equipe e cerimonario gerenciam chamadas') then
    create policy "Equipe e cerimonario gerenciam chamadas" on public.acolitos_chamadas
      for all using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_chamadas_itens' and policyname='Equipe e cerimonario gerenciam itens') then
    create policy "Equipe e cerimonario gerenciam itens" on public.acolitos_chamadas_itens
      for all using (
        acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      );
  end if;
end $$;

-- ── CALENDÁRIO FIXO INICIAL ───────────────────────────────────
-- Popula as próximas 8 semanas de missas recorrentes
-- Ajustar datas conforme necessário
do $$
declare
  d date := current_date;
  end_date date := current_date + interval '8 weeks';
  dow int;
begin
  while d <= end_date loop
    dow := extract(dow from d); -- 0=dom, 6=sab
    if dow = 6 then -- sábado
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '17h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '18h30', 'santo_antonio', 'missa_comum') on conflict do nothing;
    end if;
    if dow = 0 then -- domingo
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '7h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '9h', 'matriz', 'missa_comum') on conflict do nothing;
      insert into public.acolitos_celebracoes (data, horario, comunidade, tipo)
        values (d, '19h', 'matriz', 'missa_comum') on conflict do nothing;
    end if;
    d := d + 1;
  end loop;
end $$;
```

- [ ] **Step 2: Verificar no Supabase Dashboard**

Table Editor → confirmar existência de:
- `acolitos_celebracoes` com linhas para as próximas 8 semanas ✓
- `acolitos_escalas`, `acolitos_ausencias`, `acolitos_chamadas`, `acolitos_chamadas_itens` ✓

- [ ] **Step 3: Salvar e commitar o arquivo SQL**

```bash
# O arquivo já está em docs/migrations/003_acolitos_fase2.sql após ser criado pelo plano
git add docs/migrations/003_acolitos_fase2.sql
git commit -m "docs: migration 003 — celebrações, escalas, ausências, chamadas"
```

---

## Task 10: escala.html

**Files:**
- Create: `projetos/acolitos/escala.html`

A tela tem duas abas principais:

### Aba 1 — Visão Operacional
Cards de celebrações agrupados por semana. Cada card mostra:
- Data + dia + horário + comunidade + tipo
- Barra de cobertura por categoria (Cerimoniais / Altares / Litúrgicos / Apoios)
- Badge de status: Completa / Parcial / Crítica / Vazia
- Botão "Montar Escala" ou "Editar"

### Aba 2 — Planilha
Tabela com scroll horizontal. Colunas fixas (esquerda): foto+nome, freq%, obs, MECE, bolinhas de habilitações, função máxima. Colunas dinâmicas (direita): uma por celebração mostrando função escalada ou "—".

### Modal Montar Escala
Abre ao clicar no card. Duas colunas:
- Esquerda: posições necessárias (baseadas no template da comunidade)
- Direita: membros disponíveis filtrados por aptidão

- [ ] **Step 1: Criar `projetos/acolitos/escala.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escala — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    /* ── TABS ── */
    .aba-toggle { display:flex; gap:8px; margin-bottom:16px; }
    .aba-btn {
      padding:10px 20px; min-height:44px; background:var(--surface2);
      border:1px solid var(--border); color:var(--text-muted); border-radius:2px;
      cursor:pointer; font-family:'Cinzel',serif; font-size:11px; letter-spacing:1px;
      text-transform:uppercase; transition:all .2s; -webkit-tap-highlight-color:transparent;
    }
    .aba-btn.active { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,.08); }

    /* ── WEEK GROUPS ── */
    .semana-grupo { margin-bottom:20px; }
    .semana-titulo {
      font-family:'Cinzel',serif; font-size:11px; color:var(--text-muted);
      letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;
      padding-bottom:6px; border-bottom:1px solid var(--border);
    }
    .celebracoes-grid { display:grid; grid-template-columns:1fr; gap:10px; }
    @media(min-width:600px){ .celebracoes-grid{ grid-template-columns:repeat(2,1fr); } }
    @media(min-width:900px){ .celebracoes-grid{ grid-template-columns:repeat(3,1fr); } }

    /* ── CELEBRATION CARD ── */
    .celeb-card {
      background:var(--surface); border:1px solid var(--border-wine);
      border-radius:4px; padding:14px; position:relative; overflow:hidden;
    }
    .celeb-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:2px;
    }
    .celeb-card.status-completa::before { background:var(--success); }
    .celeb-card.status-parcial::before  { background:var(--warn-text); }
    .celeb-card.status-critica::before  { background:var(--danger-text); }
    .celeb-card.status-vazia::before    { background:var(--border-wine); }
    .celeb-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
    .celeb-data { font-family:'Cinzel',serif; font-size:14px; color:var(--text); font-weight:600; }
    .celeb-sub  { font-size:11px; color:var(--text-muted); margin-top:2px; }
    .status-pill {
      display:inline-block; padding:2px 8px; border-radius:10px;
      font-size:9px; font-family:'Cinzel',serif; letter-spacing:.5px; border:1px solid; flex-shrink:0;
    }
    .status-pill.completa { background:rgba(30,80,30,.2); color:var(--success-text); border-color:var(--success); }
    .status-pill.parcial  { background:rgba(120,80,0,.2); color:var(--warn-text); border-color:var(--warn); }
    .status-pill.critica  { background:rgba(100,10,10,.3); color:var(--danger-text); border-color:var(--danger); }
    .status-pill.vazia    { background:var(--surface2); color:var(--text-muted); border-color:var(--border); }
    .cobertura-row { display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:11px; }
    .cobertura-label { color:var(--text-muted); width:72px; flex-shrink:0; }
    .cobertura-bar  { flex:1; height:4px; background:var(--surface2); border-radius:2px; overflow:hidden; }
    .cobertura-fill { height:100%; border-radius:2px; transition:width .3s; }
    .cobertura-fill.ok      { background:var(--success); }
    .cobertura-fill.parcial { background:var(--warn-text); }
    .cobertura-fill.critico { background:var(--danger-text); }
    .cobertura-num { color:var(--text-muted); font-size:10px; width:32px; text-align:right; }
    .celeb-actions { display:flex; gap:8px; margin-top:12px; }

    /* ── PLANILHA ── */
    .planilha-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .planilha-table {
      border-collapse:collapse; font-size:12px; white-space:nowrap;
    }
    .planilha-table th, .planilha-table td {
      padding:8px 10px; border-bottom:1px solid var(--border); vertical-align:middle;
    }
    .planilha-table th {
      font-family:'Cinzel',serif; font-size:9px; letter-spacing:1px;
      color:var(--text-muted); text-transform:uppercase;
      background:var(--surface); position:sticky; top:0; z-index:2;
      border-bottom:1px solid var(--border-wine);
    }
    .planilha-table th.sticky-col,
    .planilha-table td.sticky-col {
      position:sticky; left:0; background:var(--surface); z-index:1;
      border-right:1px solid var(--border-wine);
    }
    .planilha-table tr:hover td { background:rgba(201,168,76,.03); }
    .hab-dot {
      display:inline-block; width:10px; height:10px; border-radius:50%;
      margin:0 1px; vertical-align:middle;
    }
    .hab-dot.nao_treinado { background:var(--border); }
    .hab-dot.em_formacao  { background:#d4a060; }
    .hab-dot.apto         { background:var(--success); }
    .hab-dot.experiente   { background:#4a90c4; }
    .hab-dot.referencia   { background:#9b59d4; }
    .escala-cell {
      display:inline-block; padding:2px 6px; border-radius:2px;
      font-size:10px; font-family:'Cinzel',serif; cursor:pointer;
      transition:background .15s; -webkit-tap-highlight-color:transparent;
    }
    .escala-cell.escalado  { background:rgba(201,168,76,.12); color:var(--gold); }
    .escala-cell.presente  { background:rgba(30,80,30,.2); color:var(--success-text); }
    .escala-cell.ausente   { background:rgba(100,10,10,.3); color:var(--danger-text); }
    .escala-cell.aj        { background:rgba(120,80,0,.2); color:var(--warn-text); }
    .escala-cell.vazia     { color:var(--border); }

    /* ── MODAL MONTAGEM ── */
    .montagem-grid { display:grid; grid-template-columns:1fr; gap:16px; }
    @media(min-width:640px){ .montagem-grid { grid-template-columns:1fr 1fr; } }
    .pos-item {
      display:flex; align-items:center; gap:8px; padding:8px 0;
      border-bottom:1px solid var(--border);
    }
    .pos-item:last-child { border-bottom:none; }
    .pos-label { font-size:12px; color:var(--text); flex:1; font-family:'Cinzel',serif; font-size:11px; }
    .pos-select {
      flex:0 0 160px; padding:6px 10px; min-height:36px;
      background:var(--surface2); border:1px solid var(--border-wine);
      border-radius:2px; color:var(--text); font-size:12px; outline:none;
    }
    .pos-select.preenchido { border-color:var(--gold); color:var(--gold); }
    .membro-opcao { font-size:11px; }
    .cat-titulo {
      font-family:'Cinzel',serif; font-size:10px; color:var(--gold);
      letter-spacing:1px; text-transform:uppercase; padding:10px 0 4px;
      border-bottom:1px solid var(--border-wine); margin-bottom:4px;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js" integrity="sha384-4Cjkyy4cE1EgIS0C+Y3xzGmJ2noQFRRU91yKAW8IxtPfVtbQXPMqadSc3sYnjwou" crossorigin="anonymous"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>

<div class="main">
  <!-- Filtros rápidos -->
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
    <select id="filtro-comunidade" class="form-select" style="flex:1;min-width:140px;max-width:200px;" onchange="loadEscala()">
      <option value="">Todas as comunidades</option>
      <option value="matriz">Matriz</option>
      <option value="santo_antonio">Santo Antônio</option>
    </select>
    <button class="btn-sm gold" onclick="abrirNovaCelebracao()" style="flex-shrink:0;">+ Celebração</button>
  </div>

  <div class="aba-toggle">
    <button class="aba-btn active" id="btn-aba-cards"    onclick="setAba('cards')">Operacional</button>
    <button class="aba-btn"        id="btn-aba-planilha" onclick="setAba('planilha')">Planilha</button>
  </div>

  <div id="view-cards"></div>
  <div id="view-planilha" style="display:none;"></div>
</div>

<!-- Modal montar escala -->
<div class="modal-overlay" id="modal-escala">
  <div class="modal" style="max-width:700px;max-height:95vh;">
    <div class="modal-handle"></div>
    <div class="modal-title" id="modal-escala-title">Montar Escala</div>
    <p id="modal-escala-sub" style="color:var(--text-muted);font-size:12px;margin-bottom:16px;"></p>
    <div class="montagem-grid" id="montagem-body"></div>
    <div class="modal-actions">
      <button class="btn-sm gray" onclick="fecharModal('modal-escala')">Fechar</button>
      <button class="btn-sm gold" id="btn-salvar-escala" onclick="salvarEscala()">Salvar Escala</button>
    </div>
  </div>
</div>

<!-- Modal nova celebração -->
<div class="modal-overlay" id="modal-celeb">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">Nova Celebração</div>
    <div class="form-group">
      <label class="form-label">Data *</label>
      <input class="form-input" id="nc-data" type="date">
    </div>
    <div class="form-group">
      <label class="form-label">Horário *</label>
      <select class="form-select" id="nc-horario">
        <option value="17h">17h</option>
        <option value="18h30">18h30</option>
        <option value="7h">7h</option>
        <option value="9h">9h</option>
        <option value="19h">19h</option>
        <option value="outro">Outro</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Comunidade *</label>
      <select class="form-select" id="nc-comunidade">
        <option value="matriz">Matriz</option>
        <option value="santo_antonio">Santo Antônio</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="nc-tipo">
        <option value="missa_comum">Missa Comum</option>
        <option value="solenidade">Solenidade</option>
        <option value="casamento">Casamento</option>
        <option value="batizado">Batizado</option>
        <option value="crisma">Crisma</option>
        <option value="ordenacao">Ordenação</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Observação (opcional)</label>
      <input class="form-input" id="nc-obs" placeholder="Ex: Corpus Christi">
    </div>
    <div class="modal-actions">
      <button class="btn-sm gray" onclick="fecharModal('modal-celeb')">Cancelar</button>
      <button class="btn-sm gold" onclick="salvarNovaCelebracao()">Salvar</button>
    </div>
  </div>
</div>

<script src="shared.js"></script>
<script>
// ── CONSTANTES ────────────────────────────────────────────────
const TEMPLATE_MATRIZ = [
  {funcao:'cred_altar',    label:'Cerimonial de Altar',    cat:'Cerimoniais', min:1},
  {funcao:'cred_credencia',label:'Cerimonial de Credência',cat:'Cerimoniais', min:1},
  {funcao:'missal',        label:'Missal',                 cat:'Cerimoniais', min:1},
  {funcao:'altar',         label:'Altar 1',                cat:'Altares',     min:1},
  {funcao:'altar',         label:'Altar 2',                cat:'Altares',     min:1},
  {funcao:'altar',         label:'Altar 3',                cat:'Altares',     min:1},
  {funcao:'cruz',          label:'Cruz',                   cat:'Litúrgicos',  min:1},
  {funcao:'vela',          label:'Vela 1',                 cat:'Litúrgicos',  min:1},
  {funcao:'vela',          label:'Vela 2',                 cat:'Litúrgicos',  min:1},
  {funcao:'sineta',        label:'Sineta',                 cat:'Litúrgicos',  min:1},
  {funcao:'sinao',         label:'Sinão',                  cat:'Litúrgicos',  min:1},
  {funcao:'apoio',         label:'Apoio 1',                cat:'Apoios',      min:1},
  {funcao:'apoio',         label:'Apoio 2',                cat:'Apoios',      min:1},
  {funcao:'apoio',         label:'Apoio 3',                cat:'Apoios',      min:1},
  {funcao:'apoio',         label:'Apoio 4',                cat:'Apoios',      min:1},
  {funcao:'apoio',         label:'Apoio 5',                cat:'Apoios',      min:1},
  {funcao:'apoio',         label:'Apoio 6',                cat:'Apoios',      min:1},
];
const TEMPLATE_STO = [
  {funcao:'cred_altar',    label:'Cerimonial',             cat:'Cerimoniais', min:1},
  {funcao:'missal',        label:'Missal',                 cat:'Cerimoniais', min:1},
  {funcao:'altar',         label:'Altar 1',                cat:'Altares',     min:1},
  {funcao:'altar',         label:'Altar 2',                cat:'Altares',     min:1},
  {funcao:'altar',         label:'Altar 3',                cat:'Altares',     min:1},
  {funcao:'cruz',          label:'Cruz',                   cat:'Litúrgicos',  min:1},
  {funcao:'vela',          label:'Vela 1',                 cat:'Litúrgicos',  min:1},
  {funcao:'vela',          label:'Vela 2',                 cat:'Litúrgicos',  min:1},
];
const FUNCOES = ['apoio','cruz','vela','sineta','sinao','altar','turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'];
const FUNCAO_LABEL = {
  apoio:'Apoio', cruz:'Cruz', vela:'Vela', sineta:'Sineta', sinao:'Sinão',
  altar:'Altar', turibulo:'Turíbulo', naveta:'Naveta', missal:'Missal',
  cred_altar:'Cred. Altar', cred_credencia:'Cred. Credência', mitra:'Mitra', baculo:'Báculo'
};
const TIPO_LABEL = {
  missa_comum:'Missa', solenidade:'Solenidade', casamento:'Casamento',
  batizado:'Batizado', crisma:'Crisma', ordenacao:'Ordenação'
};
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let ctx = null;
let celebracoes = [];
let escalasMap = {}; // celebracao_id → [escala entries]
let membros = [];
let habMap = {}; // membro_id → {funcao: proficiencia}
let dispMap = {}; // membro_id → ['sabado_17h', ...]
let pendingCelebId = null;
let pendingEscalasEditing = []; // posições sendo editadas no modal
let abaAtual = 'cards';

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  ctx = await initModulo(['coord_admin','subadmin','membro_equipe']);
  if (!ctx) return;
  renderHeader(ctx, 'escala');
  renderBottomNav(ctx.membership.role, 'escala');
  await loadEscala();
}

async function loadEscala() {
  const comunidade = document.getElementById('filtro-comunidade').value;

  // Busca celebrações futuras (+ 2 semanas passadas para contexto)
  let query = sb.from('acolitos_celebracoes')
    .select('*')
    .gte('data', new Date(Date.now() - 14*86400000).toISOString().slice(0,10))
    .lte('data', new Date(Date.now() + 56*86400000).toISOString().slice(0,10))
    .order('data').order('horario');
  if (comunidade) query = query.eq('comunidade', comunidade);
  const { data: celebs } = await query;
  celebracoes = celebs || [];

  if (!celebracoes.length) {
    renderCardsVazio(); return;
  }

  // Busca escalas para essas celebrações
  const ids = celebracoes.map(c => c.id);
  const { data: escalas } = await sb.from('acolitos_escalas')
    .select('*, acolitos_membros(id,nome)')
    .in('celebracao_id', ids);
  escalasMap = {};
  (escalas || []).forEach(e => {
    if (!escalasMap[e.celebracao_id]) escalasMap[e.celebracao_id] = [];
    escalasMap[e.celebracao_id].push(e);
  });

  // Busca membros + habilitações + disponibilidade (para modal montagem)
  const [{ data: mems }, { data: habs }, { data: disps }] = await Promise.all([
    sb.from('acolitos_membros').select('id,nome,comunidade,foto_url').eq('status','ativo').order('nome'),
    sb.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia'),
    sb.from('acolitos_disponibilidade').select('membro_id,dia,horario'),
  ]);
  membros = mems || [];
  habMap = {};
  (habs || []).forEach(h => {
    if (!habMap[h.membro_id]) habMap[h.membro_id] = {};
    habMap[h.membro_id][h.funcao] = h.proficiencia;
  });
  dispMap = {};
  (disps || []).forEach(d => {
    if (!dispMap[d.membro_id]) dispMap[d.membro_id] = [];
    dispMap[d.membro_id].push(d.dia + '_' + d.horario);
  });

  abaAtual === 'cards' ? renderCards() : renderPlanilha();
}

// ── ABA CARDS ─────────────────────────────────────────────────
function setAba(aba) {
  abaAtual = aba;
  document.getElementById('view-cards').style.display = aba === 'cards' ? '' : 'none';
  document.getElementById('view-planilha').style.display = aba === 'planilha' ? '' : 'none';
  document.getElementById('btn-aba-cards').classList.toggle('active', aba === 'cards');
  document.getElementById('btn-aba-planilha').classList.toggle('active', aba === 'planilha');
  aba === 'cards' ? renderCards() : renderPlanilha();
}

function renderCardsVazio() {
  const el = document.getElementById('view-cards');
  el.textContent = '';
  const em = document.createElement('span'); em.className = 'empty';
  em.textContent = 'Nenhuma celebração cadastrada para o período.';
  el.appendChild(em);
}

function getCobertura(celebId, comunidade) {
  const template = comunidade === 'santo_antonio' ? TEMPLATE_STO : TEMPLATE_MATRIZ;
  const escalasCeleb = escalasMap[celebId] || [];
  const cats = {};
  template.forEach(p => {
    if (!cats[p.cat]) cats[p.cat] = { min: 0, atual: 0 };
    cats[p.cat].min++;
  });
  escalasCeleb.forEach(e => {
    const pos = template.find(p => p.funcao === e.funcao);
    if (pos && cats[pos.cat]) cats[pos.cat].atual++;
  });
  const total = Object.values(cats).reduce((a,c) => a + c.min, 0);
  const preenchido = Object.values(cats).reduce((a,c) => a + Math.min(c.atual, c.min), 0);
  let status = 'vazia';
  if (preenchido >= total) status = 'completa';
  else if (preenchido >= total * 0.6) status = 'parcial';
  else if (preenchido > 0) status = 'critica';
  return { cats, total, preenchido, status };
}

function renderCards() {
  const el = document.getElementById('view-cards');
  el.textContent = '';
  if (!celebracoes.length) { renderCardsVazio(); return; }

  // Agrupa por semana
  const semanas = {};
  celebracoes.forEach(c => {
    const d = new Date(c.data + 'T00:00:00');
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay()+6)%7));
    const key = monday.toISOString().slice(0,10);
    if (!semanas[key]) semanas[key] = { label: '', items: [] };
    semanas[key].label = 'Semana de ' + monday.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    semanas[key].items.push(c);
  });

  Object.values(semanas).forEach(sem => {
    const grp = document.createElement('div'); grp.className = 'semana-grupo';
    const titulo = document.createElement('div'); titulo.className = 'semana-titulo';
    titulo.textContent = sem.label;
    const grid = document.createElement('div'); grid.className = 'celebracoes-grid';

    sem.items.forEach(c => {
      const cob = getCobertura(c.id, c.comunidade);
      const d = new Date(c.data + 'T00:00:00');
      const card = document.createElement('div');
      card.className = 'celeb-card status-' + cob.status;

      // Header
      const hdr = document.createElement('div'); hdr.className = 'celeb-header';
      const info = document.createElement('div');
      const dataEl = document.createElement('div'); dataEl.className = 'celeb-data';
      dataEl.textContent = DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'}) + ' · ' + c.horario;
      const subEl = document.createElement('div'); subEl.className = 'celeb-sub';
      subEl.textContent = (c.comunidade === 'matriz' ? 'Matriz' : 'Sto. Antônio') + ' · ' + (TIPO_LABEL[c.tipo] || c.tipo);
      if (c.observacoes) { const obs = document.createElement('div'); obs.className = 'celeb-sub'; obs.textContent = c.observacoes; subEl.appendChild(document.createElement('br')); subEl.appendChild(obs); }
      info.append(dataEl, subEl);
      const pill = document.createElement('span'); pill.className = 'status-pill ' + cob.status;
      pill.textContent = cob.status.charAt(0).toUpperCase() + cob.status.slice(1);
      hdr.append(info, pill); card.appendChild(hdr);

      // Barras de cobertura
      Object.entries(cob.cats).forEach(([cat, v]) => {
        const row = document.createElement('div'); row.className = 'cobertura-row';
        const lbl = document.createElement('span'); lbl.className = 'cobertura-label'; lbl.textContent = cat;
        const bar = document.createElement('div'); bar.className = 'cobertura-bar';
        const fill = document.createElement('div'); fill.className = 'cobertura-fill';
        const pct = v.min > 0 ? Math.min(v.atual / v.min, 1) * 100 : 0;
        fill.style.width = pct + '%';
        fill.className = 'cobertura-fill ' + (pct >= 100 ? 'ok' : pct >= 50 ? 'parcial' : 'critico');
        bar.appendChild(fill);
        const num = document.createElement('span'); num.className = 'cobertura-num';
        num.textContent = v.atual + '/' + v.min;
        row.append(lbl, bar, num); card.appendChild(row);
      });

      // Botões
      const actions = document.createElement('div'); actions.className = 'celeb-actions';
      const btnMontar = document.createElement('button');
      btnMontar.className = 'btn-sm ' + (cob.preenchido > 0 ? 'gold' : 'wine');
      btnMontar.textContent = cob.preenchido > 0 ? 'Editar Escala' : 'Montar Escala';
      btnMontar.onclick = () => abrirMontagem(c);
      actions.appendChild(btnMontar);
      if (cob.preenchido > 0) {
        const btnVer = document.createElement('button'); btnVer.className = 'btn-sm gray';
        btnVer.textContent = 'Ver Lista';
        btnVer.onclick = () => abrirListaEscalados(c);
        actions.appendChild(btnVer);
      }
      card.appendChild(actions);
      grid.appendChild(card);
    });

    grp.append(titulo, grid); el.appendChild(grp);
  });
}

// ── MODAL MONTAGEM ────────────────────────────────────────────
function abrirMontagem(celeb) {
  pendingCelebId = celeb.id;
  const template = celeb.comunidade === 'santo_antonio' ? TEMPLATE_STO : TEMPLATE_MATRIZ;
  const d = new Date(celeb.data + 'T00:00:00');
  document.getElementById('modal-escala-title').textContent =
    DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR', {day:'2-digit',month:'long'}) + ' · ' + celeb.horario;
  document.getElementById('modal-escala-sub').textContent =
    (celeb.comunidade === 'matriz' ? 'Matriz' : 'Sto. Antônio') + ' · ' + (TIPO_LABEL[celeb.tipo] || celeb.tipo);

  const escalasCeleb = escalasMap[celeb.id] || [];
  const body = document.getElementById('montagem-body'); body.textContent = '';

  // Detecta dia/horario para filtrar disponibilidade
  const dObj = new Date(celeb.data + 'T00:00:00');
  const dow = dObj.getDay();
  const diaKey = dow === 0 ? 'domingo' : dow === 6 ? 'sabado' : null;
  const horarioKey = diaKey ? diaKey + '_' + celeb.horario : null;

  // Coluna esquerda: posições
  const colPos = document.createElement('div');
  const posTitle = document.createElement('div'); posTitle.className = 'page-title'; posTitle.style.fontSize = '12px';
  posTitle.textContent = 'Posições'; colPos.appendChild(posTitle);

  let catAtual = '';
  pendingEscalasEditing = [];

  template.forEach((pos, idx) => {
    if (pos.cat !== catAtual) {
      catAtual = pos.cat;
      const catEl = document.createElement('div'); catEl.className = 'cat-titulo'; catEl.textContent = pos.cat;
      colPos.appendChild(catEl);
    }
    const row = document.createElement('div'); row.className = 'pos-item';
    const lbl = document.createElement('span'); lbl.className = 'pos-label'; lbl.textContent = pos.label;

    // Membro já escalado nessa posição (match por funcao + posição na lista)
    const jaEscaladoNessaFuncao = escalasCeleb.filter(e => e.funcao === pos.funcao);
    const escaladoExistente = jaEscaladoNessaFuncao[
      template.slice(0,idx).filter(p => p.funcao === pos.funcao).length
    ];

    const sel = document.createElement('select'); sel.className = 'pos-select';
    sel.setAttribute('data-funcao', pos.funcao);
    sel.setAttribute('data-pos-idx', idx);
    if (escaladoExistente) sel.setAttribute('data-escala-id', escaladoExistente.id);

    const optVazia = document.createElement('option'); optVazia.value = '';
    optVazia.textContent = '— Selecionar —'; sel.appendChild(optVazia);

    // Filtra membros elegíveis para essa função
    const elegíveis = membros.filter(m => {
      const hab = (habMap[m.membro_id || m.id] || {})[pos.funcao];
      return hab && ['apto','experiente','referencia'].includes(hab);
    });

    elegíveis.forEach(m => {
      const opt = document.createElement('option'); opt.value = m.id;
      const dispOk = !horarioKey || (dispMap[m.id] || []).includes(horarioKey);
      opt.textContent = (dispOk ? '' : '⚠ ') + m.nome;
      opt.className = 'membro-opcao';
      if (escaladoExistente?.membro_id === m.id) opt.selected = true;
      sel.appendChild(opt);
    });

    if (escaladoExistente) sel.classList.add('preenchido');
    sel.onchange = () => { sel.classList.toggle('preenchido', !!sel.value); };

    pendingEscalasEditing.push({ sel, pos, escaladoId: escaladoExistente?.id });
    row.append(lbl, sel); colPos.appendChild(row);
  });

  // Coluna direita: lista de todos membros com aptidões
  const colMems = document.createElement('div');
  const memTitle = document.createElement('div'); memTitle.className = 'page-title'; memTitle.style.fontSize = '12px';
  memTitle.textContent = 'Membros Disponíveis'; colMems.appendChild(memTitle);

  const memList = document.createElement('div');
  memList.style.cssText = 'max-height:320px;overflow-y:auto;';
  membros.forEach(m => {
    const habs = habMap[m.id] || {};
    const aptFuncoes = FUNCOES.filter(f => ['apto','experiente','referencia'].includes(habs[f]));
    if (!aptFuncoes.length) return;
    const dispOk = !horarioKey || (dispMap[m.id] || []).includes(horarioKey);
    const item = document.createElement('div');
    item.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--border);opacity:' + (dispOk ? '1' : '.5') + ';';
    const nomeEl = document.createElement('div'); nomeEl.style.cssText = 'font-size:12px;color:var(--text);margin-bottom:4px;';
    nomeEl.textContent = (dispOk ? '' : '⚠ ') + m.nome;
    const funcoesEl = document.createElement('div'); funcoesEl.style.cssText = 'font-size:10px;color:var(--gold);';
    funcoesEl.textContent = aptFuncoes.map(f => FUNCAO_LABEL[f]).join(', ');
    item.append(nomeEl, funcoesEl); memList.appendChild(item);
  });
  colMems.appendChild(memList);

  body.append(colPos, colMems);
  document.getElementById('modal-escala').classList.add('open');
}

async function salvarEscala() {
  if (!pendingCelebId) return;
  const btn = document.getElementById('btn-salvar-escala');
  btn.disabled = true; btn.textContent = 'Salvando...';

  // Deleta escalas existentes e recria
  await sb.from('acolitos_escalas').delete().eq('celebracao_id', pendingCelebId);

  const novasEscalas = [];
  const membrosFuncaoCount = {};

  pendingEscalasEditing.forEach(({ sel, pos }) => {
    if (!sel.value) return;
    // Garante unique por membro+funcao (evita duplicata no mesmo slot)
    const key = sel.value + '_' + pos.funcao;
    if (!membrosFuncaoCount[key]) {
      membrosFuncaoCount[key] = 0;
      novasEscalas.push({
        celebracao_id: pendingCelebId,
        membro_id: sel.value,
        funcao: pos.funcao,
        created_by: ctx.user.id
      });
    }
  });

  if (novasEscalas.length) {
    const { error } = await sb.from('acolitos_escalas').insert(novasEscalas);
    if (error) { alert('Erro ao salvar: ' + error.message); btn.disabled = false; btn.textContent = 'Salvar Escala'; return; }
  }

  btn.disabled = false; btn.textContent = 'Salvar Escala';
  fecharModal('modal-escala');
  await loadEscala();
}

function abrirListaEscalados(celeb) {
  const escalas = escalasMap[celeb.id] || [];
  const d = new Date(celeb.data + 'T00:00:00');
  const titulo = DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' · ' + celeb.horario;
  alert(titulo + '\n\n' + escalas.map(e =>
    (FUNCAO_LABEL[e.funcao] || e.funcao) + ': ' + (e.acolitos_membros?.nome || '—')
  ).join('\n'));
}

// ── PLANILHA ──────────────────────────────────────────────────
function renderPlanilha() {
  const el = document.getElementById('view-planilha');
  el.textContent = '';
  if (!membros.length || !celebracoes.length) {
    const em = document.createElement('span'); em.className = 'empty';
    em.textContent = 'Sem dados para exibir.'; el.appendChild(em); return;
  }

  const wrap = document.createElement('div'); wrap.className = 'planilha-wrap';
  const table = document.createElement('table'); table.className = 'planilha-table';

  // Header
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  // Colunas fixas
  ['Membro','Freq%','Fn.Máx'].forEach((h,i) => {
    const th = document.createElement('th');
    if (i === 0) th.className = 'sticky-col';
    th.textContent = h; hr.appendChild(th);
  });
  // Colunas de celebração
  celebracoes.forEach(c => {
    const d = new Date(c.data + 'T00:00:00');
    const th = document.createElement('th');
    th.style.minWidth = '80px'; th.style.textAlign = 'center';
    const l1 = document.createElement('div'); l1.textContent = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    const l2 = document.createElement('div'); l2.style.color = 'var(--text-muted)'; l2.textContent = c.horario + ' ' + (c.comunidade==='matriz'?'M':'SA');
    th.append(l1,l2); hr.appendChild(th);
  });
  thead.appendChild(hr); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  membros.forEach(m => {
    const tr = document.createElement('tr');
    // Nome
    const tdNome = document.createElement('td'); tdNome.className = 'sticky-col';
    tdNome.style.cssText = 'min-width:120px;';
    const nomeEl = document.createElement('span'); nomeEl.textContent = m.nome;
    nomeEl.style.cssText = 'font-size:12px;color:var(--text);';
    tdNome.appendChild(nomeEl); tr.appendChild(tdNome);

    // Freq
    const tdFreq = document.createElement('td'); tdFreq.textContent = '—'; tr.appendChild(tdFreq);

    // Função máxima
    const habs = habMap[m.id] || {};
    const nivelOrder = ['referencia','experiente','apto','em_formacao','nao_treinado'];
    let fnMax = '—';
    for (const fn of ['cred_credencia','cred_altar','missal','turibulo','naveta','altar','sineta','sinao','cruz','vela','apoio']) {
      if (['apto','experiente','referencia'].includes(habs[fn])) { fnMax = FUNCAO_LABEL[fn]; break; }
    }
    const tdFn = document.createElement('td');
    tdFn.style.cssText = 'font-size:10px;color:var(--gold);'; tdFn.textContent = fnMax; tr.appendChild(tdFn);

    // Células por celebração
    celebracoes.forEach(c => {
      const td = document.createElement('td'); td.style.textAlign = 'center';
      const escalaCeleb = (escalasMap[c.id] || []).find(e => e.membro_id === m.id);
      if (escalaCeleb) {
        const cell = document.createElement('span');
        cell.className = 'escala-cell escalado';
        cell.textContent = FUNCAO_LABEL[escalaCeleb.funcao] || escalaCeleb.funcao;
        td.appendChild(cell);
      } else {
        td.textContent = '—'; td.style.color = 'var(--border)';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
}

// ── NOVA CELEBRAÇÃO ───────────────────────────────────────────
function abrirNovaCelebracao() {
  document.getElementById('nc-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('modal-celeb').classList.add('open');
}

async function salvarNovaCelebracao() {
  const data = document.getElementById('nc-data').value;
  const horario = document.getElementById('nc-horario').value;
  const comunidade = document.getElementById('nc-comunidade').value;
  const tipo = document.getElementById('nc-tipo').value;
  const obs = document.getElementById('nc-obs').value.trim();
  if (!data || !horario) { alert('Data e horário obrigatórios.'); return; }
  const { error } = await sb.from('acolitos_celebracoes').insert({
    data, horario, comunidade, tipo, observacoes: obs || null, created_by: ctx.user.id
  });
  if (error) { alert('Erro: ' + error.message); return; }
  fecharModal('modal-celeb');
  await loadEscala();
}

function fecharModal(id) { document.getElementById(id)?.classList.remove('open'); }
init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Logar como equipe → cards das próximas missas aparecem com barras de cobertura ✓
2. "Montar Escala" em uma celebração → modal abre com posições e membros elegíveis ✓
3. Selecionar membros e salvar → barras atualizam, status muda para Parcial/Completa ✓
4. Toggle Planilha → tabela mostra membros × celebrações com funções nas células ✓
5. "+ Celebração" → modal para criar celebração avulsa ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/escala.html
git commit -m "feat: escala.html — visão operacional, planilha e montagem de escala"
```

---

## Task 11: ausencias.html

**Files:**
- Create: `projetos/acolitos/ausencias.html`

- [ ] **Step 1: Criar `projetos/acolitos/ausencias.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ausências — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    .ausencia-item {
      background:var(--surface); border:1px solid var(--border-wine);
      border-radius:4px; padding:14px 16px; margin-bottom:10px;
    }
    .ausencia-data { font-family:'Cinzel',serif; font-size:13px; color:var(--text); margin-bottom:4px; }
    .ausencia-meta { font-size:11px; color:var(--text-muted); }
    .ausencia-status {
      display:inline-block; padding:2px 8px; border-radius:10px;
      font-size:9px; font-family:'Cinzel',serif; border:1px solid; margin-top:6px;
    }
    .ausencia-status.registrada { background:rgba(30,80,30,.2); color:var(--success-text); border-color:var(--success); }
    .motivo-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; }
    .motivo-btn {
      padding:12px 8px; min-height:48px; background:var(--surface2);
      border:1px solid var(--border); border-radius:3px; color:var(--text-muted);
      cursor:pointer; font-size:12px; text-align:center; transition:all .2s;
      -webkit-tap-highlight-color:transparent;
    }
    .motivo-btn.active { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,.08); }
    .equipe-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:10px 0; border-bottom:1px solid var(--border);
    }
    .equipe-row-info { flex:1; }
    .equipe-row-nome { font-size:13px; color:var(--text); margin-bottom:2px; }
    .equipe-row-meta { font-size:11px; color:var(--text-muted); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js" integrity="sha384-4Cjkyy4cE1EgIS0C+Y3xzGmJ2noQFRRU91yKAW8IxtPfVtbQXPMqadSc3sYnjwou" crossorigin="anonymous"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>

<div class="main" id="main-content">
  <span class="loading">Carregando...</span>
</div>

<script src="shared.js"></script>
<script>
const MOTIVO_LABEL = { doenca:'🤒 Doença', viagem:'✈️ Viagem', familia:'👨‍👩‍👧 Família', outro:'📌 Outro' };
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];

let ctx = null;
let motivoSelecionado = 'doenca';

async function init() {
  ctx = await initModulo();
  if (!ctx) return;
  renderHeader(ctx, 'ausencias');
  renderBottomNav(ctx.membership.role, 'ausencias');
  EQUIPE_ROLES.includes(ctx.membership.role) ? await renderViewEquipe() : await renderViewMembro();
}

// ── VIEW MEMBRO ───────────────────────────────────────────────
async function renderViewMembro() {
  const main = document.getElementById('main-content');
  main.textContent = '';

  if (!ctx.membro) {
    const em = document.createElement('span'); em.className = 'empty';
    em.textContent = 'Perfil de membro não encontrado.'; main.appendChild(em); return;
  }

  const title = document.createElement('h1'); title.className = 'page-title';
  title.textContent = 'Informar Ausência'; main.appendChild(title);

  // Busca próximas escalas do membro
  const { data: escalas } = await sb
    .from('acolitos_escalas')
    .select('id, funcao, celebracao_id, acolitos_celebracoes(id,data,horario,comunidade)')
    .eq('membro_id', ctx.membro.id)
    .in('status', ['escalado'])
    .gte('acolitos_celebracoes.data', new Date().toISOString().slice(0,10))
    .order('acolitos_celebracoes(data)');

  const proximasEscalas = (escalas || []).filter(e => e.acolitos_celebracoes);

  if (!proximasEscalas.length) {
    const info = document.createElement('div');
    info.style.cssText = 'color:var(--text-muted);font-size:14px;font-style:italic;padding:24px 0;';
    info.textContent = 'Você não possui escalas futuras no momento.';
    main.appendChild(info);
  } else {
    const formCard = document.createElement('div'); formCard.className = 'section-card';

    // Seletor de missa
    const grpMissa = document.createElement('div'); grpMissa.className = 'form-group';
    const lblMissa = document.createElement('label'); lblMissa.className = 'form-label'; lblMissa.textContent = 'Selecione a missa *';
    const selMissa = document.createElement('select'); selMissa.className = 'form-select'; selMissa.id = 'sel-escala';
    const optVazia = document.createElement('option'); optVazia.value = ''; optVazia.textContent = 'Selecionar...';
    selMissa.appendChild(optVazia);
    proximasEscalas.forEach(e => {
      const c = e.acolitos_celebracoes;
      const d = new Date(c.data + 'T00:00:00');
      const opt = document.createElement('option'); opt.value = e.id;
      opt.textContent = DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' ' + c.horario + ' · ' + (c.comunidade==='matriz'?'Matriz':'Sto. Antônio');
      selMissa.appendChild(opt);
    });
    grpMissa.append(lblMissa, selMissa); formCard.appendChild(grpMissa);

    // Motivo
    const lblMotivo = document.createElement('label'); lblMotivo.className = 'form-label'; lblMotivo.textContent = 'Motivo *';
    const motivoGrid = document.createElement('div'); motivoGrid.className = 'motivo-grid';
    Object.entries(MOTIVO_LABEL).forEach(([val, label]) => {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'motivo-btn' + (val === 'doenca' ? ' active' : '');
      btn.textContent = label; btn.setAttribute('data-motivo', val);
      btn.onclick = () => {
        motivoSelecionado = val;
        document.querySelectorAll('.motivo-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
      motivoGrid.appendChild(btn);
    });
    formCard.append(lblMotivo, motivoGrid);

    // Observação
    const grpObs = document.createElement('div'); grpObs.className = 'form-group';
    const lblObs = document.createElement('label'); lblObs.className = 'form-label'; lblObs.textContent = 'Observação (opcional)';
    const txtObs = document.createElement('input'); txtObs.className = 'form-input'; txtObs.id = 'obs-ausencia'; txtObs.placeholder = 'Detalhes adicionais...';
    grpObs.append(lblObs, txtObs); formCard.appendChild(grpObs);

    const btnEnviar = document.createElement('button'); btnEnviar.className = 'btn gold';
    btnEnviar.id = 'btn-enviar-ausencia'; btnEnviar.textContent = 'Confirmar Ausência';
    btnEnviar.onclick = () => enviarAusencia(proximasEscalas);
    formCard.appendChild(btnEnviar);

    const msgEl = document.createElement('div'); msgEl.id = 'msg-ausencia'; msgEl.className = 'msg';
    formCard.appendChild(msgEl);
    main.appendChild(formCard);
  }

  // Histórico de ausências
  const histTitle = document.createElement('div'); histTitle.className = 'page-title';
  histTitle.style.cssText = 'font-size:14px;margin-top:20px;'; histTitle.textContent = 'Últimas Ausências';
  main.appendChild(histTitle);

  const { data: historico } = await sb
    .from('acolitos_ausencias')
    .select('*, acolitos_celebracoes(data,horario,comunidade)')
    .eq('membro_id', ctx.membro.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!historico?.length) {
    const em = document.createElement('span'); em.className = 'empty'; em.style.paddingTop = '16px';
    em.textContent = 'Nenhuma ausência registrada.'; main.appendChild(em);
  } else {
    historico.forEach(a => {
      const c = a.acolitos_celebracoes;
      const d = c ? new Date(c.data + 'T00:00:00') : null;
      const item = document.createElement('div'); item.className = 'ausencia-item';
      const dataEl = document.createElement('div'); dataEl.className = 'ausencia-data';
      dataEl.textContent = d ? DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' · ' + c.horario : '—';
      const metaEl = document.createElement('div'); metaEl.className = 'ausencia-meta';
      metaEl.textContent = (MOTIVO_LABEL[a.motivo] || a.motivo) + (a.observacao ? ' · ' + a.observacao : '');
      const status = document.createElement('span'); status.className = 'ausencia-status registrada';
      status.textContent = 'Registrada';
      item.append(dataEl, metaEl, status); main.appendChild(item);
    });
  }
}

async function enviarAusencia(proximasEscalas) {
  const btn = document.getElementById('btn-enviar-ausencia');
  const escalaId = document.getElementById('sel-escala').value;
  const obs = document.getElementById('obs-ausencia').value.trim();
  const msgEl = document.getElementById('msg-ausencia');

  if (!escalaId) {
    msgEl.className = 'msg error'; msgEl.textContent = 'Selecione a missa.'; return;
  }
  btn.disabled = true; btn.textContent = 'Enviando...';

  // Encontra a celebração correspondente
  const escala = proximasEscalas.find(e => e.id === escalaId);
  if (!escala) { btn.disabled = false; btn.textContent = 'Confirmar Ausência'; return; }

  // Insere ausência
  const { error: eAus } = await sb.from('acolitos_ausencias').upsert({
    membro_id: ctx.membro.id,
    celebracao_id: escala.acolitos_celebracoes.id,
    motivo: motivoSelecionado,
    observacao: obs || null
  }, { onConflict: 'membro_id,celebracao_id' });

  if (eAus) {
    msgEl.className = 'msg error'; msgEl.textContent = 'Erro ao registrar. Tente novamente.';
    btn.disabled = false; btn.textContent = 'Confirmar Ausência'; return;
  }

  // Atualiza status na escala
  await sb.from('acolitos_escalas')
    .update({ status: 'ausente_justificado' })
    .eq('id', escalaId);

  msgEl.className = 'msg success'; msgEl.textContent = 'Ausência registrada com sucesso.';
  btn.disabled = true; btn.textContent = 'Registrado ✓';
  setTimeout(() => renderViewMembro(), 1500);
}

// ── VIEW EQUIPE ───────────────────────────────────────────────
async function renderViewEquipe() {
  const main = document.getElementById('main-content');
  main.textContent = '';

  const title = document.createElement('h1'); title.className = 'page-title';
  title.textContent = 'Ausências Informadas'; main.appendChild(title);

  const { data: ausencias } = await sb
    .from('acolitos_ausencias')
    .select('*, acolitos_membros(nome), acolitos_celebracoes(data,horario,comunidade)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!ausencias?.length) {
    const em = document.createElement('span'); em.className = 'empty';
    em.textContent = 'Nenhuma ausência informada.'; main.appendChild(em); return;
  }

  ausencias.forEach(a => {
    const c = a.acolitos_celebracoes;
    const d = c ? new Date(c.data + 'T00:00:00') : null;
    const row = document.createElement('div'); row.className = 'equipe-row';
    const info = document.createElement('div'); info.className = 'equipe-row-info';
    const nomeEl = document.createElement('div'); nomeEl.className = 'equipe-row-nome';
    nomeEl.textContent = a.acolitos_membros?.nome || '—';
    const metaEl = document.createElement('div'); metaEl.className = 'equipe-row-meta';
    metaEl.textContent = (d ? DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' · ' + c.horario : '—')
      + ' · ' + (MOTIVO_LABEL[a.motivo] || a.motivo);
    info.append(nomeEl, metaEl);
    const badge = document.createElement('span'); badge.className = 'badge coroinha';
    badge.textContent = 'AJ';
    row.append(info, badge); main.appendChild(row);
  });
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Membro logado → vê dropdown com próximas escalas ✓
2. Selecionar missa + motivo + confirmar → status da escala vira AJ ✓
3. Histórico atualiza ✓
4. Equipe logada → vê lista de todas as ausências ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat: ausencias.html — comunicado de ausência para membros e equipe"
```

---

## Task 12: chamada.html

**Files:**
- Create: `projetos/acolitos/chamada.html`

- [ ] **Step 1: Criar `projetos/acolitos/chamada.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chamada — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    .celeb-selector { display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
    .celeb-option {
      background:var(--surface); border:1px solid var(--border-wine);
      border-radius:4px; padding:14px 16px; cursor:pointer;
      transition:border-color .2s; -webkit-tap-highlight-color:transparent;
    }
    .celeb-option:active,.celeb-option.selected { border-color:var(--gold); background:rgba(201,168,76,.05); }
    .celeb-option-data { font-family:'Cinzel',serif; font-size:14px; color:var(--text); }
    .celeb-option-sub  { font-size:11px; color:var(--text-muted); margin-top:2px; }
    .chamada-item {
      display:flex; align-items:center; gap:12px; padding:12px 0;
      border-bottom:1px solid var(--border);
    }
    .chamada-nome { flex:1; }
    .chamada-nome-text { font-size:14px; color:var(--text); }
    .chamada-funcao    { font-size:11px; color:var(--gold); margin-top:2px; font-family:'Cinzel',serif; }
    .resultado-btns { display:flex; gap:6px; flex-shrink:0; }
    .r-btn {
      width:36px; height:36px; border-radius:50%; border:1px solid var(--border);
      background:var(--surface2); cursor:pointer; font-size:14px; line-height:1;
      display:flex; align-items:center; justify-content:center;
      transition:all .2s; -webkit-tap-highlight-color:transparent;
    }
    .r-btn.selected-presente { background:rgba(30,80,30,.3); border-color:var(--success); }
    .r-btn.selected-atrasado { background:rgba(120,80,0,.2); border-color:var(--warn-text); }
    .r-btn.selected-ausente  { background:rgba(100,10,10,.3); border-color:var(--danger-text); }
    .chamada-cat {
      font-family:'Cinzel',serif; font-size:10px; color:var(--gold);
      letter-spacing:1px; text-transform:uppercase; padding:12px 0 4px;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js" integrity="sha384-4Cjkyy4cE1EgIS0C+Y3xzGmJ2noQFRRU91yKAW8IxtPfVtbQXPMqadSc3sYnjwou" crossorigin="anonymous"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>

<div class="main" id="main-content">
  <span class="loading">Carregando...</span>
</div>

<script src="shared.js"></script>
<script>
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const FUNCAO_LABEL = {
  apoio:'Apoio', cruz:'Cruz', vela:'Vela', sineta:'Sineta', sinao:'Sinão',
  altar:'Altar', turibulo:'Turíbulo', naveta:'Naveta', missal:'Missal',
  cred_altar:'Cred. Altar', cred_credencia:'Cred. Credência', mitra:'Mitra', baculo:'Báculo'
};
const CAT_ORDER = ['cred_credencia','cred_altar','missal','altar','turibulo','naveta','cruz','vela','sineta','sinao','apoio','mitra','baculo'];

let ctx = null;
let celebSelecionada = null;
let escalasAtuais = [];
let resultados = {}; // escala_id → 'presente'|'atrasado'|'ausente'

async function init() {
  ctx = await initModulo(['coord_admin','subadmin','membro_equipe','cerimonario']);
  if (!ctx) return;
  renderHeader(ctx, 'chamada');
  renderBottomNav(ctx.membership.role, 'chamada');
  await renderSelecaoCelebracao();
}

async function renderSelecaoCelebracao() {
  const main = document.getElementById('main-content');
  main.textContent = '';

  const title = document.createElement('h1'); title.className = 'page-title';
  title.textContent = 'Chamada de Escala'; main.appendChild(title);

  const sub = document.createElement('p');
  sub.style.cssText = 'color:var(--text-muted);font-size:13px;margin-bottom:20px;font-style:italic;';
  sub.textContent = 'Selecione a celebração para fazer a chamada:'; main.appendChild(sub);

  // Busca próximas celebrações que têm escala publicada
  const { data: celebs } = await sb
    .from('acolitos_celebracoes')
    .select('*, acolitos_escalas(id)')
    .gte('data', new Date(Date.now() - 2*86400000).toISOString().slice(0,10))
    .lte('data', new Date(Date.now() + 7*86400000).toISOString().slice(0,10))
    .order('data').order('horario');

  const comEscala = (celebs || []).filter(c => c.acolitos_escalas?.length > 0);

  if (!comEscala.length) {
    const em = document.createElement('span'); em.className = 'empty';
    em.textContent = 'Nenhuma celebração com escala publicada nos próximos 7 dias.';
    main.appendChild(em); return;
  }

  const selector = document.createElement('div'); selector.className = 'celeb-selector';
  comEscala.forEach(c => {
    const d = new Date(c.data + 'T00:00:00');
    const opt = document.createElement('div'); opt.className = 'celeb-option';
    opt.onclick = () => abrirChamada(c);
    const dataEl = document.createElement('div'); dataEl.className = 'celeb-option-data';
    dataEl.textContent = DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'}) + ' · ' + c.horario;
    const subEl = document.createElement('div'); subEl.className = 'celeb-option-sub';
    subEl.textContent = (c.comunidade === 'matriz' ? 'Matriz' : 'Sto. Antônio') + ' · ' + c.acolitos_escalas.length + ' escalados';
    opt.append(dataEl, subEl); selector.appendChild(opt);
  });
  main.appendChild(selector);
}

async function abrirChamada(celeb) {
  celebSelecionada = celeb;
  resultados = {};
  const main = document.getElementById('main-content'); main.textContent = '';

  const d = new Date(celeb.data + 'T00:00:00');
  const title = document.createElement('h1'); title.className = 'page-title';
  title.textContent = DIA_SEMANA[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' · ' + celeb.horario;
  main.appendChild(title);

  // Busca escala completa com nomes
  const { data: escalas } = await sb
    .from('acolitos_escalas')
    .select('id, funcao, status, membro_id, acolitos_membros(nome, foto_url)')
    .eq('celebracao_id', celeb.id)
    .order('funcao');
  escalasAtuais = escalas || [];

  if (!escalasAtuais.length) {
    const em = document.createElement('span'); em.className = 'empty';
    em.textContent = 'Nenhum membro escalado.'; main.appendChild(em); return;
  }

  // Verifica se chamada já foi feita
  const { data: chamadaExist } = await sb
    .from('acolitos_chamadas').select('id').eq('celebracao_id', celeb.id).maybeSingle();
  if (chamadaExist) {
    const aviso = document.createElement('div'); aviso.className = 'msg warn';
    aviso.textContent = 'Chamada já realizada para esta celebração. Você pode editá-la.';
    main.appendChild(aviso);
  }

  // Inicializa resultados com status atual
  escalasAtuais.forEach(e => {
    if (['presente','ausente','atrasado'].includes(e.status)) resultados[e.id] = e.status;
    else if (e.status === 'ausente_justificado') resultados[e.id] = 'ausente';
    else resultados[e.id] = 'presente'; // default
  });

  // Renderiza lista agrupada por categoria
  const catMap = {};
  escalasAtuais.forEach(e => {
    const cat = getCat(e.funcao);
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(e);
  });

  Object.entries(catMap).forEach(([cat, items]) => {
    const catEl = document.createElement('div'); catEl.className = 'chamada-cat'; catEl.textContent = cat;
    main.appendChild(catEl);
    items.forEach(e => {
      const m = e.acolitos_membros;
      const item = document.createElement('div'); item.className = 'chamada-item';
      const avatarEl = buildAvatarEl(m?.foto_url, 'aspirante', 40); avatarEl.style.flexShrink = '0';
      const nomeDiv = document.createElement('div'); nomeDiv.className = 'chamada-nome';
      const nomeEl = document.createElement('div'); nomeEl.className = 'chamada-nome-text'; nomeEl.textContent = m?.nome || '—';
      const fnEl = document.createElement('div'); fnEl.className = 'chamada-funcao'; fnEl.textContent = FUNCAO_LABEL[e.funcao] || e.funcao;
      nomeDiv.append(nomeEl, fnEl);

      const btns = document.createElement('div'); btns.className = 'resultado-btns';
      [
        { val:'presente', icon:'✅', title:'Presente' },
        { val:'atrasado', icon:'⏰', title:'Atrasado' },
        { val:'ausente',  icon:'❌', title:'Ausente'  },
      ].forEach(({val, icon, title}) => {
        const btn = document.createElement('button'); btn.type = 'button';
        btn.className = 'r-btn' + (resultados[e.id] === val ? ' selected-' + val : '');
        btn.title = title; btn.textContent = icon; btn.setAttribute('data-escala', e.id); btn.setAttribute('data-val', val);
        btn.onclick = () => setResultado(e.id, val);
        btns.appendChild(btn);
      });

      item.append(avatarEl, nomeDiv, btns); main.appendChild(item);
    });
  });

  // Botão confirmar
  const btnConfirm = document.createElement('button'); btnConfirm.className = 'btn gold';
  btnConfirm.style.marginTop = '20px'; btnConfirm.textContent = 'Confirmar Chamada';
  btnConfirm.id = 'btn-confirmar-chamada'; btnConfirm.onclick = confirmarChamada;
  const btnVoltar = document.createElement('button'); btnVoltar.className = 'btn';
  btnVoltar.style.cssText = 'margin-top:8px;background:transparent;border:1px solid var(--border);color:var(--text-muted);';
  btnVoltar.textContent = '← Escolher outra celebração'; btnVoltar.onclick = renderSelecaoCelebracao;
  main.append(btnConfirm, btnVoltar);
}

function getCat(funcao) {
  if (['cred_altar','cred_credencia','missal'].includes(funcao)) return 'Cerimoniais';
  if (['altar','turibulo','naveta'].includes(funcao)) return 'Altares';
  if (['cruz','vela','sineta','sinao'].includes(funcao)) return 'Litúrgicos';
  if (['mitra','baculo'].includes(funcao)) return 'Episcopal';
  return 'Apoio';
}

function setResultado(escalaId, val) {
  resultados[escalaId] = val;
  // Atualiza visual dos botões
  document.querySelectorAll(`.r-btn[data-escala="${escalaId}"]`).forEach(btn => {
    const btnVal = btn.getAttribute('data-val');
    btn.className = 'r-btn' + (btnVal === val ? ' selected-' + val : '');
  });
}

async function confirmarChamada() {
  const btn = document.getElementById('btn-confirmar-chamada');
  btn.disabled = true; btn.textContent = 'Salvando...';

  // Cria ou busca a chamada
  let chamadaId;
  const { data: existente } = await sb
    .from('acolitos_chamadas').select('id').eq('celebracao_id', celebSelecionada.id).maybeSingle();
  if (existente) {
    chamadaId = existente.id;
    await sb.from('acolitos_chamadas_itens').delete().eq('chamada_id', chamadaId);
  } else {
    const { data: nova } = await sb.from('acolitos_chamadas').insert({
      celebracao_id: celebSelecionada.id, realizada_por: ctx.user.id
    }).select('id').single();
    chamadaId = nova?.id;
  }

  if (!chamadaId) { btn.disabled = false; btn.textContent = 'Confirmar Chamada'; return; }

  // Insere itens + atualiza status das escalas
  const itens = Object.entries(resultados).map(([escalaId, resultado]) => ({
    chamada_id: chamadaId, escala_id: escalaId, resultado
  }));
  if (itens.length) await sb.from('acolitos_chamadas_itens').insert(itens);

  // Atualiza status de cada escala
  for (const [escalaId, resultado] of Object.entries(resultados)) {
    await sb.from('acolitos_escalas').update({ status: resultado }).eq('id', escalaId);
  }

  btn.textContent = 'Chamada Confirmada ✓';
  setTimeout(() => renderSelecaoCelebracao(), 1500);
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Logar como cerimoniário ou equipe → lista de celebrações com escala ✓
2. Selecionar celebração → lista de membros escalados em grupos ✓
3. Marcar presentes/atrasados/ausentes → botões mudam de cor ✓
4. Confirmar chamada → status das escalas atualiza no Supabase ✓
5. Reabrir a mesma celebração → marcações preservadas ✓

- [ ] **Step 3: Atualizar vercel.json e commitar**

Adicionar em `vercel.json` rewrites:
```json
{ "source": "/acolitos/escala",    "destination": "/projetos/acolitos/escala.html"    },
{ "source": "/acolitos/ausencias", "destination": "/projetos/acolitos/ausencias.html" },
{ "source": "/acolitos/chamada",   "destination": "/projetos/acolitos/chamada.html"   }
```

```bash
git add projetos/acolitos/chamada.html projetos/acolitos/escala.html projetos/acolitos/ausencias.html vercel.json docs/migrations/003_acolitos_fase2.sql
git commit -m "feat: fase 2 — escala, ausências e chamada completos"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Calendário de celebrações com CRUD: Task 10 (+ Celebração) ✓
- Visão Operacional com barras de cobertura: Task 10 ✓
- Planilha membros × celebrações: Task 10 ✓
- Montagem de escala com filtro por aptidão: Task 10 ✓
- Template Matriz (17) e Sto. Antônio (8): TEMPLATE_MATRIZ/STO constantes ✓
- Comunicado de ausência com motivos: Task 11 ✓
- Atualiza status escala para AJ: Task 11 ✓
- Histórico de ausências do membro: Task 11 ✓
- View equipe com todas ausências: Task 11 ✓
- Chamada agrupada por categoria: Task 12 ✓
- Resultados por membro (presente/atrasado/ausente): Task 12 ✓
- Atualiza status das escalas ao confirmar: Task 12 ✓
- Acesso chamada restrito a cerimonario+: Task 12 (initModulo) ✓
- Rotas Vercel: Task 12 Step 3 ✓

**Sem placeholders. Tipos consistentes com Fase 1.**

# Página pública de ausências (`/ausencias`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública sem login em `coroinhas.jcbplimeira.com.br/ausencias` para informar ausências de coroinhas; submissões caem numa fila pendente que a equipe confirma no app.

**Architecture:** Tabela `acolitos_ausencias_pendentes` isolada da escala real. Duas RPCs `SECURITY DEFINER` abertas a `anon` (buscar só-nomes; enviar p/ fila) e três internas guardadas (listar, count, decidir). Página standalone com anon key (padrão `login.html`), rota via rewrite no `vercel.json`. Revisão na `ausencias.html` + aviso na Home.

**Tech Stack:** Postgres/Supabase (RPC `SECURITY DEFINER` + RLS), HTML/JS estático com `@supabase/supabase-js` via CDN, deploy Vercel (do root do repo).

**Spec:** `docs/superpowers/specs/2026-06-09-acolitos-ausencias-publica-design.md`

**Convenções deste repo (importante):**
- Sem test-runner: **verificação = queries SQL via Supabase MCP** (asserts com saída esperada) + checagem manual no browser.
- Validar em **preview da Vercel** antes de ligar a rota `/ausencias` em produção (regra: deploy do **root** do repo).
- Nunca usar conta/membro real para teste — usar **linha descartável** e limpar depois.
- Migrations versionadas em `db/seguranca/`.
- Papéis aprovadores: `coord_admin`, `subadmin`, `membro_equipe`, `cerimonario`.

---

## File Structure

- **Create** `db/seguranca/004_ausencias_publica.sql` — tabela, índices, RLS, 5 funções, grants.
- **Create** `projetos/acolitos/ausencias-publica.html` — página pública standalone.
- **Modify** `vercel.json` — rewrite `/ausencias` → arquivo (host coroinhas).
- **Modify** `projetos/acolitos/ausencias.html` — seção "Avisos recebidos (pendentes)" + badge.
- **Modify** `projetos/acolitos/index.html` — banner de aviso na Home p/ aprovadores.

---

## Task 1: Migration — tabela, índices, RLS

**Files:**
- Create: `db/seguranca/004_ausencias_publica.sql`

- [ ] **Step 1: Criar o arquivo da migration com a tabela + índices + RLS**

```sql
-- 004 — Ausências públicas (fila pendente) — Acólitos (2026-06-09)
create table if not exists public.acolitos_ausencias_pendentes (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  data date not null,
  motivo text,
  informante_nome text,
  informante_contato text,
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada')),
  created_at timestamptz not null default now(),
  revisado_por uuid references auth.users(id),
  revisado_em timestamptz
);

-- não duplica o mesmo membro+data enquanto ainda pendente
create unique index if not exists acolitos_aus_pend_uniq
  on public.acolitos_ausencias_pendentes (membro_id, data) where status='pendente';
create index if not exists acolitos_aus_pend_status_idx
  on public.acolitos_ausencias_pendentes (status, created_at desc);

-- RLS ligada, SEM policies: acesso só pelas RPCs SECURITY DEFINER
alter table public.acolitos_ausencias_pendentes enable row level security;
```

- [ ] **Step 2: Verificar sintaxe localmente (revisão visual)**

Releia o arquivo: a FK aponta para `acolitos_membros(id)`, o índice único é **parcial** (`where status='pendente'`), e a tabela tem RLS ligada sem policies. Não aplicar ainda (Task 4 aplica tudo de uma vez).

---

## Task 2: Migration — RPCs públicas (anon)

**Files:**
- Modify: `db/seguranca/004_ausencias_publica.sql`

- [ ] **Step 1: Adicionar a função de busca (só id+nome, ≥2 letras, limite 20)**

```sql
-- BUSCA pública: devolve só id+nome de ativos. Mínimo 2 letras, máx 20.
create or replace function public.acolitos_ausencia_publica_buscar(p_q text)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome), '[]'::jsonb)
  from (
    select id, nome
    from public.acolitos_membros
    where status='ativo'
      and length(btrim(coalesce(p_q,''))) >= 2
      and nome ilike '%'||btrim(p_q)||'%'
    order by nome
    limit 20
  ) s;
$$;
```

- [ ] **Step 2: Adicionar a função de envio (grava só na fila pendente)**

```sql
-- ENVIO público: valida e insere na fila pendente. Nunca toca a escala real.
create or replace function public.acolitos_ausencia_publica_enviar(
  p_membros uuid[], p_datas date[], p_motivo text, p_informante text, p_contato text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo,'')),200),'');
  v_inf    text := nullif(left(btrim(coalesce(p_informante,'')),200),'');
  v_con    text := nullif(left(btrim(coalesce(p_contato,'')),200),'');
  v_n int := 0;
begin
  if p_membros is null or array_length(p_membros,1) is null
     or p_datas is null or array_length(p_datas,1) is null then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if array_length(p_membros,1) > 20 or array_length(p_datas,1) > 30 then
    return jsonb_build_object('erro','muitos_itens');
  end if;

  insert into public.acolitos_ausencias_pendentes (membro_id, data, motivo, informante_nome, informante_contato)
  select m.id, d.dt, v_motivo, v_inf, v_con
  from unnest(p_membros) as mm(id)
  join public.acolitos_membros m on m.id = mm.id and m.status='ativo'
  cross join unnest(p_datas) as d(dt)
  where d.dt is not null and d.dt >= current_date and d.dt <= current_date + 180
  on conflict (membro_id, data) where status='pendente' do nothing;

  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('erro','sem_itens_validos'); end if;
  return jsonb_build_object('ok', true, 'criadas', v_n);
end; $$;
```

---

## Task 3: Migration — RPCs internas (listar, count, decidir) + grants

**Files:**
- Modify: `db/seguranca/004_ausencias_publica.sql`

- [ ] **Step 1: Adicionar listar() (guardada)**

```sql
create or replace function public.acolitos_ausencia_pendente_listar()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  return jsonb_build_object('pendentes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'membro_id', p.membro_id, 'nome', m.nome, 'data', p.data,
      'motivo', p.motivo, 'informante_nome', p.informante_nome,
      'informante_contato', p.informante_contato, 'created_at', p.created_at)
      order by p.created_at desc, m.nome)
    from public.acolitos_ausencias_pendentes p
    join public.acolitos_membros m on m.id = p.membro_id
    where p.status='pendente'
  ), '[]'::jsonb));
end; $$;
```

- [ ] **Step 2: Adicionar count() (para o badge da Home — leve)**

```sql
create or replace function public.acolitos_ausencia_pendente_count()
returns int language sql stable security definer set search_path to 'public'
as $$
  select case
    when acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      then (select count(*)::int from public.acolitos_ausencias_pendentes where status='pendente')
    else 0 end;
$$;
```

- [ ] **Step 3: Adicionar decidir() (aprovar→escala real, rejeitar→descarta)**

```sql
create or replace function public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_n int := 0;
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  if p_acao not in ('aprovar','rejeitar') then return jsonb_build_object('erro','acao_invalida'); end if;
  if p_ids is null or array_length(p_ids,1) is null then return jsonb_build_object('erro','sem_itens'); end if;

  if p_acao = 'aprovar' then
    -- cria ausência real (motivo é NOT NULL na tabela destino -> fallback)
    insert into public.acolitos_ausencias (membro_id, data, celebracao_id, motivo, observacao)
    select p.membro_id, p.data, null,
           coalesce(nullif(btrim(p.motivo),''), 'Ausência informada (página pública)'),
           case when p.informante_nome is not null
                then 'Informado por '||p.informante_nome || coalesce(' · '||p.informante_contato,'')
                else null end
    from public.acolitos_ausencias_pendentes p
    where p.id = any(p_ids) and p.status='pendente'
      and not exists (
        select 1 from public.acolitos_ausencias a
        where a.membro_id = p.membro_id and a.data = p.data and a.celebracao_id is null
      );
    get diagnostics v_n = row_count;
    update public.acolitos_ausencias_pendentes
      set status='aprovada', revisado_por=auth.uid(), revisado_em=now()
      where id = any(p_ids) and status='pendente';
    return jsonb_build_object('ok', true, 'aprovadas', v_n);
  else
    update public.acolitos_ausencias_pendentes
      set status='rejeitada', revisado_por=auth.uid(), revisado_em=now()
      where id = any(p_ids) and status='pendente';
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'rejeitadas', v_n);
  end if;
end; $$;
```

- [ ] **Step 4: Adicionar os GRANTs (anon só nas 2 públicas)**

```sql
grant execute on function public.acolitos_ausencia_publica_buscar(text) to anon, authenticated;
grant execute on function public.acolitos_ausencia_publica_enviar(uuid[],date[],text,text,text) to anon, authenticated;

grant execute on function public.acolitos_ausencia_pendente_listar()  to authenticated;
grant execute on function public.acolitos_ausencia_pendente_count()   to authenticated;
grant execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) to authenticated;

-- belt-and-suspenders: internas nunca a anon
revoke execute on function public.acolitos_ausencia_pendente_listar()  from anon;
revoke execute on function public.acolitos_ausencia_pendente_count()   from anon;
revoke execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) from anon;
```

---

## Task 4: Aplicar a migration e verificar no banco

**Files:** (nenhum novo — usa Supabase MCP `apply_migration` / `execute_sql`)

- [ ] **Step 1: Aplicar a migration**

`apply_migration` no projeto `fttjgsotuosjfrasttds`, name `ausencias_publica_acolitos`, query = conteúdo de `db/seguranca/004_ausencias_publica.sql`.
Esperado: `{"success":true}`.

- [ ] **Step 2: Verificar grants (anon só nas públicas)**

Run (execute_sql):
```sql
select
  has_function_privilege('anon','public.acolitos_ausencia_publica_buscar(text)','EXECUTE') as anon_buscar,
  has_function_privilege('anon','public.acolitos_ausencia_publica_enviar(uuid[],date[],text,text,text)','EXECUTE') as anon_enviar,
  has_function_privilege('anon','public.acolitos_ausencia_pendente_listar()','EXECUTE') as anon_listar,
  has_function_privilege('anon','public.acolitos_ausencia_pendente_decidir(uuid[],text)','EXECUTE') as anon_decidir;
```
Esperado: `anon_buscar=true, anon_enviar=true, anon_listar=false, anon_decidir=false`.

- [ ] **Step 3: Criar um MEMBRO DESCARTÁVEL para teste (não usar dados reais)**

Run:
```sql
insert into public.acolitos_membros (nome, status, comunidade)
values ('ZZ TESTE Ausencia Publica', 'ativo', 'matriz')
returning id;
```
Anote o `id` retornado como `:TESTID`.

- [ ] **Step 4: Testar busca (deve achar o descartável; <2 letras = vazio)**

Run:
```sql
select public.acolitos_ausencia_publica_buscar('ZZ TESTE') as achou,
       public.acolitos_ausencia_publica_buscar('z')        as curto;
```
Esperado: `achou` contém o membro de teste; `curto` = `[]`.

- [ ] **Step 5: Testar envio (grava na fila) e leitura direta bloqueada**

Run (troque :TESTID):
```sql
select public.acolitos_ausencia_publica_enviar(
  array[':TESTID']::uuid[], array[current_date + 7]::date[],
  'viagem teste', 'Fulano Informante', '(19) 90000-0000');
select count(*) as pendentes_do_teste
from public.acolitos_ausencias_pendentes where membro_id = ':TESTID' and status='pendente';
```
Esperado: retorno `{"ok":true,"criadas":1}` e `pendentes_do_teste=1`.

- [ ] **Step 6: Limpar o teste (remover pendência + membro descartável)**

Run:
```sql
delete from public.acolitos_ausencias_pendentes where membro_id = ':TESTID';
delete from public.acolitos_ausencias where membro_id = ':TESTID';
delete from public.acolitos_membros where id = ':TESTID';
```
Esperado: sem erros. (O teste de `decidir`/aprovar será feito de ponta a ponta na Task 9, também com descartável.)

- [ ] **Step 7: Commit da migration**

```bash
git add db/seguranca/004_ausencias_publica.sql
git commit -m "feat(acolitos): migration da fila de ausências públicas (tabela+RPCs+grants)"
```

---

## Task 5: Página pública `ausencias-publica.html`

**Files:**
- Create: `projetos/acolitos/ausencias-publica.html`

- [ ] **Step 1: Criar a página standalone (anon key, sem shared.js)**

Conteúdo completo do arquivo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Informar Ausência — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fttjgsotuosjfrasttds.supabase.co">
  <style>
    :root{ --wine:#200d13; --gold:#8a6a24; --gold-light:#ffd97a; --text:#f7ebe7; --muted:#b88a8f; --border:#5a3a3f; --surface:#2a141a; --danger:#e0607a; --ok:#7ad48a; }
    *{ box-sizing:border-box; }
    body{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:linear-gradient(160deg,#160a0e,#200d13); color:var(--text); min-height:100vh; padding:18px; }
    .wrap{ max-width:520px; margin:0 auto; }
    h1{ font-size:20px; margin:8px 0 2px; }
    .sub{ font-size:13px; color:var(--muted); margin:0 0 18px; line-height:1.5; }
    label{ display:block; font-size:12px; color:var(--gold-light); margin:14px 0 5px; font-weight:700; }
    input,textarea{ width:100%; padding:11px 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:15px; }
    input::placeholder,textarea::placeholder{ color:#9a6b70; }
    .results{ margin-top:6px; border:1px solid var(--border); border-radius:10px; overflow:hidden; display:none; }
    .results.show{ display:block; }
    .results button{ width:100%; text-align:left; padding:10px 12px; background:var(--surface); color:var(--text); border:none; border-bottom:1px solid var(--border); font-size:14px; cursor:pointer; }
    .results button:last-child{ border-bottom:none; }
    .results button:hover{ background:#33181f; }
    .chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .chip{ display:inline-flex; align-items:center; gap:6px; background:#33181f; border:1px solid var(--gold); border-radius:20px; padding:5px 10px; font-size:13px; }
    .chip b{ color:var(--gold-light); font-weight:700; }
    .chip span{ cursor:pointer; color:var(--danger); font-weight:800; }
    .datas{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .btn{ width:100%; margin-top:20px; padding:13px; border-radius:12px; border:none; background:linear-gradient(160deg,var(--gold-light),var(--gold)); color:#2a1500; font-weight:800; font-size:15px; cursor:pointer; }
    .btn:disabled{ opacity:.6; cursor:default; }
    .btn-sm{ background:#33181f; border:1px solid var(--gold-dim,#7a5a1a); color:var(--gold-light); border-radius:8px; padding:8px 11px; font-size:13px; cursor:pointer; }
    .msg{ margin-top:12px; font-size:13px; padding:10px 12px; border-radius:10px; display:none; }
    .msg.err{ display:block; background:#3a1018; color:var(--danger); border:1px solid var(--danger); }
    .ok-screen{ text-align:center; padding:40px 16px; }
    .ok-screen .big{ font-size:40px; }
    .footer{ text-align:center; font-size:11px; color:var(--muted); margin-top:26px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="form-screen">
      <h1>Informar Ausência</h1>
      <p class="sub">Avise que um ou mais coroinhas não poderão servir em determinadas datas. A coordenação confirma depois.</p>

      <label>Quem vai faltar?</label>
      <input id="busca" type="text" placeholder="digite o nome (mín. 2 letras)…" autocomplete="off">
      <div id="results" class="results"></div>
      <div id="chips" class="chips"></div>

      <label>Em quais datas?</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="data-in" type="date">
        <button type="button" class="btn-sm" id="add-data">Adicionar</button>
      </div>
      <div id="datas" class="datas"></div>

      <label>Seu nome (quem está informando)</label>
      <input id="informante" type="text" placeholder="opcional" autocomplete="off">
      <label>Motivo</label>
      <input id="motivo" type="text" placeholder="opcional (ex.: viagem, doença)" autocomplete="off">
      <label>Contato (telefone)</label>
      <input id="contato" type="text" placeholder="opcional" autocomplete="off">

      <div id="msg" class="msg"></div>
      <button id="enviar" class="btn">Enviar aviso</button>
      <div class="footer">Paróquia Jesus Cristo Bom Pastor — Limeira/SP</div>
    </div>

    <div id="ok-screen" class="ok-screen" style="display:none;">
      <div class="big">✅</div>
      <h1>Aviso recebido!</h1>
      <p class="sub" id="ok-txt">A coordenação vai confirmar. Obrigado!</p>
      <button class="btn" onclick="location.reload()">Informar outra ausência</button>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js" integrity="sha384-4Cjkyy4cE1EgIS0C+Y3xzGmJ2noQFRRU91yKAW8IxtPfVtbQXPMqadSc3sYnjwou" crossorigin="anonymous"></script>
  <script>
    const SUPABASE_URL='https://fttjgsotuosjfrasttds.supabase.co';
    const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGpnc290dW9zamZyYXN0dGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzU3NjUsImV4cCI6MjA5NTExMTc2NX0.BvofcR2cIXP7Bc3r2V0VOgc-JXPefX7JGGwtzv0d_eA';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const selMembros = new Map();  // id -> nome
    const selDatas = new Set();    // 'YYYY-MM-DD'
    const $ = id => document.getElementById(id);

    function showErr(t){ const m=$('msg'); m.textContent=t; m.className='msg err'; }
    function clearErr(){ const m=$('msg'); m.className='msg'; m.textContent=''; }

    // ── BUSCA (debounce) ──
    let buscaT=null;
    $('busca').addEventListener('input', e=>{
      clearTimeout(buscaT);
      const q=e.target.value.trim();
      if(q.length<2){ $('results').classList.remove('show'); $('results').innerHTML=''; return; }
      buscaT=setTimeout(()=>buscar(q), 250);
    });
    async function buscar(q){
      const { data, error } = await sb.rpc('acolitos_ausencia_publica_buscar', { p_q:q });
      const box=$('results'); box.innerHTML='';
      if(error || !Array.isArray(data) || !data.length){ box.classList.remove('show'); return; }
      data.forEach(m=>{
        const b=document.createElement('button'); b.textContent=m.nome;
        b.onclick=()=>{ selMembros.set(m.id, m.nome); renderChips(); box.classList.remove('show'); $('busca').value=''; };
        box.appendChild(b);
      });
      box.classList.add('show');
    }
    function renderChips(){
      const c=$('chips'); c.innerHTML='';
      selMembros.forEach((nome,id)=>{
        const chip=document.createElement('span'); chip.className='chip';
        chip.innerHTML='<b></b><span>×</span>';
        chip.querySelector('b').textContent=nome;
        chip.querySelector('span').onclick=()=>{ selMembros.delete(id); renderChips(); };
        c.appendChild(chip);
      });
    }

    // ── DATAS ──
    $('add-data').onclick=()=>{
      const v=$('data-in').value; if(!v) return;
      selDatas.add(v); $('data-in').value=''; renderDatas();
    };
    function renderDatas(){
      const c=$('datas'); c.innerHTML='';
      Array.from(selDatas).sort().forEach(d=>{
        const [y,mo,da]=d.split('-');
        const chip=document.createElement('span'); chip.className='chip';
        chip.innerHTML='<b></b><span>×</span>';
        chip.querySelector('b').textContent=da+'/'+mo+'/'+y;
        chip.querySelector('span').onclick=()=>{ selDatas.delete(d); renderDatas(); };
        c.appendChild(chip);
      });
    }

    // ── ENVIO ──
    $('enviar').onclick=async ()=>{
      clearErr();
      if(!selMembros.size){ showErr('Selecione ao menos um coroinha.'); return; }
      if(!selDatas.size){ showErr('Adicione ao menos uma data.'); return; }
      const btn=$('enviar'); btn.disabled=true; btn.textContent='Enviando...';
      const { data, error } = await sb.rpc('acolitos_ausencia_publica_enviar', {
        p_membros: Array.from(selMembros.keys()),
        p_datas: Array.from(selDatas),
        p_motivo: $('motivo').value.trim() || null,
        p_informante: $('informante').value.trim() || null,
        p_contato: $('contato').value.trim() || null
      });
      if(error || (data && data.erro)){
        showErr('Não foi possível enviar. Tente de novo.');
        btn.disabled=false; btn.textContent='Enviar aviso'; return;
      }
      $('ok-txt').textContent = (data.criadas||0)+' aviso(s) enviado(s). A coordenação vai confirmar. Obrigado!';
      $('form-screen').style.display='none';
      $('ok-screen').style.display='block';
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: Sanidade de chaves/HTML**

Run:
```bash
cd projetos/acolitos && node -e "const s=require('fs').readFileSync('ausencias-publica.html','utf8');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log('{',o,'}',c,o===c?'OK':'DESBALANCEADO')"
```
Esperado: `OK`.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/ausencias-publica.html
git commit -m "feat(acolitos): página pública de informe de ausências"
```

---

## Task 6: Rota `/ausencias` no `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Adicionar bloco `rewrites` (mantém a URL limpa)**

O `vercel.json` atual tem `redirects` e `headers`, mas **não** tem `rewrites`. Adicione uma chave `rewrites` no objeto raiz (irmã de `redirects`), com:

```json
  "rewrites": [
    { "source": "/ausencias",
      "has": [{ "type": "host", "value": "coroinhas.jcbplimeira.com.br" }],
      "destination": "/projetos/acolitos/ausencias-publica.html" }
  ],
```

Resultado esperado: o objeto raiz passa a ter `redirects`, `rewrites` e `headers`. Validar que o JSON continua válido:

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('JSON OK')"
```
Esperado: `JSON OK`.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(acolitos): rota /ausencias -> página pública (rewrite, host coroinhas)"
```

---

## Task 7: Revisão no app — seção de pendentes em `ausencias.html`

**Files:**
- Modify: `projetos/acolitos/ausencias.html` (init em ~`linha 81-90`)

- [ ] **Step 1: Ler o init atual e a função da view de equipe**

Run:
```bash
sed -n '78,95p' projetos/acolitos/ausencias.html
```
Confirme que existe o branch de aprovador na `init()`:
`(EQUIPE_ROLES.includes(_r) || _r === 'cerimonario') ? renderViewEquipe() : renderViewMembro();`

- [ ] **Step 2: Trocar o branch para também renderizar as pendências**

Substitua a linha do branch por (note o `await` — a view de equipe limpa o `#main-content`
no início; só prependamos o card de pendentes **depois** dela montar, senão é apagado):
```js
  if (EQUIPE_ROLES.includes(_r) || _r === 'cerimonario') { await renderViewEquipe(); renderPendentesPublicas(); }
  else renderViewMembro();
```
Se `renderViewEquipe` não for `async`/`await`-ável, ainda funciona: o `clear` dela é
síncrono no topo, e `renderPendentesPublicas` só insere após o `await` da RPC.

- [ ] **Step 3: Adicionar a função `renderPendentesPublicas()`**

Adicione esta função no `<script>` da página (ex.: logo após `init()`):

```js
// Avisos recebidos pela página pública (/ausencias), aguardando confirmação.
async function renderPendentesPublicas(){
  const { data } = await sb.rpc('acolitos_ausencia_pendente_listar');
  const pend = (data && data.pendentes) || [];
  if(!pend.length) return;
  const main = document.getElementById('main-content');
  const card = document.createElement('div'); card.className='section-card';
  card.style.cssText = (card.style.cssText||'') + ';border:1px solid var(--gold);';
  const h = document.createElement('div');
  h.style.cssText='font-family:Sora,sans-serif;font-weight:700;font-size:14px;color:var(--gold);margin-bottom:8px;';
  h.textContent = '📋 Avisos recebidos (' + pend.length + ') — confirmar';
  card.appendChild(h);

  const fmt = d => { const [y,m,da]=String(d).split('-'); return da+'/'+m+'/'+y; };
  pend.forEach(p=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid var(--border);';
    const info=document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
    const nm=document.createElement('div'); nm.style.cssText='font-weight:700;font-size:13px;color:var(--text);';
    nm.textContent = p.nome + ' · ' + fmt(p.data);
    const sub=document.createElement('div'); sub.style.cssText='font-size:11px;color:var(--text-muted);word-break:break-word;';
    const partes=[]; if(p.informante_nome) partes.push('por '+p.informante_nome);
    if(p.informante_contato) partes.push(p.informante_contato);
    if(p.motivo) partes.push(p.motivo);
    sub.textContent = partes.join(' · ') || 'sem detalhes';
    info.append(nm,sub);
    const decidir = async (acao)=>{
      const { data:r } = await sb.rpc('acolitos_ausencia_pendente_decidir',{ p_ids:[p.id], p_acao:acao });
      if(r && r.ok){ row.remove();
        const restantes = card.querySelectorAll('div[data-pend]').length;
        h.textContent = '📋 Avisos recebidos (' + restantes + ') — confirmar';
        if(!restantes) card.remove();
      } else { alert('Erro ao processar.'); }
    };
    const bOk=document.createElement('button'); bOk.textContent='Aprovar';
    bOk.style.cssText='font-size:11px;font-weight:700;padding:6px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--gold-dim);background:var(--surface2);color:var(--gold-light);';
    bOk.onclick=()=>decidir('aprovar');
    const bNo=document.createElement('button'); bNo.textContent='Rejeitar';
    bNo.style.cssText='font-size:11px;font-weight:700;padding:6px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--danger);background:var(--surface2);color:var(--danger-text);';
    bNo.onclick=()=>decidir('rejeitar');
    row.setAttribute('data-pend','1');
    row.append(info,bOk,bNo); card.appendChild(row);
  });
  main.insertBefore(card, main.firstChild);
}
```

- [ ] **Step 4: Verificar contagem após remoção**

O contador no cabeçalho usa `card.querySelectorAll('div[data-pend]')`. Como cada linha tem `data-pend='1'` e é removida em `row.remove()`, o `h.textContent` reflete o restante. Releia o snippet e confirme que `row.setAttribute('data-pend','1')` está presente antes do append.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(acolitos): seção de avisos públicos pendentes na tela de ausências"
```

---

## Task 8: Aviso na Home (`index.html`) para aprovadores

**Files:**
- Modify: `projetos/acolitos/index.html`

- [ ] **Step 1: Localizar onde a Home termina de montar com o ctx**

Run:
```bash
grep -n "initModulo\|renderHeader\|async function init\|main-content" projetos/acolitos/index.html | head
```
Anote o nome da função de init e o ponto após `ctx` estar disponível (após `renderHeader(ctx,...)`).

- [ ] **Step 2: Adicionar a função `renderAvisoAusencias()`**

Adicione no `<script>` da Home:

```js
// Banner na Home: avisos de ausência aguardando confirmação (só p/ aprovadores).
async function renderAvisoAusencias(){
  const { data } = await sb.rpc('acolitos_ausencia_pendente_count');
  const n = (typeof data === 'number') ? data : 0;
  if(!n) return;
  const main = document.getElementById('main-content');
  if(!main) return;
  const a = document.createElement('a');
  a.href = 'ausencias.html';
  a.style.cssText='display:flex;align-items:center;gap:10px;text-decoration:none;background:#33181f;border:1px solid var(--gold,#8a6a24);border-radius:12px;padding:11px 13px;margin:0 0 12px;color:var(--text);';
  a.innerHTML = '<span style="font-size:18px">📋</span>'
    + '<span style="flex:1;font-size:13px"><b style="color:var(--gold-light,#ffd97a)">'
    + n + ' aviso(s) de ausência</b> aguardando sua confirmação</span>'
    + '<span style="color:var(--gold-light,#ffd97a);font-weight:800">›</span>';
  main.insertBefore(a, main.firstChild);
}
```

- [ ] **Step 3: Chamar a função após o ctx estar pronto**

Na função de init da Home (identificada no Step 1), após `renderHeader(ctx, ...)` (ou no fim do init), adicione a chamada:
```js
  renderAvisoAusencias();
```
Não usar `await` que bloqueie o resto do render (a chamada é fire-and-forget; insere o banner quando responde).

- [ ] **Step 4: Sanidade de chaves**

Run:
```bash
node -e "const s=require('fs').readFileSync('projetos/acolitos/index.html','utf8').match(/<script>[\s\S]*<\/script>/g).join('');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log('{',o,'}',c,o===c?'OK':'DESBALANCEADO')"
```
Esperado: `OK`.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/index.html
git commit -m "feat(acolitos): aviso de ausências pendentes na Home p/ aprovadores"
```

---

## Task 9: Validação ponta-a-ponta (preview) + deploy

**Files:** (nenhum — validação + push)

- [ ] **Step 1: Push e deploy de PREVIEW (não produção ainda)**

```bash
git push origin main
```
Em seguida, gerar um deploy de **preview** da Vercel a partir do **root** do repo (regra do projeto) e pegar a URL de preview.

- [ ] **Step 2: Testar a página pública no preview**

Abrir `https://<preview>/projetos/acolitos/ausencias-publica.html` no browser:
- Digitar 2+ letras → aparece a lista de nomes.
- Selecionar 2 coroinhas (use o descartável + qualquer ativo), adicionar 2 datas, preencher informante.
- Enviar → tela "Aviso recebido!".

(Para não sujar dados reais: prefira selecionar **só o membro descartável** recriado para este teste.)

- [ ] **Step 3: Recriar descartável e validar o ciclo de aprovação**

Run (execute_sql) — cria descartável, simula envio público:
```sql
insert into public.acolitos_membros (nome,status,comunidade)
values ('ZZ TESTE Aprovacao','ativo','matriz') returning id;  -- :TESTID
select public.acolitos_ausencia_publica_enviar(array[':TESTID']::uuid[], array[current_date+10]::date[], 'teste', 'QA', null);
```
Depois, logado no app como aprovador, abrir **Ausências** → confirmar que o aviso aparece na seção "Avisos recebidos", clicar **Aprovar**, e validar:
```sql
select count(*) as virou_ausencia from public.acolitos_ausencias where membro_id=':TESTID';        -- esperado 1
select status from public.acolitos_ausencias_pendentes where membro_id=':TESTID';                   -- esperado 'aprovada'
```

- [ ] **Step 4: Limpar o descartável**

```sql
delete from public.acolitos_ausencias where membro_id=':TESTID';
delete from public.acolitos_ausencias_pendentes where membro_id=':TESTID';
delete from public.acolitos_membros where id=':TESTID';
```

- [ ] **Step 5: Validar a Home (badge)**

Com pelo menos 1 pendência real na fila (ou recriando um descartável temporário), abrir a Home logado como aprovador → o banner "N aviso(s) de ausência" deve aparecer e linkar para Ausências. Limpar descartável depois.

- [ ] **Step 6: Promover para produção e testar a rota limpa**

Promover o deploy para produção (do root). Acessar `https://coroinhas.jcbplimeira.com.br/ausencias` → deve servir a página pública mantendo a URL `/ausencias`.

- [ ] **Step 7: Atualizar a memória do projeto**

Anotar em `project_acolitos_ausencias_publica.md` (memória): fila pendente, 2 RPCs anon (exceção controlada ao lockdown), rota `/ausencias`, aprovação na `ausencias.html` + badge na Home. Ligar a `[[project_acolitos_seguranca]]`.

---

## Notas de verificação (resumo)

- **Banco:** grants (anon só nas 2 públicas), busca <2 letras vazia, envio grava na fila, aprovar cria em `acolitos_ausencias` + marca `aprovada`, rejeitar só marca `rejeitada`, guarda bloqueia não-aprovador.
- **Front:** página pública busca+seleciona+envia; seção de pendentes aprova/rejeita; badge na Home.
- **Sempre** com membro **descartável** (`ZZ TESTE…`) e limpeza ao fim — nunca dados reais.

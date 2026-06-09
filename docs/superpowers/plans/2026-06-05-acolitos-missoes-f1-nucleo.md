# Missões & XP — F1 (Núcleo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans pra implementar task a task. Os passos usam checkbox (`- [ ]`).

**Goal:** Entregar o loop central de Missões & XP — missões-requisito/bônus, validação reivindicada/avaliada, XP total, elegibilidade pro próximo nível e confirmação de promoção pela coordenação — primeiro num `missoes-lab.html` de staging, depois integrado ao app.

**Architecture:** Duas tabelas (`acolitos_missoes`, `acolitos_missao_progresso`) + RPCs `security definer` pra leitura do board e ações (a ordem dos níveis vem do cliente via `NIVEIS`, o banco fica agnóstico ao config de níveis). Front em HTML/JS vanilla seguindo os padrões do projeto (shared.js, cfg, buildRankEmblem, RLS via RPC por causa dos menores).

**Tech Stack:** Supabase (Postgres, RLS, RPC security-definer via MCP `apply_migration`), HTML/CSS/JS vanilla, deploy Vercel (do root do repo — ver `project_acolitos_deploy`). **F1 não inclui** missões automáticas (F2), temporadas/ranking (F3) nem badges (F4); o schema já prevê os campos, mas a lógica desses fica pras fases seguintes.

**Convenção de verificação (sem framework de teste):**
- SQL/RPC: `mcp execute_sql` com asserções (simular `auth.uid()` via `set local request.jwt.claims`).
- JS: `node --check` no shared.js e checagem dos blocos inline (`new Function(s)`).
- Visual: render do `missoes-lab.html` via Playwright (servidor http local) + screenshot.
- Migrações via `mcp apply_migration` no projeto `fttjgsotuosjfrasttds` (conta erickjcbp). Próximo número de migration: **043**.

---

## File Structure

- **Migrations (banco):** 043 missoes; 044 progresso; 045 RPC board; 046 RPCs de ação/coordenação.
- **`projetos/acolitos/missoes-lab.html`** (CRIAR): página de staging que exercita board do membro + ações da coordenação num lugar só. Descartável após validação.
- **`projetos/acolitos/index.html`** (MODIFICAR): trocar `showMeuDesenvolvimento` por `showMinhaJornada` (board real).
- **`projetos/acolitos/config.html`** (MODIFICAR): nova seção `missoes` (CRUD superadmin).
- **`projetos/acolitos/membros.html`** (MODIFICAR): painel de coordenação "Promoções pendentes" + "Fila de aprovação".
- **`projetos/acolitos/shared.js`** (MODIFICAR): helper `proximoNivel(slug)` e `ligaDoNivel(slug)` reutilizáveis.

---

## Task 1: Migration 043 — tabela `acolitos_missoes` + RLS + seed de validação

**Files:** Migration `acolitos_missoes` (043).

- [ ] **Step 1: Aplicar a migração**

```sql
create table public.acolitos_missoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text default '',
  tipo text not null default 'bonus' check (tipo in ('requisito','bonus')),
  validacao text not null default 'reivindicada' check (validacao in ('automatica','avaliada','reivindicada')),
  xp int not null default 10,
  nivel_alvo text,                 -- (requisito) slug do nível que destrava; null p/ bônus
  aplica_de text,                  -- slug do nível mínimo a aparecer (null = todos)
  aplica_ate text,                 -- slug do nível máximo a aparecer (null = todos)
  criterio jsonb,                  -- (automática, F2) {fonte,funcao?,proficiencia?,quantidade?}
  concede_badge boolean not null default false,
  badge_icone text,
  badge_label text,
  seriedade text check (seriedade in ('seria','boba','pegadinha')),
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.acolitos_missoes enable row level security;
create policy "Autenticado le missoes" on public.acolitos_missoes
  for select using (auth.role() = 'authenticated');
create policy "Superadmin gere missoes" on public.acolitos_missoes
  for all using (acolitos_is_superadmin(auth.uid())) with check (acolitos_is_superadmin(auth.uid()));

-- Seed de validação (será refinado na autoria; cobre os 3 tipos de validação e os 2 tipos)
insert into public.acolitos_missoes (titulo, descricao, tipo, validacao, xp, nivel_alvo, aplica_de, aplica_ate, seriedade, ordem) values
  ('Saber tocar a sineta', 'Demonstrar que sabe a hora certa de tocar a sineta.', 'requisito', 'avaliada', 20, 'acolito_guardiao', 'acolito_aspirante', 'acolito_aspirante', 'seria', 1),
  ('Dominar o sinão', 'Tocar o sinão com firmeza nos momentos certos.', 'requisito', 'avaliada', 25, 'acolito_sentinela', 'acolito_guardiao', 'acolito_guardiao', 'seria', 2),
  ('Chegar 10 min antes', 'Reivindique quando chegar com antecedência pra se preparar.', 'requisito', 'reivindicada', 15, 'acolito_guardiao', 'acolito_aspirante', 'acolito_aspirante', 'seria', 3),
  ('Ajudar um novato', 'Ensinou algo a um acólito mais novo? Reivindique!', 'bonus', 'reivindicada', 30, null, null, null, 'seria', 10),
  ('Crachá de meia torta', 'Veio com a túnica torta e ninguém percebeu. Confesse.', 'bonus', 'reivindicada', 5, null, null, null, 'pegadinha', 11);
```

- [ ] **Step 2: Verificar tabela + RLS + seed**

```sql
select count(*) as missoes, count(*) filter (where tipo='requisito') as requisitos from public.acolitos_missoes;
select polname from pg_policy where polrelid='public.acolitos_missoes'::regclass;
```
Esperado: `missoes=5, requisitos=3`; 2 policies.

- [ ] **Step 3: Verificar que não-superadmin NÃO escreve (RLS)**

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a729946-852f-4c01-b513-c52af7496e98","role":"authenticated"}';
-- cerimoniário comum: SELECT deve funcionar, INSERT deve falhar
select count(*) from public.acolitos_missoes;            -- > 0 ok
insert into public.acolitos_missoes (titulo) values ('hack'); -- deve dar erro de RLS
```
Esperado: o SELECT retorna 5; o INSERT falha (policy). Se o INSERT passar, a policy está errada — corrigir antes de seguir.

---

## Task 2: Migration 044 — tabela `acolitos_missao_progresso` + RLS

**Files:** Migration `acolitos_missao_progresso` (044).

- [ ] **Step 1: Aplicar a migração**

```sql
create table public.acolitos_missao_progresso (
  id uuid primary key default gen_random_uuid(),
  missao_id uuid not null references public.acolitos_missoes(id) on delete cascade,
  membro_id uuid not null references public.acolitos_membros(id) on delete cascade,
  status text not null default 'em_analise' check (status in ('em_analise','concluida')),
  xp_ganho int not null default 0,
  temporada_id uuid,               -- F3
  evidencia text,
  aprovado_por uuid,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  unique (missao_id, membro_id)
);
alter table public.acolitos_missao_progresso enable row level security;

-- membro lê o próprio progresso
create policy "Membro le proprio progresso" on public.acolitos_missao_progresso
  for select using (exists (select 1 from acolitos_membros m where m.id = membro_id and m.user_id = auth.uid()));
-- coordenação lê todos
create policy "Equipe le progresso" on public.acolitos_missao_progresso
  for select using (acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe']));
-- coordenação gerencia (insert/update/delete) — usado pela fila de aprovação direta se preciso
create policy "Equipe gere progresso" on public.acolitos_missao_progresso
  for all using (acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe']))
  with check (acolitos_get_role(auth.uid()) = any (array['coord_admin','subadmin','membro_equipe']));
```
Nota: a criação de reivindicação pelo membro e as conclusões passam por **RPCs security-definer** (Task 4), então o membro não precisa de policy de INSERT direto.

- [ ] **Step 2: Verificar**

```sql
select polname, cmd from pg_policy p join pg_policies pp on pp.policyname=p.polname where p.polrelid='public.acolitos_missao_progresso'::regclass;
```
Esperado: 3 policies (1 select membro, 1 select equipe, 1 all equipe).

---

## Task 3: Migration 045 — RPC de leitura do board `acolitos_missoes_board`

O cliente passa a ordem dos níveis (`NIVEIS`) pra o banco ficar agnóstico ao config. Retorna JSON com: XP total, próximo nível, requisitos (com status), bônus aplicáveis (com status), e flag de elegibilidade.

**Files:** Migration `acolitos_missoes_board_rpc` (045).

- [ ] **Step 1: Aplicar**

```sql
create or replace function public.acolitos_missoes_board(p_membro uuid, p_niveis text[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text := acolitos_get_role(v_uid);
  v_dono boolean;
  v_nivel text; v_idx int; v_prox text;
  v_xp int;
  v_req jsonb; v_bonus jsonb; v_elegivel boolean;
begin
  -- autorização: o próprio membro, ou coordenação
  select (m.user_id = v_uid) into v_dono from acolitos_membros m where m.id = p_membro;
  if coalesce(v_dono,false) = false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return jsonb_build_object('erro','sem_permissao');
  end if;

  select nivel into v_nivel from acolitos_membros where id = p_membro;
  v_idx := array_position(p_niveis, v_nivel);          -- 1-based; null se nível não está na lista
  v_prox := case when v_idx is not null and v_idx < array_length(p_niveis,1) then p_niveis[v_idx+1] else null end;

  select coalesce(sum(xp_ganho),0) into v_xp
    from acolitos_missao_progresso where membro_id = p_membro and status = 'concluida';

  -- requisitos do próximo nível + status do membro
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', mi.id, 'titulo', mi.titulo, 'descricao', mi.descricao, 'validacao', mi.validacao,
           'xp', mi.xp, 'status', coalesce(pr.status,'pendente')
         ) order by mi.ordem), '[]'::jsonb)
    into v_req
    from acolitos_missoes mi
    left join acolitos_missao_progresso pr on pr.missao_id = mi.id and pr.membro_id = p_membro
   where mi.ativo and mi.tipo='requisito' and v_prox is not null and mi.nivel_alvo = v_prox;

  -- elegível = existe ao menos 1 requisito e todos concluídos
  v_elegivel := v_prox is not null
    and (select count(*) from acolitos_missoes where ativo and tipo='requisito' and nivel_alvo=v_prox) > 0
    and not exists (
      select 1 from acolitos_missoes mi
       where mi.ativo and mi.tipo='requisito' and mi.nivel_alvo=v_prox
         and not exists (select 1 from acolitos_missao_progresso pr
                          where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida'));

  -- bônus aplicáveis ao nível atual (faixa aplica_de/ate por índice; null = todos)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', mi.id, 'titulo', mi.titulo, 'descricao', mi.descricao, 'validacao', mi.validacao,
           'xp', mi.xp, 'status', coalesce(pr.status,'pendente')
         ) order by mi.ordem), '[]'::jsonb)
    into v_bonus
    from acolitos_missoes mi
    left join acolitos_missao_progresso pr on pr.missao_id = mi.id and pr.membro_id = p_membro
   where mi.ativo and mi.tipo='bonus'
     and (mi.aplica_de is null or array_position(p_niveis, mi.aplica_de) <= v_idx)
     and (mi.aplica_ate is null or array_position(p_niveis, mi.aplica_ate) >= v_idx);

  return jsonb_build_object(
    'nivel', v_nivel, 'proximo_nivel', v_prox, 'xp_total', v_xp,
    'requisitos', v_req, 'bonus', v_bonus, 'elegivel', coalesce(v_elegivel,false));
end; $$;
grant execute on function public.acolitos_missoes_board(uuid, text[]) to authenticated;
```

- [ ] **Step 2: Verificar (simular o membro dono)** — pega um membro real e testa.

```sql
-- escolhe um membro ativo com user_id e nível conhecido
with m as (select id, user_id, nivel from acolitos_membros where user_id is not null and nivel is not null limit 1)
select id, nivel from m;
```
Depois, com o `user_id` desse membro:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<USER_ID>","role":"authenticated"}';
select acolitos_missoes_board('<MEMBRO_ID>',
  array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor']);
```
Esperado: JSON com `xp_total=0`, `requisitos` listando as missões do próximo nível com `status:'pendente'`, `bonus` com as 2 bônus, `elegivel:false`.

---

## Task 4: Migration 046 — RPCs de ação e de coordenação

**Files:** Migration `acolitos_missoes_acoes_rpc` (046).

- [ ] **Step 1: Aplicar**

```sql
-- Membro reivindica uma missão 'reivindicada' (cria/atualiza progresso em_analise)
create or replace function public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_membro uuid; v_val text;
begin
  select id into v_membro from acolitos_membros where user_id = v_uid;
  if v_membro is null then return jsonb_build_object('erro','sem_membro'); end if;
  select validacao into v_val from acolitos_missoes where id = p_missao and ativo;
  if v_val is null then return jsonb_build_object('erro','missao_invalida'); end if;
  if v_val <> 'reivindicada' then return jsonb_build_object('erro','nao_reivindicavel'); end if;
  insert into acolitos_missao_progresso (missao_id, membro_id, status, evidencia)
    values (p_missao, v_membro, 'em_analise', p_evidencia)
  on conflict (missao_id, membro_id) do update set status='em_analise', evidencia=excluded.evidencia
    where acolitos_missao_progresso.status <> 'concluida';  -- não rebaixa concluída
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.acolitos_missao_reivindicar(uuid, text) to authenticated;

-- Coordenação decide uma reivindicação OU marca uma 'avaliada' como concluída
-- p_decisao: 'aprovar' (vira concluida + credita xp) | 'recusar' (remove a linha)
create or replace function public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := acolitos_get_role(auth.uid()); v_xp int;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return jsonb_build_object('erro','sem_permissao'); end if;
  if p_decisao = 'recusar' then
    delete from acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro and status='em_analise';
    return jsonb_build_object('ok', true, 'acao','recusada');
  end if;
  select xp into v_xp from acolitos_missoes where id=p_missao and ativo;
  if v_xp is null then return jsonb_build_object('erro','missao_invalida'); end if;
  insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, aprovado_por, concluida_em)
    values (p_missao, p_membro, 'concluida', v_xp, auth.uid(), now())
  on conflict (missao_id, membro_id) do update
    set status='concluida', xp_ganho=v_xp, aprovado_por=auth.uid(), concluida_em=now();
  return jsonb_build_object('ok', true, 'acao','concluida', 'xp', v_xp);
end; $$;
grant execute on function public.acolitos_missao_decidir(uuid, uuid, text) to authenticated;

-- Fila de aprovação: reivindicações em_analise (coordenação)
create or replace function public.acolitos_missoes_fila()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'missao_id', mi.id, 'titulo', mi.titulo, 'xp', mi.xp,
      'membro_id', m.id, 'membro', m.nome, 'evidencia', pr.evidencia, 'quando', pr.created_at
    ) order by pr.created_at)
    from acolitos_missao_progresso pr
    join acolitos_missoes mi on mi.id = pr.missao_id
    join acolitos_membros m on m.id = pr.membro_id
    where pr.status='em_analise'), '[]'::jsonb);
end; $$;
grant execute on function public.acolitos_missoes_fila() to authenticated;

-- Promoções pendentes: membros elegíveis ao próximo nível (coordenação). Recebe a ordem dos níveis.
create or replace function public.acolitos_promocoes_pendentes(p_niveis text[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('membro_id', x.id, 'membro', x.nome, 'nivel', x.nivel, 'proximo', x.prox) order by x.nome)
    from (
      select m.id, m.nome, m.nivel,
             p_niveis[array_position(p_niveis,m.nivel)+1] as prox
      from acolitos_membros m
      where m.status='ativo' and array_position(p_niveis,m.nivel) is not null
        and array_position(p_niveis,m.nivel) < array_length(p_niveis,1)
    ) x
    where x.prox is not null
      and (select count(*) from acolitos_missoes where ativo and tipo='requisito' and nivel_alvo=x.prox) > 0
      and not exists (
        select 1 from acolitos_missoes mi
         where mi.ativo and mi.tipo='requisito' and mi.nivel_alvo=x.prox
           and not exists (select 1 from acolitos_missao_progresso pr
                            where pr.missao_id=mi.id and pr.membro_id=x.id and pr.status='concluida'))
  ), '[]'::jsonb);
end; $$;
grant execute on function public.acolitos_promocoes_pendentes(text[]) to authenticated;

-- Promover: seta o nível (coordenação) revalidando a elegibilidade no servidor
create or replace function public.acolitos_promover(p_membro uuid, p_novo_nivel text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return jsonb_build_object('erro','sem_permissao'); end if;
  if exists (select 1 from acolitos_missoes mi
             where mi.ativo and mi.tipo='requisito' and mi.nivel_alvo=p_novo_nivel
               and not exists (select 1 from acolitos_missao_progresso pr
                                where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')) then
    return jsonb_build_object('erro','nao_elegivel'); end if;
  update acolitos_membros set nivel = p_novo_nivel where id = p_membro;
  return jsonb_build_object('ok', true, 'nivel', p_novo_nivel);
end; $$;
grant execute on function public.acolitos_promover(uuid, text) to authenticated;
```

- [ ] **Step 2: Verificar o fluxo ponta a ponta no banco** (usando uma LINHA DESCARTÁVEL — nunca contas reais; ver memória `feedback_nao_mexer_dados_reais`).

```sql
-- cria membro descartável de teste ligado a um user_id fake e o promove via missões
-- (rodar como service role; valida a lógica das RPCs chamando-as com SECURITY DEFINER e jwt simulado de coordenação)
-- 1) pega um coord_admin para simular auth
select user_id from pastoral_members pm join pastoral_modules pmod on pm.module_id=pmod.id
 where pmod.slug='acolitos' and pm.role='coord_admin' and pm.user_id is not null limit 1;
```
Depois, simulando o coord:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<COORD_USER_ID>","role":"authenticated"}';
-- fila começa vazia (ninguém reivindicou)
select jsonb_array_length(acolitos_missoes_fila());           -- 0
-- marca uma 'avaliada' concluída pra um membro de teste e checa elegibilidade
-- (use um membro_id de teste; aqui só validamos que decidir credita XP)
select acolitos_missao_decidir(
  (select id from acolitos_missoes where titulo='Saber tocar a sineta'),
  '<MEMBRO_TESTE_ID>', 'aprovar');                            -- ok + xp:20
```
Esperado: `decidir` retorna `{ok:true, acao:concluida, xp:20}` e cria a linha de progresso. Limpar a linha de teste ao final (`delete from acolitos_missao_progresso where membro_id='<MEMBRO_TESTE_ID>'`).

---

## Task 5: `missoes-lab.html` — página de staging

Página única que exercita os dois lados (membro e coordenação) contra as RPCs, pra validar antes de integrar. Segue o boilerplate das outras páginas (shared.css/js, supabase UMD).

**Files:** Create `projetos/acolitos/missoes-lab.html`.

- [ ] **Step 1: Criar a página** com: cabeçalho/nav padrão; um seletor "agir como" (carrega o board do membro logado); render do board (XP, próximo nível + requisitos com botão "Já fiz" nas reivindicáveis, bônus); e um painel de coordenação (fila de aprovação + promoções pendentes) visível só se `ctx.membership.role` ∈ coordenação. Estrutura mínima:

```html
<!DOCTYPE html><html lang="pt-BR" data-theme="dark"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Missões (lab) — Acólitos JCBP</title>
<link rel="stylesheet" href="shared.css"><link rel="manifest" href="manifest.json">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/dist/umd/supabase.min.js" integrity="sha384-4Cjkyy4cE1EgIS0C+Y3xzGmJ2noQFRRU91yKAW8IxtPfVtbQXPMqadSc3sYnjwou" crossorigin="anonymous"></script>
</head><body>
<div id="app-header"></div><div id="app-nav"></div>
<div class="main" id="main"><span class="loading">Carregando...</span></div>
<script src="shared.js"></script>
<script>
const NIVEIS_SLUGS = () => NIVEIS.map(n=>n.slug);   // ordem do cliente
let ctx=null, MEMBRO=null;
async function init(){
  ctx = await initModulo(); if(!ctx) return;
  renderHeader(ctx,'home'); renderBottomNav(ctx,'home');
  MEMBRO = ctx.membro;                  // perfil ativo
  if(MEMBRO) await renderBoard();
  if(['coord_admin','subadmin','membro_equipe'].includes(ctx.membership?.role)) await renderCoord();
}
async function renderBoard(){
  const { data } = await sb.rpc('acolitos_missoes_board', { p_membro: MEMBRO.id, p_niveis: NIVEIS_SLUGS() });
  // render: data.xp_total, data.proximo_nivel, data.requisitos[], data.bonus[], data.elegivel
  // requisito/bonus com validacao==='reivindicada' e status==='pendente' → botão "Já fiz" → reivindicar()
}
async function reivindicar(missaoId){
  const ev = prompt('Conte rapidinho o que você fez (opcional):')||null;
  await sb.rpc('acolitos_missao_reivindicar', { p_missao: missaoId, p_evidencia: ev });
  await renderBoard();
}
async function renderCoord(){
  const { data: fila } = await sb.rpc('acolitos_missoes_fila');
  const { data: prom } = await sb.rpc('acolitos_promocoes_pendentes', { p_niveis: NIVEIS_SLUGS() });
  // fila[]: botões Aprovar/Recusar → acolitos_missao_decidir(missao_id, membro_id, 'aprovar'|'recusar')
  // prom[]: botão Promover → acolitos_promover(membro_id, proximo) → showLevelUp opcional
}
init();
</script></body></html>
```

- [ ] **Step 2: Sintaxe** — `node -e` checando o bloco inline (`new Function`). Esperado: OK.

- [ ] **Step 3: Stamp sw.js + deploy do root** (a página é nova, não afeta o existente):

```bash
cd projetos/acolitos && perl -pi -e "s/const BUILD = '[^']*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" sw.js
cd /Users/erickmartins/iajcbp && VERCEL_TOKEN=... vercel --prod --yes --scope erickjcbp-1650s-projects
```

---

## Task 6: Validar o lab (Playwright + DB) e demonstrar pro dono

**Files:** nenhum (validação).

- [ ] **Step 1:** Render do `missoes-lab.html` via Playwright (servidor http local apontando pro deploy, ou abrir a URL de produção `/projetos/acolitos/missoes-lab.html` logado). Screenshot do board (próximo nível + requisitos + bônus) e do painel de coordenação.
- [ ] **Step 2:** Fluxo manual: reivindicar uma bônus como membro → aparecer na fila da coordenação → aprovar → XP do membro sobe; marcar os requisitos do próximo nível → membro aparece em "Promoções pendentes" → promover → nível muda.
- [ ] **Step 3:** Mostrar pro dono e coletar ajustes ANTES de integrar (regra de staging — `feedback_validar_staging`).

---

## Task 7: Integrar o board no app — `index.html`

**Files:** Modify `projetos/acolitos/index.html` (função `showMeuDesenvolvimento` e o botão que a chama, ~linha 262).

- [ ] **Step 1:** Renomear/realocar pra `showMinhaJornada(membro)` que renderiza o board real (mesma lógica validada no lab: chama `acolitos_missoes_board`, mostra próximo nível + requisitos + bônus + XP + banner elegível). Trocar o texto do botão pra "📈 Minha Jornada".
- [ ] **Step 2:** `node --check`/inline-check do index. Stamp + deploy. Verificar no ar.

---

## Task 8: CRUD de missões no Config — `config.html`

**Files:** Modify `projetos/acolitos/config.html` (array `SECOES` + nova `renderMissoes`).

- [ ] **Step 1:** Adicionar item `['missoes','Missões & XP']` em `SECOES` e `renderMissoes(b)`: lista as missões (de `acolitos_missoes`, superadmin lê tudo), com cards `.cfg-card` (padrão Hextech) pra editar `titulo/descricao/tipo/validacao/xp/nivel_alvo/aplica_de/aplica_ate/seriedade/concede_badge/badge_*`, reordenar, excluir e **+ Missão**. Filtro por nível/tipo/seriedade pra autoria em massa. Persiste via `sb.from('acolitos_missoes').upsert/delete` (RLS já garante superadmin).
- [ ] **Step 2:** inline-check + deploy + verificar no ar.

---

## Task 9: Painel de coordenação — `membros.html`

**Files:** Modify `projetos/acolitos/membros.html` (adicionar seção no topo da tela de coordenação).

- [ ] **Step 1:** Bloco "Promoções pendentes" (chama `acolitos_promocoes_pendentes` + botão Promover→`acolitos_promover`, dispara `showLevelUp` se disponível) e "Fila de aprovação" (`acolitos_missoes_fila` + Aprovar/Recusar→`acolitos_missao_decidir`). Visível só pra coordenação.
- [ ] **Step 2:** inline-check + deploy + verificar no ar.

- [ ] **Step 3: Limpeza do lab** — após integração validada, remover `missoes-lab.html` (ou deixar fora da nav). Atualizar memória `project_acolitos_missoes` (criar) com o estado da F1 e os nomes das RPCs.

---

## Self-Review (writing-plans)

**Cobertura do spec (F1):** tabelas missões+progresso ✓ (T1,T2); board do membro requisito+bônus ✓ (T3,T5,T7); validação reivindicada ✓ (T4 reivindicar/decidir) + avaliada ✓ (T4 decidir aprovar direto); XP total ✓ (T3); elegibilidade ✓ (T3) + promoções pendentes/confirmar ✓ (T4,T9); CRUD superadmin ✓ (T8); staging-first ✓ (T5,T6). Fora de F1 (automáticas/temporada/badges) corretamente adiados.

**Placeholders:** SQL completo e exato; UI especificada por contrato + snippets representativos (arquivos do app são enormes; reproduzir cada linha no plano seria impraticável e contra DRY — o contrato + os nomes de RPC bastam pro implementador).

**Consistência de nomes:** RPCs `acolitos_missoes_board(uuid,text[])`, `acolitos_missao_reivindicar(uuid,text)`, `acolitos_missao_decidir(uuid,uuid,text)`, `acolitos_missoes_fila()`, `acolitos_promocoes_pendentes(text[])`, `acolitos_promover(uuid,text)` — usadas igualzinho em T3/T4/T5/T7/T9. Tabelas `acolitos_missoes`/`acolitos_missao_progresso` consistentes. Ordem dos níveis sempre via `NIVEIS.map(n=>n.slug)`.

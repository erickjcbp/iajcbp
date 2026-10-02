-- Acólitos 086 — a aba RETIROS: planejamento de retiros, espiritualidade e formações
--
-- PEDIDO DO DONO (02/10/2026): uma aba onde se criam ÁREAS (retiro, espiritualidade,
-- formação). Dentro de cada área planeja-se cronograma, pregações, dinâmicas, gincanas,
-- refeições e a LISTA DE COMPRAS (com cotações de fornecedores). A compra concilia com a
-- Tesouraria (compras, doações, venda de itens da pastoral). Cada item tem responsável,
-- prazo (data máxima) e andamento.
--
-- COMO CONCILIA COM O CAIXA: não existe um segundo caixa. Tudo que entra ou sai grava em
-- `acolitos_financeiro` (a Tesouraria de sempre), com `retiro_area_id` dizendo de qual área
-- veio. Assim o saldo da Tesouraria continua sendo UM só, e a área mostra o seu resultado
-- (entradas - saídas) filtrando por essa coluna. "Comprar" é uma função (atômica): grava a
-- saída E marca a compra no mesmo passo — nunca fica compra "feita" sem lançamento, nem
-- lançamento sem compra.
--
-- QUEM MEXE: coordenação (coord_admin, subadmin) OU equipe (membro_equipe) com a permissão
-- 'retiros' marcada na ficha. Mesma ideia das demais telas de coordenação: a permissão manda.
-- Tudo `to authenticated`, e `anon` sem acesso nenhum (lição da 051: sem isso a tabela
-- responde `[]` 200 a quem não logou, igual a "não há nada").

-- ── quem pode ──────────────────────────────────────────────────────────────
create or replace function public.acolitos_pode_retiros()
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin') then true
    when public.acolitos_get_role(auth.uid()) = 'membro_equipe' then exists (
      select 1 from public.acolitos_membros m
      where m.user_id = auth.uid() and 'retiros' = any (m.permissoes))
    else false end
$$;
revoke all on function public.acolitos_pode_retiros() from public, anon;
grant execute on function public.acolitos_pode_retiros() to authenticated;

-- ── áreas ──────────────────────────────────────────────────────────────────
create table if not exists public.acolitos_retiro_areas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(btrim(nome)) > 0),
  tipo        text not null default 'retiro' check (tipo in ('retiro','espiritualidade','formacao','outro')),
  descricao   text,
  local       text,
  data_inicio date,
  data_fim    date,
  status      text not null default 'planejando' check (status in ('planejando','em_andamento','concluida','arquivada')),
  criada_em   timestamptz not null default now(),
  criada_por  uuid,
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

-- ── o plano: cronograma, pregações, dinâmicas, gincanas, refeições ─────────
create table if not exists public.acolitos_retiro_itens (
  id             uuid primary key default gen_random_uuid(),
  area_id        uuid not null references public.acolitos_retiro_areas(id) on delete cascade,
  secao          text not null check (secao in ('cronograma','pregacao','dinamica','gincana','refeicao','outro')),
  subtipo        text,                       -- refeição: cafe | almoco | lanche | janta
  titulo         text not null check (length(btrim(titulo)) > 0),
  descricao      text,
  data           date,
  hora           time,
  duracao_min    integer check (duracao_min is null or duracao_min >= 0),
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  prazo          date,                       -- a DATA MÁXIMA para deixar isto pronto
  status         text not null default 'a_fazer' check (status in ('a_fazer','andamento','feito')),
  criada_em      timestamptz not null default now(),
  criada_por     uuid
);
create index if not exists acolitos_retiro_itens_area_idx on public.acolitos_retiro_itens (area_id, secao);

-- ── fornecedores (a agenda que as cotações usam) ───────────────────────────
create table if not exists public.acolitos_retiro_fornecedores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) > 0),
  contato    text,
  telefone   text,
  observacao text,
  criado_em  timestamptz not null default now()
);

-- ── lista de compras ───────────────────────────────────────────────────────
create table if not exists public.acolitos_retiro_compras (
  id              uuid primary key default gen_random_uuid(),
  area_id         uuid not null references public.acolitos_retiro_areas(id) on delete cascade,
  categoria       text not null default 'outro' check (categoria in
                    ('ingredientes','decoracao','lembrancas','papelaria','higiene','limpeza','outro')),
  item            text not null check (length(btrim(item)) > 0),
  quantidade      numeric(12,3) not null default 1 check (quantidade > 0),
  unidade         text,
  valor_estimado  numeric(12,2) check (valor_estimado is null or valor_estimado >= 0),  -- total
  fornecedor_id   uuid references public.acolitos_retiro_fornecedores(id) on delete set null,
  responsavel_id  uuid references public.acolitos_membros(id) on delete set null,
  prazo           date,
  status          text not null default 'pendente' check (status in ('pendente','cotando','aprovada','comprada')),
  valor_pago      numeric(12,2) check (valor_pago is null or valor_pago >= 0),          -- total
  comprada_em     date,
  observacao      text,
  criada_em       timestamptz not null default now(),
  criada_por      uuid
);
create index if not exists acolitos_retiro_compras_area_idx on public.acolitos_retiro_compras (area_id, status);

-- ── cotações: quanto cada fornecedor cobra por ESTE item ───────────────────
create table if not exists public.acolitos_retiro_cotacoes (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid not null references public.acolitos_retiro_compras(id) on delete cascade,
  fornecedor_id  uuid references public.acolitos_retiro_fornecedores(id) on delete set null,
  fornecedor_nome text,                       -- quando não vale cadastrar o fornecedor
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  validade       date,
  observacao     text,
  escolhida      boolean not null default false,
  criada_em      timestamptz not null default now(),
  check (fornecedor_id is not null or length(btrim(coalesce(fornecedor_nome,''))) > 0)
);
create index if not exists acolitos_retiro_cotacoes_compra_idx on public.acolitos_retiro_cotacoes (compra_id);
-- no máximo UMA cotação escolhida por compra
create unique index if not exists acolitos_retiro_cotacoes_uma_escolhida
  on public.acolitos_retiro_cotacoes (compra_id) where escolhida;

-- ── o elo com a Tesouraria ─────────────────────────────────────────────────
alter table public.acolitos_financeiro
  add column if not exists retiro_area_id   uuid references public.acolitos_retiro_areas(id)   on delete set null,
  add column if not exists retiro_compra_id uuid references public.acolitos_retiro_compras(id) on delete set null;
create index if not exists acolitos_financeiro_retiro_idx on public.acolitos_financeiro (retiro_area_id) where retiro_area_id is not null;
-- uma compra gera no máximo UM lançamento
create unique index if not exists acolitos_financeiro_uma_por_compra
  on public.acolitos_financeiro (retiro_compra_id) where retiro_compra_id is not null;

-- ── acesso: RLS + anon fora ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['acolitos_retiro_areas','acolitos_retiro_itens','acolitos_retiro_fornecedores',
                           'acolitos_retiro_compras','acolitos_retiro_cotacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Retiros: quem tem a permissão" on public.%I', t);
    execute format('create policy "Retiros: quem tem a permissão" on public.%I to authenticated '
                   'using (public.acolitos_pode_retiros()) with check (public.acolitos_pode_retiros())', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- ── COMPRAR: grava a saída na Tesouraria e marca a compra, num passo só ────
create or replace function public.acolitos_retiro_comprar(
  p_compra uuid, p_valor numeric, p_data date default current_date, p_fornecedor uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.acolitos_retiro_compras; a public.acolitos_retiro_areas; l uuid;
begin
  if auth.uid() is null or not public.acolitos_pode_retiros() then raise exception 'sem_permissao'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'valor_invalido'; end if;
  select * into c from public.acolitos_retiro_compras where id = p_compra for update;
  if not found then raise exception 'compra_inexistente'; end if;
  if c.status = 'comprada' then raise exception 'ja_comprada'; end if;
  select * into a from public.acolitos_retiro_areas where id = c.area_id;
  insert into public.acolitos_financeiro (tipo, categoria, valor, descricao, data, created_by, retiro_area_id, retiro_compra_id)
    values ('saida', 'compras', p_valor, left(a.nome || ' · ' || c.item, 200), coalesce(p_data, current_date),
            auth.uid(), c.area_id, c.id)
    returning id into l;
  update public.acolitos_retiro_compras
     set status = 'comprada', valor_pago = p_valor, comprada_em = coalesce(p_data, current_date),
         fornecedor_id = coalesce(p_fornecedor, fornecedor_id)
   where id = c.id;
  return l;
end $$;

-- ── DESFAZER a compra: apaga o lançamento e volta a compra para "aprovada" ─
create or replace function public.acolitos_retiro_desfazer_compra(p_compra uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.acolitos_pode_retiros() then raise exception 'sem_permissao'; end if;
  delete from public.acolitos_financeiro where retiro_compra_id = p_compra;
  update public.acolitos_retiro_compras
     set status = 'aprovada', valor_pago = null, comprada_em = null
   where id = p_compra and status = 'comprada';
end $$;

revoke all on function public.acolitos_retiro_comprar(uuid, numeric, date, uuid) from public, anon;
revoke all on function public.acolitos_retiro_desfazer_compra(uuid) from public, anon;
grant execute on function public.acolitos_retiro_comprar(uuid, numeric, date, uuid) to authenticated;
grant execute on function public.acolitos_retiro_desfazer_compra(uuid) to authenticated;

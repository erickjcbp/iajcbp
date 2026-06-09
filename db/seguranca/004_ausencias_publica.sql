-- 004 — Ausências públicas (fila pendente) — Acólitos (2026-06-09)
-- Tabela + índices + RLS + RPCs públicas (anon) + RPCs internas + grants

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1 Step 1 — Tabela, índices, RLS
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2 Step 1 — RPC pública: buscar (só id+nome, ≥2 letras, limite 20)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2 Step 2 — RPC pública: enviar (grava só na fila pendente)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 Step 1 — RPC interna: listar() (guardada)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 Step 2 — RPC interna: count() (para o badge da Home — leve)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.acolitos_ausencia_pendente_count()
returns int language sql stable security definer set search_path to 'public'
as $$
  select case
    when acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      then (select count(*)::int from public.acolitos_ausencias_pendentes where status='pendente')
    else 0 end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 Step 3 — RPC interna: decidir() (aprovar→escala real, rejeitar→descarta)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 Step 4 — GRANTs (anon só nas 2 públicas)
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function public.acolitos_ausencia_publica_buscar(text) to anon, authenticated;
grant execute on function public.acolitos_ausencia_publica_enviar(uuid[],date[],text,text,text) to anon, authenticated;

grant execute on function public.acolitos_ausencia_pendente_listar()  to authenticated;
grant execute on function public.acolitos_ausencia_pendente_count()   to authenticated;
grant execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) to authenticated;

-- internas nunca a anon. IMPORTANTE: revogar de PUBLIC (não só de anon) — o Supabase
-- concede EXECUTE a PUBLIC por padrão e anon herda via PUBLIC; revoke from anon sozinho
-- não basta. (O grant a authenticated acima preserva o acesso da equipe.)
revoke execute on function public.acolitos_ausencia_pendente_listar()  from public;
revoke execute on function public.acolitos_ausencia_pendente_count()   from public;
revoke execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) from public;

-- 006 — Ausências públicas por CELEBRAÇÃO (em vez de datas livres) (2026-06-09)
-- Espelha a dinâmica do app (informar ausência escolhendo missas).
-- Também: informante/motivo/contato passam a ser obrigatórios no envio.

-- 1) fila ganha celebracao_id; dedupe passa a ser por (membro, celebração)
alter table public.acolitos_ausencias_pendentes
  add column if not exists celebracao_id uuid references public.acolitos_celebracoes(id) on delete cascade;

drop index if exists public.acolitos_aus_pend_uniq;
create unique index if not exists acolitos_aus_pend_uniq_cel
  on public.acolitos_ausencias_pendentes (membro_id, celebracao_id) where status='pendente';

-- 2) RPC pública: celebrações futuras (id+data+horario+comunidade). Não é PII.
create or replace function public.acolitos_ausencia_publica_celebracoes()
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'data', data, 'horario', horario, 'comunidade', comunidade
  ) order by data, horario), '[]'::jsonb)
  from public.acolitos_celebracoes
  where data >= current_date and data <= current_date + 120;
$$;

-- 3) enviar passa a receber celebrações; informante/motivo/contato obrigatórios
drop function if exists public.acolitos_ausencia_publica_enviar(uuid[],date[],text,text,text);
create or replace function public.acolitos_ausencia_publica_enviar(
  p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo,'')),200),'');
  v_inf    text := nullif(left(btrim(coalesce(p_informante,'')),200),'');
  v_con    text := nullif(left(btrim(coalesce(p_contato,'')),200),'');
  v_n int := 0;
begin
  if p_membros is null or array_length(p_membros,1) is null
     or p_celebracoes is null or array_length(p_celebracoes,1) is null then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if v_inf is null or v_motivo is null or v_con is null then
    return jsonb_build_object('erro','campos_obrigatorios');
  end if;
  if array_length(p_membros,1) > 20 or array_length(p_celebracoes,1) > 30 then
    return jsonb_build_object('erro','muitos_itens');
  end if;

  insert into public.acolitos_ausencias_pendentes (membro_id, celebracao_id, data, motivo, informante_nome, informante_contato)
  select m.id, c.id, c.data, v_motivo, v_inf, v_con
  from unnest(p_membros) as mm(id)
  join public.acolitos_membros m on m.id = mm.id and m.status='ativo'
  cross join unnest(p_celebracoes) as cc(id)
  join public.acolitos_celebracoes c on c.id = cc.id and c.data >= current_date
  on conflict (membro_id, celebracao_id) where status='pendente' do nothing;

  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('erro','sem_itens_validos'); end if;
  return jsonb_build_object('ok', true, 'criadas', v_n);
end; $$;

-- 4) listar: enriquece com a celebração (data/horario/comunidade) p/ rótulo bonito
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
      'horario', c.horario, 'comunidade', c.comunidade,
      'motivo', p.motivo, 'informante_nome', p.informante_nome,
      'informante_contato', p.informante_contato, 'created_at', p.created_at)
      order by p.created_at desc, m.nome)
    from public.acolitos_ausencias_pendentes p
    join public.acolitos_membros m on m.id = p.membro_id
    left join public.acolitos_celebracoes c on c.id = p.celebracao_id
    where p.status='pendente'
  ), '[]'::jsonb));
end; $$;

-- 5) decidir: aprovar grava com celebracao_id; dedupe pela unique (membro_id, celebracao_id)
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
    insert into public.acolitos_ausencias (membro_id, data, celebracao_id, motivo, observacao)
    select p.membro_id, p.data, p.celebracao_id,
           'outro',
           nullif(concat_ws(' | ',
             case when p.informante_nome is not null then 'Informado por '||p.informante_nome else null end,
             p.informante_contato,
             nullif(btrim(p.motivo),'')
           ), '')
    from public.acolitos_ausencias_pendentes p
    where p.id = any(p_ids) and p.status='pendente'
    on conflict (membro_id, celebracao_id) do nothing;
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

-- 6) grants
grant execute on function public.acolitos_ausencia_publica_celebracoes() to anon, authenticated;
grant execute on function public.acolitos_ausencia_publica_enviar(uuid[],uuid[],text,text,text) to anon, authenticated;
revoke execute on function public.acolitos_ausencia_pendente_listar()  from public;
revoke execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) from public;
grant  execute on function public.acolitos_ausencia_pendente_listar()  to authenticated;
grant  execute on function public.acolitos_ausencia_pendente_decidir(uuid[],text) to authenticated;

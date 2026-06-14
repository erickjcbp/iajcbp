-- 043 — Ajustes Acólitos 2026-06-14
-- Aplicada no Supabase (ref fttjgsotuosjfrasttds) via MCP apply_migration
-- (migration "acolitos_substituto_xp_e_rpcs"). Versionada aqui para histórico.
--
-- Conteúdo:
--  1) acolitos_substituto_creditos + acolitos_substituto_creditar() — +10 XP ao substituto (idempotente)
--  2) view acolitos_frequencia — substituto que cobriu conta como "servida"
--  3) acolitos_avaliar_missoes() — missas_servidas conta também as substituições
--  4) acolitos_escalas_passadas() — histórico de escalas (datas < hoje)
--  5) acolitos_chamada_responsavel() — quem registrou a chamada (nome + quando)
--  6) acolitos_xp_hoje() — XP do dia (para a notificação diária)
-- Backfill: +10 XP retroativo aos substitutos já existentes (rodado via SQL, idempotente
--  pela PK de acolitos_substituto_creditos).

-- 1) Idempotência do crédito de +10 XP ao substituto (estilo avulso)
create table if not exists public.acolitos_substituto_creditos (
  celebracao_id uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  membro_id     uuid not null references public.acolitos_membros(id) on delete cascade,
  registrado_por uuid references auth.users(id),
  created_at timestamptz default now(),
  primary key (celebracao_id, membro_id)
);
alter table public.acolitos_substituto_creditos enable row level security;

create or replace function public.acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_role text := acolitos_get_role(auth.uid()); v_novo boolean := false;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  if p_substituto is null then return jsonb_build_object('ok',false); end if;
  insert into acolitos_substituto_creditos (celebracao_id, membro_id, registrado_por)
    values (p_celebracao, p_substituto, auth.uid())
    on conflict (celebracao_id, membro_id) do nothing;
  get diagnostics v_novo = row_count;
  if v_novo then
    update acolitos_membros set xp_avulso = coalesce(xp_avulso,0) + 10 where id = p_substituto;
    perform acolitos_cred_temp(p_substituto, 10, 'substituto');
  end if;
  return jsonb_build_object('ok',true,'novo',v_novo);
end; $$;
revoke all on function public.acolitos_substituto_creditar(uuid,uuid) from public, anon;
grant execute on function public.acolitos_substituto_creditar(uuid,uuid) to authenticated;

-- 2) View de frequência: substituto que cobriu conta como 'servida'
create or replace view public.acolitos_frequencia as
with base as (
  select e.membro_id, e.status, c.data
    from acolitos_escalas e
    join acolitos_celebracoes c on c.id = e.celebracao_id
  union all
  select e.substituto_id as membro_id, 'presente'::text as status, c.data
    from acolitos_escalas e
    join acolitos_celebracoes c on c.id = e.celebracao_id
   where e.status = 'substituido' and e.substituto_id is not null
)
select base.membro_id,
  count(*) as total_escalas,
  count(*) filter (where base.status = any (array['presente','atrasado'])) as servidas,
  count(*) filter (where base.status = 'ausente_justificado') as faltas_just,
  count(*) filter (where base.status = 'ausente') as faltas_nao_just,
  count(*) filter (where base.status = 'atrasado') as atrasos,
  count(*) filter (where base.status = 'escalado') as pendentes,
  round(100.0 * count(*) filter (where base.status = any (array['presente','atrasado']))::numeric
        / nullif(count(*) filter (where base.status = any (array['presente','atrasado','ausente_justificado','ausente'])), 0)::numeric) as taxa,
  max(base.data) filter (where base.status = any (array['presente','atrasado'])) as ultima_participacao
from base
group by base.membro_id;

-- 3) Missões automáticas: missas_servidas conta também as substituições
--    (recriada por completo; apenas o ramo 'missas_servidas' mudou)
create or replace function public.acolitos_avaliar_missoes(p_membro uuid, p_niveis text[])
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_dono boolean; v_role text := acolitos_get_role(v_uid);
  v_nivel text; v_idx int; v_prox text; v_desde timestamptz; v_nasc date; v_temp uuid; v_n int := 0;
  m record; c jsonb; ok boolean; cnt int;
begin
  select (mm.user_id=v_uid), mm.nivel, mm.nivel_desde, mm.data_nascimento
    into v_dono, v_nivel, v_desde, v_nasc from acolitos_membros mm where mm.id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then return 0; end if;
  v_idx := array_position(p_niveis, v_nivel);
  v_prox := case when v_idx is not null and v_idx < array_length(p_niveis,1) then p_niveis[v_idx+1] else null end;
  if v_prox is null then return 0; end if;
  select id into v_temp from acolitos_temporadas where ativa limit 1;

  for m in (select * from acolitos_missoes mi
             where mi.ativo and mi.validacao='automatica' and mi.nivel_alvo=v_prox
               and not exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')) loop
    c := m.criterio; ok := false;
    if c is not null then
      if c->>'fonte' = 'idade' then
        ok := (v_nasc is not null and date_part('year', age(v_nasc)) >= (c->>'min')::int);
      elsif c->>'fonte' = 'habilitacao' then
        ok := jsonb_array_length(coalesce(c->'funcoes','[]'::jsonb)) > 0 and not exists (
          select 1 from jsonb_array_elements_text(c->'funcoes') f
           where not exists (select 1 from acolitos_habilitacoes h
                              where h.membro_id=p_membro and h.funcao=f.value
                                and public._prof_rank(h.proficiencia) >= public._prof_rank(c->>'proficiencia')));
      elsif c->>'fonte' = 'missas_servidas' then
        select count(*) into cnt from acolitos_chamadas_itens ci
          join acolitos_escalas e on e.id=ci.escala_id
          join acolitos_celebracoes ce on ce.id=e.celebracao_id
         where (v_desde is null or ce.data >= v_desde::date)
           and (c->'funcoes' is null or e.funcao in (select jsonb_array_elements_text(c->'funcoes')))
           and (
                (ci.resultado in ('presente','atrasado') and e.membro_id=p_membro)
             or (ci.resultado = 'ausente' and ci.substituto_id = p_membro)
           );
        ok := cnt >= coalesce((c->>'quantidade')::int, 2147483647);
      elsif c->>'fonte' = 'funcoes_distintas' then
        select count(distinct e.funcao) into cnt from acolitos_chamadas_itens ci
          join acolitos_escalas e on e.id=ci.escala_id
          join acolitos_celebracoes ce on ce.id=e.celebracao_id
         where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro
           and (v_desde is null or ce.data >= v_desde::date);
        ok := cnt >= coalesce((c->>'quantidade')::int, 2147483647);
      elsif c->>'fonte' = 'ensaio' then
        select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
          join acolitos_eventos ev on ev.id=ep.evento_id
         where ep.membro_id=p_membro and ep.status='presente' and ev.tipo='ensaio'
           and (v_desde is null or ev.data >= v_desde::date);
        ok := cnt >= coalesce((c->>'quantidade')::int, 2147483647);
      elsif c->>'fonte' = 'ensaios_ajudados' then
        select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
          join acolitos_eventos ev on ev.id=ep.evento_id
         where ep.membro_id=p_membro and ep.status='ajudou' and ev.tipo='ensaio'
           and (v_desde is null or ev.data >= v_desde::date);
        ok := cnt >= coalesce((c->>'quantidade')::int, 2147483647);
      end if;
    end if;
    if ok then
      insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, temporada_id, concluida_em)
        values (m.id, p_membro, 'concluida', m.xp, v_temp, now())
      on conflict (missao_id, membro_id) do update set status='concluida', xp_ganho=excluded.xp_ganho, concluida_em=now();
      perform acolitos_cred_temp(p_membro, m.xp, 'missao');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end; $function$;

-- 4) Histórico de escalas (espelho de acolitos_escalas_futuras, datas passadas)
create or replace function public.acolitos_escalas_passadas()
 returns json language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(json_agg(c order by c.data desc, c.horario desc), '[]'::json)
  from (
    select cel.id, cel.data, cel.horario, cel.comunidade, cel.tipo,
      coalesce((
        select json_agg(json_build_object('funcao', e.funcao,
                 'nome', coalesce(nullif(m.apelido,''), m.nome)) order by e.funcao)
        from public.acolitos_escalas e
        join public.acolitos_membros m on m.id = e.membro_id
        where e.celebracao_id = cel.id
      ), '[]'::json) as escalados
    from public.acolitos_celebracoes cel
    where cel.data < (now() at time zone 'America/Sao_Paulo')::date
      and exists (select 1 from public.acolitos_escalas e2 where e2.celebracao_id = cel.id)
    order by cel.data desc, cel.horario desc
    limit 60
  ) c;
$function$;
revoke all on function public.acolitos_escalas_passadas() from public, anon;
grant execute on function public.acolitos_escalas_passadas() to authenticated;

-- 5) Responsável da chamada (nome + quando), à prova de RLS
create or replace function public.acolitos_chamada_responsavel(p_celebracao uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_role text := acolitos_get_role(auth.uid()); v jsonb;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return null;
  end if;
  select jsonb_build_object(
    'nome', coalesce(nullif(m.apelido,''), m.nome, u.email, 'Equipe'),
    'realizada_em', ch.realizada_em
  ) into v
  from acolitos_chamadas ch
  left join acolitos_membros m on m.user_id = ch.realizada_por
  left join auth.users u on u.id = ch.realizada_por
  where ch.celebracao_id = p_celebracao
  limit 1;
  return v;
end; $function$;
revoke all on function public.acolitos_chamada_responsavel(uuid) from public, anon;
grant execute on function public.acolitos_chamada_responsavel(uuid) to authenticated;

-- 6) XP ganho hoje pelo membro (para a notificação diária)
create or replace function public.acolitos_xp_hoje(p_membro uuid)
 returns integer language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(sum(xt.xp),0)::int
  from acolitos_xp_temporada xt
  where xt.membro_id = p_membro
    and (xt.created_at at time zone 'America/Sao_Paulo')::date
        = (now() at time zone 'America/Sao_Paulo')::date;
$function$;
revoke all on function public.acolitos_xp_hoje(uuid) from public, anon;
grant execute on function public.acolitos_xp_hoje(uuid) to authenticated;

-- Backfill retroativo (já executado): credita +10 XP a cada substituto distinto por celebração.
-- do $$
-- declare r record; v_temp uuid;
-- begin
--   select id into v_temp from acolitos_temporadas where ativa order by created_at desc limit 1;
--   for r in (select distinct celebracao_id, substituto_id from acolitos_escalas
--             where status='substituido' and substituto_id is not null) loop
--     insert into acolitos_substituto_creditos (celebracao_id, membro_id)
--       values (r.celebracao_id, r.substituto_id) on conflict do nothing;
--     if found then
--       update acolitos_membros set xp_avulso = coalesce(xp_avulso,0)+10 where id=r.substituto_id;
--       if v_temp is not null then
--         insert into acolitos_xp_temporada (membro_id, temporada_id, xp, origem)
--           values (r.substituto_id, v_temp, 10, 'substituto');
--       end if;
--     end if;
--   end loop;
-- end $$;

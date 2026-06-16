-- Competências como Virtudes da Jornada: progresso derivado de quests + selo manual.
-- Sem mudança de schema. RPC SECURITY DEFINER + seeds de config.

create or replace function public.acolitos_competencias_progresso(p_membro uuid)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with params as (
    select
      coalesce((select (valor #>> '{}')::int  from acolitos_config where chave='competencia_limiar_padrao'), 3) as padrao,
      coalesce((select (valor #>> '{}')::date from acolitos_config where chave='competencia_inicio'), current_date) as inicio
  ),
  formadas as (
    select coalesce(competencias_desenvolvidas, '{}'::text[]) as arr
    from acolitos_membros where id = p_membro
  ),
  prog as (
    select m.criterio->>'competencia' as comp, count(distinct mp.missao_id) as n
    from acolitos_missao_progresso mp
    join acolitos_missoes m on m.id = mp.missao_id
    cross join params p
    where mp.membro_id = p_membro
      and mp.status = 'concluida'
      and mp.concluida_em >= p.inicio
      and m.criterio ? 'competencia'
      and (m.criterio->>'competencia') <> ''
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'valor', l.valor,
      'label', coalesce(l.label, l.valor),
      'progresso', coalesce(pr.n, 0),
      'limiar', greatest(1, coalesce((l.meta->>'limiar')::int, p.padrao)),
      'formada', l.valor = any(f.arr),
      'status', case
         when l.valor = any(f.arr) then 'formada'
         when coalesce(pr.n,0) >= greatest(1, coalesce((l.meta->>'limiar')::int, p.padrao)) then 'candidata'
         when coalesce(pr.n,0) > 0 then 'em_formacao'
         else 'nenhuma' end
    ) order by l.label), '[]'::jsonb)
  from acolitos_listas l
  cross join params p
  cross join formadas f
  left join prog pr on pr.comp = l.valor
  where l.tipo = 'competencia';
$$;

revoke execute on function public.acolitos_competencias_progresso(uuid) from public, anon;
grant  execute on function public.acolitos_competencias_progresso(uuid) to authenticated;

-- seeds (idempotentes) — só criam se não existirem
insert into acolitos_config (chave, valor)
  select 'competencia_limiar_padrao', '3'::jsonb
  where not exists (select 1 from acolitos_config where chave='competencia_limiar_padrao');
insert into acolitos_config (chave, valor)
  select 'competencia_inicio', to_jsonb(current_date::text)
  where not exists (select 1 from acolitos_config where chave='competencia_inicio');

-- Acólitos 070 — a hora da missa ordena como HORA, não como TEXTO (correção da 069)
--
-- acolitos_celebracoes.horario é texto sem zero à esquerda. Valores reais hoje: 7h, 9h, 16h,
-- 17h, 18h30, 19h, 19h30. Comparando como TEXTO, '9h' > '7h' > '19h' — num dia com missas às
-- 7h, 9h e 19h, "da mais recente para a mais antiga" saía 9h, 7h, 19h em vez de 19h, 9h, 7h.
-- O MESMO comparador decide quais linhas sobrevivem ao LIMIT: com muitas faltas no dia, a
-- ordem errada pode até deixar de fora a falta das 19h e sobrar a das 7h.
--
-- A 069 já está aplicada em produção — não se edita migration aplicada. Esta é a correção,
-- em cima: acrescenta a função de conversão, acrescenta UMA coluna no fim da vista
-- (missa_minutos) e troca o `order by` da função de faltas para usar minutos. A vista
-- continua security_invoker; a função de faltas continua com a mesma assinatura, a mesma
-- trava (só coord_admin/subadmin/membro_equipe, 42501 sem permissão) e o mesmo nome — quem já
-- chama acolitos_faltas_filtradas() não muda nada, só passa a receber a ordem certa.
--
-- IDEMPOTENTE. Prova: docs/provas/provar-069-filtros-de-ausencias.sql (seção 5)

create or replace function public.acolitos_minutos_do_horario(p text)
returns integer
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select (m[1]::int * 60 + coalesce(nullif(m[2], '')::int, 0))
    from regexp_match(p, '^\s*(\d{1,2})\s*[h:]\s*(\d{0,2})') as m
$$;

revoke all on function public.acolitos_minutos_do_horario(text) from public;
revoke all on function public.acolitos_minutos_do_horario(text) from anon;
grant execute on function public.acolitos_minutos_do_horario(text) to authenticated;
grant execute on function public.acolitos_minutos_do_horario(text) to service_role;
comment on function public.acolitos_minutos_do_horario(text) is
  'Converte "7h", "18h30", "19:00" em minutos desde 00:00, para ordenar horário como hora, não como texto. NULL se não casar o padrão. Prova: provar-069 seção 5.';

create or replace view public.acolitos_ausencias_v
with (security_invoker = true) as
select a.id, a.membro_id, a.celebracao_id, a.motivo, a.observacao, a.created_at,
       coalesce(c.data, a.data) as missa_data,
       c.horario as missa_horario,
       c.comunidade as missa_comunidade,
       public.acolitos_minutos_do_horario(c.horario) as missa_minutos
  from public.acolitos_ausencias a
  left join public.acolitos_celebracoes c on c.id = a.celebracao_id;

revoke all on public.acolitos_ausencias_v from public;
revoke all on public.acolitos_ausencias_v from anon;
grant select on public.acolitos_ausencias_v to authenticated;
grant select on public.acolitos_ausencias_v to service_role;
comment on view public.acolitos_ausencias_v is
  'Ausências com a data/horário/comunidade da missa, para filtrar na consulta. security_invoker: obedece às regras de acolitos_ausencias. missa_minutos ordena o horário como hora (070). Prova: provar-069.';

create or replace function public.acolitos_faltas_filtradas(
  p_membros uuid[] default null, p_desde date default null, p_ate date default null,
  p_comunidades text[] default null, p_limite integer default 80)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(t.x order by t.d desc, t.m desc nulls last)
      from (
        select jsonb_build_object(
                 'membro_id', m.id,
                 'membro', coalesce(nullif(m.apelido,''), m.nome),
                 'funcao', e.funcao,
                 'data', cel.data, 'horario', cel.horario, 'comunidade', cel.comunidade,
                 'substituto', case when ci.substituto_id is not null
                                    then coalesce(nullif(sub.apelido,''), sub.nome) end
               ) as x,
               cel.data as d, public.acolitos_minutos_do_horario(cel.horario) as m
          from acolitos_chamadas_itens ci
          join acolitos_chamadas ch on ch.id = ci.chamada_id
          join acolitos_escalas e on e.id = ci.escala_id
          join acolitos_celebracoes cel on cel.id = ch.celebracao_id
          join acolitos_membros m on m.id = e.membro_id
          left join acolitos_membros sub on sub.id = ci.substituto_id
         where ci.resultado = 'ausente'
           and (p_membros is null or e.membro_id = any(p_membros))
           and (p_desde is null or cel.data >= p_desde)
           and (p_ate is null or cel.data <= p_ate)
           and (p_comunidades is null or cel.comunidade = any(p_comunidades))
         order by cel.data desc, public.acolitos_minutos_do_horario(cel.horario) desc nulls last
         limit greatest(1, least(coalesce(p_limite, 80), 500))
      ) t
  ), '[]'::jsonb);
end; $$;

revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from public;
revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from anon;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to authenticated;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to service_role;
comment on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) is
  'Faltas (chamada = ausente) filtradas no banco, ordenadas por data e hora em MINUTOS (070). Só coord_admin/subadmin/membro_equipe; sem permissão = 42501. Prova: provar-069.';

-- O servidor de consultas (PostgREST) só enxerga a vista e as funções depois de recarregar.
notify pgrst, 'reload schema';

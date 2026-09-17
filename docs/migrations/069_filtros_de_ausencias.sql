-- Acólitos 069 — filtros da tela Ausências (passo 4 do ordenar e filtrar)
--
-- As duas abas vêm do banco em PEDAÇOS (60 avisos, 80 faltas). Filtrar o pedaço que veio
-- mostraria a pessoa com 30 ausências como se tivesse 2. O filtro tem de ir para a consulta.
--
-- AVISOS → uma VISTA. A data da missa só está copiada em 648 das 1.202 ausências; filtrar
-- por acolitos_ausencias.data deixaria 554 de fora. A vista junta a missa. Ela é
-- security_invoker: quem consulta a vista passa pelas MESMAS regras de acesso da tabela
-- (equipe e cerimoniário veem todas; o membro, as suas e as da família) — sem repetir a
-- trava à mão, que é como trava se desencontra.
--
-- FALTAS → função NOVA, com outro nome. Uma segunda acolitos_faltas_recentes com argumentos
-- opcionais deixaria AMBÍGUA a chamada sem argumentos que a tela de hoje faz, e a aba Faltas
-- quebraria no instante desta migration. A antiga fica intacta até a tela trocar.
-- Sem permissão = ERRO 42501. A antiga devolvia lista vazia, e o cerimoniário lia
-- "Nenhuma falta registrada ainda." — falha virando zero.
--
-- IDEMPOTENTE. Prova: docs/provas/provar-069-filtros-de-ausencias.sql

create or replace view public.acolitos_ausencias_v
with (security_invoker = true) as
select a.id, a.membro_id, a.celebracao_id, a.motivo, a.observacao, a.created_at,
       coalesce(c.data, a.data) as missa_data,
       c.horario as missa_horario,
       c.comunidade as missa_comunidade
  from public.acolitos_ausencias a
  left join public.acolitos_celebracoes c on c.id = a.celebracao_id;

revoke all on public.acolitos_ausencias_v from public;
revoke all on public.acolitos_ausencias_v from anon;
grant select on public.acolitos_ausencias_v to authenticated;
grant select on public.acolitos_ausencias_v to service_role;
comment on view public.acolitos_ausencias_v is
  'Ausências com a data/horário/comunidade da missa, para filtrar na consulta. security_invoker: obedece às regras de acolitos_ausencias. Prova: provar-069.';

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
    select jsonb_agg(t.x order by t.d desc, t.h desc)
      from (
        select jsonb_build_object(
                 'membro_id', m.id,
                 'membro', coalesce(nullif(m.apelido,''), m.nome),
                 'funcao', e.funcao,
                 'data', cel.data, 'horario', cel.horario, 'comunidade', cel.comunidade,
                 'substituto', case when ci.substituto_id is not null
                                    then coalesce(nullif(sub.apelido,''), sub.nome) end
               ) as x,
               cel.data as d, cel.horario as h
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
         order by cel.data desc, cel.horario desc
         limit greatest(1, least(coalesce(p_limite, 80), 500))
      ) t
  ), '[]'::jsonb);
end; $$;

create or replace function public.acolitos_faltas_contar(
  p_membros uuid[] default null, p_desde date default null, p_ate date default null,
  p_comunidades text[] default null)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid()); v_n integer;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select count(*) into v_n
    from acolitos_chamadas_itens ci
    join acolitos_chamadas ch on ch.id = ci.chamada_id
    join acolitos_escalas e on e.id = ci.escala_id
    join acolitos_celebracoes cel on cel.id = ch.celebracao_id
   where ci.resultado = 'ausente'
     and (p_membros is null or e.membro_id = any(p_membros))
     and (p_desde is null or cel.data >= p_desde)
     and (p_ate is null or cel.data <= p_ate)
     and (p_comunidades is null or cel.comunidade = any(p_comunidades));
  return v_n;
end; $$;

revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from public;
revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from anon;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to authenticated;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to service_role;
revoke all on function public.acolitos_faltas_contar(uuid[], date, date, text[]) from public;
revoke all on function public.acolitos_faltas_contar(uuid[], date, date, text[]) from anon;
grant execute on function public.acolitos_faltas_contar(uuid[], date, date, text[]) to authenticated;
grant execute on function public.acolitos_faltas_contar(uuid[], date, date, text[]) to service_role;

comment on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) is
  'Faltas (chamada = ausente) filtradas no banco. Só coord_admin/subadmin/membro_equipe; sem permissão = 42501. Prova: provar-069.';
comment on function public.acolitos_faltas_contar(uuid[], date, date, text[]) is
  'Quantas faltas batem com os filtros. Mesma trava de acolitos_faltas_filtradas.';

-- O servidor de consultas (PostgREST) só enxerga vista e função novas depois de recarregar.
notify pgrst, 'reload schema';

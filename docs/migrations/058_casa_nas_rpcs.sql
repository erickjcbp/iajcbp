-- 058 — a casa da pessoa passa a chegar nas funções que alimentam os avatares
--
-- POR QUE: o brasão da casa já aparece no avatar desde 20/08, mas só nas telas que
-- leem `acolitos_membros` direto. Sete telas pegam a gente por FUNÇÃO do banco, e
-- nenhuma dessas funções devolvia `casa_id` — então ali o avatar saía sempre sem
-- brasão. A Jornada era o caso pior: ela já PEDE o brasão desde 20/08 e nunca
-- recebia nada, calada.
--
-- O QUE ESTA MIGRATION FAZ: acrescenta o campo `casa_id` na resposta de sete
-- funções. Só isso. Nenhuma junção nova, nenhum filtro novo, nenhuma tabela nova.
-- Onde havia agrupamento, a casa entrou no agrupamento junto — se eu tivesse
-- esquecido, o Postgres recusaria a criação aqui mesmo, alto e claro, em vez de
-- deixar a tela vazia depois.
--
-- DE BRINDE, na acolitos_campeoes: ela também passa a devolver `foto_url` e
-- `nivel`. A aba Campeões montava cada pessoa só com id, nome e liga — ou seja,
-- ninguém tinha foto ali. É a mesma função e o mesmo risco; separar em duas
-- migrations custaria mais do que resolve.
--
-- O QUE ELA NÃO RESOLVE: em 20/08/2026 só 1 das 176 pessoas ativas tem casa
-- preenchida. Depois desta migration o campo chega em todas as telas, mas vem
-- vazio para 175 pessoas — e vazio faz o avatar sair SEM brasão, nunca com o de
-- outra casa. Distribuir a gente pelas casas é ato da coordenação, em Casas, e
-- não se faz por SQL.
--
-- COMO CONFERIR: docs/provar-058-casa-nas-rpcs.sql — roda antes e depois, mede o
-- que está valendo e não escreve nada. A coluna `itens` tem de dar o MESMO número
-- nas duas rodadas; se cair, alguma tela ficou vazia.
--
-- `create or replace` preserva dono e permissões das funções. Conferido antes e
-- depois: as sete seguem com execução para `authenticated` e `service_role`, e
-- nenhuma para o anônimo.

begin;

-- 1/7 — Agenda: os rostinhos de quem confirmou presença
create or replace function public.acolitos_membros_display(p_ids uuid[])
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(m.id::text, jsonb_build_object(
           'id', m.id, 'nome', m.nome, 'apelido', m.apelido,
           'foto_url', m.foto_url, 'nivel', m.nivel, 'casa_id', m.casa_id)), '{}'::jsonb)
  from acolitos_membros m
  where m.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

-- 2/7 — Chamada, Caixa e Ausências: quem pode substituir
create or replace function public.acolitos_roster_substituicao()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_role text; v_result jsonb;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('membros', '[]'::jsonb, 'habs', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'membros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'apelido', m.apelido, 'foto_url', m.foto_url, 'nivel', m.nivel,
        'casa_id', m.casa_id,
        'comunidade', m.comunidade, 'pode_outras_comunidades', m.pode_outras_comunidades,
        'grupo_irmaos', m.grupo_irmaos, 'escalar_com_irmao', m.escalar_com_irmao,
        'data_nascimento', m.data_nascimento
      ) order by m.nome)
      from acolitos_membros m where m.status = 'ativo'
    ), '[]'::jsonb),
    'habs', coalesce((
      select jsonb_agg(jsonb_build_object('membro_id', h.membro_id, 'funcao', h.funcao, 'proficiencia', h.proficiencia))
      from acolitos_habilitacoes h
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

-- 3/7 — Destaques, primeira aba: serviu mais / mais funções / mais disponível
create or replace function public.acolitos_destaques()
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'servos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(e.id) as total
        from public.acolitos_membros m join public.acolitos_escalas e
          on e.membro_id=m.id and e.status in ('presente','atrasado')
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x),
    'versateis', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(h.id) as total
        from public.acolitos_membros m join public.acolitos_habilitacoes h
          on h.membro_id=m.id and h.proficiencia in ('apto','experiente','referencia')
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x),
    'prontos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(d.id) as total
        from public.acolitos_membros m join public.acolitos_disponibilidade d on d.membro_id=m.id
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x)
  );
$$;

-- 4/7 — Destaques aba Temporada, e a Jornada do admin
create or replace function public.acolitos_ranking_temporada()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_nome text; v_ini date; v_fim date; v_res jsonb;
begin
  select id, nome, inicio, fim into v_id, v_nome, v_ini, v_fim from acolitos_temporadas where ativa order by created_at desc limit 1;
  if v_id is null then return jsonb_build_object('temporada', null, 'ligas', '[]'::jsonb, 'eu_id', (select id from acolitos_membros where user_id=v_uid)); end if;
  with xp as (select membro_id, sum(xp) xp from acolitos_xp_temporada where temporada_id=v_id group by membro_id),
  base as (
    select m.id, coalesce(nullif(m.apelido,''), m.nome) as nome, m.nivel, m.foto_url, m.casa_id, coalesce(x.xp,0) xp,
      case when m.nivel in ('aspirante','coroinha','acolito_aspirante') then 'iniciantes'
           when m.nivel in ('acolito_guardiao','acolito_sentinela') then 'acolitos' else 'cerimoniarios' end liga
    from acolitos_membros m left join xp x on x.membro_id=m.id where m.status='ativo')
  select jsonb_agg(jsonb_build_object('liga',liga,'membros',membros) order by ord) into v_res from (
    select liga, case liga when 'iniciantes' then 1 when 'acolitos' then 2 else 3 end ord,
      jsonb_agg(jsonb_build_object('id',id,'nome',nome,'nivel',nivel,'foto_url',foto_url,'casa_id',casa_id,'xp',xp) order by xp desc, nome) membros
    from base where xp > 0 group by liga
  ) g;
  return jsonb_build_object('temporada', jsonb_build_object('nome',v_nome,'inicio',v_ini,'fim',v_fim),
                            'ligas', coalesce(v_res,'[]'::jsonb), 'eu_id', (select id from acolitos_membros where user_id=v_uid));
end; $$;

-- 5/7 — Destaques aba Campeões (ganha também foto e nível, que nunca teve)
create or replace function public.acolitos_campeoes()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'temporada', c.temporada_nome, 'liga', c.liga,
           'membro', coalesce(nullif(mb.apelido,''), c.membro_nome),
           'membro_id', c.membro_id, 'xp', c.xp,
           'foto_url', mb.foto_url, 'nivel', mb.nivel, 'casa_id', mb.casa_id)
         order by c.created_at desc, c.liga), '[]'::jsonb)
  from acolitos_campeoes c
  left join acolitos_membros mb on mb.id = c.membro_id;
$$;

-- 6/7 — Destaques aba Solícitos
create or replace function public.acolitos_solicitos()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by (x->>'total')::int desc, x->>'membro'), '[]'::jsonb)
  from (
    select jsonb_build_object('membro_id', m.id, 'membro', coalesce(nullif(m.apelido,''),m.nome),
             'foto_url', m.foto_url, 'nivel', m.nivel, 'casa_id', m.casa_id, 'total', count(*)) as x
    from acolitos_presencas_avulsas pa join acolitos_membros m on m.id=pa.membro_id
    where m.status='ativo'
    group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
  ) t;
$$;

-- 7/7 — o cartão que abre ao tocar num nome, em qualquer aba
create or replace function public.acolitos_membro_card(p_id uuid)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'id', m.id,
    'nome', coalesce(nullif(m.apelido,''), m.nome),
    'nome_completo', m.nome,
    'foto_url', m.foto_url,
    'nivel', m.nivel,
    'casa_id', m.casa_id,
    'comunidade', m.comunidade,
    'total_servido', (select count(*) from public.acolitos_escalas e where e.membro_id=m.id and e.status in ('presente','atrasado')),
    'funcoes', (select count(*) from public.acolitos_habilitacoes h where h.membro_id=m.id and h.proficiencia in ('apto','experiente','referencia')),
    'ultimas', coalesce((select json_agg(u) from (
        select cel.data, cel.horario, cel.comunidade, e.funcao
        from public.acolitos_escalas e
        join public.acolitos_celebracoes cel on cel.id=e.celebracao_id
        where e.membro_id=m.id and e.status in ('presente','atrasado')
        order by cel.data desc, cel.horario desc
        limit 8) u), '[]'::json)
  )
  from public.acolitos_membros m
  where m.id = p_id and m.status='ativo';
$$;

commit;

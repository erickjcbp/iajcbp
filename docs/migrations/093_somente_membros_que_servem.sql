-- Exclui serve=false das listas atuais de serviço; mantém cadastro, equipe e históricos.
CREATE OR REPLACE FUNCTION public.acolitos_colegas_casa(p_casa uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(x order by x.nome), '[]'::json) from (
    select m.id, coalesce(nullif(m.apelido,''), m.nome) as nome, m.foto_url, m.nivel
    from public.acolitos_membros m
    where m.casa_id = p_casa and m.status='ativo' and m.serve is true
  ) x;
$function$
;
CREATE OR REPLACE FUNCTION public.acolitos_destaques()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'servos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(e.id) as total
        from public.acolitos_membros m join public.acolitos_escalas e
          on e.membro_id=m.id and e.status in ('presente','atrasado')
        where m.status='ativo' and m.serve is true group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x),
    'versateis', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(h.id) as total
        from public.acolitos_membros m join public.acolitos_habilitacoes h
          on h.membro_id=m.id and h.proficiencia in ('apto','experiente','referencia')
        where m.status='ativo' and m.serve is true group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x),
    'prontos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, m.casa_id, count(d.id) as total
        from public.acolitos_membros m join public.acolitos_disponibilidade d on d.membro_id=m.id
        where m.status='ativo' and m.serve is true group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
        order by total desc, nome) x)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.acolitos_ensaio_convocados(p_evento uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text:=acolitos_get_role(auth.uid()); v_conv text[];
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  select convocados into v_conv from acolitos_eventos where id=p_evento;
  if v_conv is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome,'nivel',m.nivel,
            'presente', exists(select 1 from acolitos_evento_presencas ep where ep.evento_id=p_evento and ep.membro_id=m.id and ep.status='presente'))
          order by m.nome)
        from acolitos_membros m where m.status='ativo' and m.serve is true and m.nivel = any(v_conv)), '[]'::jsonb);
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_formacao_acompanhamento()
 RETURNS TABLE(membro_id uuid, nome text, status text, nivel text, faixa text, dias_parado integer, capitulo_atual integer, obrigatorias_feitas integer, obrigatorias_do_capitulo integer, ultima_missa date, ultimo_progresso date, telefone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Portão explícito. Devolver lista vazia para quem não pode ver seria pior do que recusar:
  -- a tela diria "ninguém parado" e a coordenação acreditaria. Este projeto já levou esse golpe.
  --
  -- ⚠️ O `coalesce` NÃO é enfeite. `acolitos_get_role` devolve NULO para quem ele não conhece,
  -- e em SQL `NULO not in (...)` não é FALSO — é NULO. Sem o coalesce o `if` nunca disparava e
  -- o portão ficava ESCANCARADO: qualquer pessoa logada leria telefone e progresso de todos.
  -- Foi a seção 7 da prova que pegou isto, minutos depois de a função subir.
  if coalesce(public.acolitos_get_role(auth.uid()), '') not in ('coord_admin', 'subadmin', 'membro_equipe') then
    raise exception 'Sem acesso ao acompanhamento da Formação'
      using errcode = '42501';
  end if;

  return query
  with base as (
    select m.id,
           m.nome,
           m.status,
           coalesce(nullif(m.nivel, ''), null) as nivel,
           (u.last_sign_in_at is not null) as entrou_no_app,
           -- A regra da casa para o telefone (projetos/acolitos/telefones-core.js): o número
           -- de recado primeiro, o do responsável como reserva. O da própria pessoa entra por
           -- último porque boa parte é criança e o aparelho é da mãe ou do pai.
           coalesce(nullif(m.celular_recado, ''), nullif(m.celular_responsavel, ''),
                    nullif(m.celular_mae, ''), nullif(m.telefone, '')) as telefone,
           (select max(p.created_at)::date from public.acolitos_missao_progresso p
             where p.membro_id = m.id and p.status in ('concluida', 'medalha')) as ultimo_progresso,
           (select max(c.data) from public.acolitos_escalas e
              join public.acolitos_celebracoes c on c.id = e.celebracao_id
             where e.membro_id = m.id and c.data <= current_date) as ultima_missa
      from public.acolitos_membros m
      left join auth.users u on u.id = m.user_id
     where coalesce(m.status, '') <> 'desligado' and m.serve is true
  ),
  comCapitulo as (
    select b.*,
           -- o capítulo atual é o PRIMEIRO com alguma obrigatória ainda por fazer
           (select min(q.capitulo) from public.acolitos_missoes q
             where q.nivel_alvo = b.nivel and q.obrigatoria and q.ativo
               and not exists (select 1 from public.acolitos_missao_progresso p
                                where p.membro_id = b.id and p.missao_id = q.id
                                  and p.status in ('concluida', 'medalha'))) as capitulo_atual
      from base b
  )
  select c.id,
         c.nome,
         c.status,
         c.nivel,
         case
           when not c.entrou_no_app then 'nunca_entrou'
           when c.ultimo_progresso is null then 'travado'
           when greatest(c.ultimo_progresso, coalesce(c.ultima_missa, c.ultimo_progresso))
                < current_date - 30 then 'parou'
           else 'andando'
         end as faixa,
         case
           when c.ultimo_progresso is null then null
           else (current_date - greatest(c.ultimo_progresso,
                                         coalesce(c.ultima_missa, c.ultimo_progresso)))::integer
         end as dias_parado,
         c.capitulo_atual,
         (select count(*)::integer from public.acolitos_missoes q
           where q.nivel_alvo = c.nivel and q.capitulo = c.capitulo_atual
             and q.obrigatoria and q.ativo
             and exists (select 1 from public.acolitos_missao_progresso p
                          where p.membro_id = c.id and p.missao_id = q.id
                            and p.status in ('concluida', 'medalha'))) as obrigatorias_feitas,
         (select count(*)::integer from public.acolitos_missoes q
           where q.nivel_alvo = c.nivel and q.capitulo = c.capitulo_atual
             and q.obrigatoria and q.ativo) as obrigatorias_do_capitulo,
         c.ultima_missa,
         c.ultimo_progresso,
         c.telefone
    from comCapitulo c
   order by case
              when not c.entrou_no_app then 0
              when c.ultimo_progresso is null then 1
              when greatest(c.ultimo_progresso, coalesce(c.ultima_missa, c.ultimo_progresso))
                   < current_date - 30 then 2
              else 3
            end,
            c.nome;
end $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_habilitados_funcao(p_funcao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_me uuid; v_out jsonb;
begin
  v_me := acolitos_meu_membro_id();
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'apelido', m.apelido)
           order by coalesce(m.apelido, m.nome)), '[]'::jsonb) into v_out
  from public.acolitos_membros m
  join public.acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = p_funcao
  where m.status = 'ativo' and m.serve is true and m.id is distinct from v_me;
  return jsonb_build_object('membros', v_out);
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_promocoes_pendentes(p_niveis text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('membro_id', x.id, 'membro', x.nome, 'nivel', x.nivel, 'proximo', x.prox) order by x.nome)
    from (
      select m.id, m.nome, m.nivel, p_niveis[array_position(p_niveis,m.nivel)+1] as prox
      from acolitos_membros m
      where m.status='ativo' and m.serve is true and array_position(p_niveis,m.nivel) is not null
        and array_position(p_niveis,m.nivel) < array_length(p_niveis,1)
    ) x
    where x.prox is not null
      and (select count(*) from acolitos_missoes where ativo and capitulo is not null and obrigatoria and nivel_alvo=x.prox) > 0
      and not exists (
        select 1 from acolitos_missoes mi
         where mi.ativo and mi.capitulo is not null and mi.obrigatoria and mi.nivel_alvo=x.prox
           and not (
             (coalesce(mi.criterio->>'fonte','')='habilitacao' and acolitos_prof_ok(x.id, mi.criterio->'funcoes', mi.criterio->>'proficiencia'))
             or exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=x.id and pr.status='concluida')))
      and not exists (
        select 1 from acolitos_missoes mi
        cross join lateral jsonb_array_elements_text(mi.criterio->'funcoes') as fn(funcao)
         where mi.ativo and mi.obrigatoria and mi.nivel_alvo is not null
           and mi.criterio->>'fonte'='habilitacao' and mi.criterio->>'proficiencia'='apto'
           and array_position(p_niveis, mi.nivel_alvo) <= array_position(p_niveis, x.nivel)
           and not exists (select 1 from acolitos_habilitacoes h where h.membro_id=x.id and h.funcao=fn.funcao and h.proficiencia in ('apto','experiente','referencia')))
  ), '[]'::jsonb);
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_quase_la(p_niveis text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('membro_id', x.id, 'membro', coalesce(nullif(x.apelido,''),x.nome),
             'proximo', x.prox, 'avaliadas', x.avaliadas) order by x.nome)
    from (
      select m.id, m.nome, m.apelido, m.nivel, p_niveis[array_position(p_niveis,m.nivel)+1] as prox,
        (select jsonb_agg(jsonb_build_object('id',mi.id,'titulo',mi.titulo) order by mi.capitulo, mi.ordem)
           from acolitos_missoes mi
          where mi.ativo and mi.capitulo is not null and mi.obrigatoria and mi.validacao='avaliada'
            and mi.nivel_alvo = p_niveis[array_position(p_niveis,m.nivel)+1]
            and not exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=m.id and pr.status='concluida')
        ) as avaliadas
      from acolitos_membros m
      where m.status='ativo' and m.serve is true and array_position(p_niveis,m.nivel) is not null
        and array_position(p_niveis,m.nivel) < array_length(p_niveis,1)
    ) x
    where x.prox is not null and x.avaliadas is not null
      -- todas as obrigatórias NÃO-avaliada já satisfeitas
      and not exists (
        select 1 from acolitos_missoes mi
         where mi.ativo and mi.capitulo is not null and mi.obrigatoria and mi.validacao <> 'avaliada' and mi.nivel_alvo=x.prox
           and not (
             (coalesce(mi.criterio->>'fonte','')='habilitacao' and acolitos_prof_ok(x.id, mi.criterio->'funcoes', mi.criterio->>'proficiencia'))
             or exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=x.id and pr.status='concluida')))
      -- sem pendência de função do gate (níveis até o atual)
      and not exists (
        select 1 from acolitos_missoes mi cross join lateral jsonb_array_elements_text(mi.criterio->'funcoes') f(funcao)
         where mi.ativo and mi.obrigatoria and mi.nivel_alvo is not null
           and mi.criterio->>'fonte'='habilitacao' and mi.criterio->>'proficiencia'='apto'
           and array_position(p_niveis, mi.nivel_alvo) <= array_position(p_niveis, x.nivel)
           and not exists (select 1 from acolitos_habilitacoes h where h.membro_id=x.id and h.funcao=f.funcao and h.proficiencia in ('apto','experiente','referencia')))
  ), '[]'::jsonb);
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_ranking_temporada()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid:=auth.uid(); v_id uuid; v_nome text; v_ini date; v_fim date; v_res jsonb;
begin
  select id, nome, inicio, fim into v_id, v_nome, v_ini, v_fim from acolitos_temporadas where ativa order by created_at desc limit 1;
  if v_id is null then return jsonb_build_object('temporada', null, 'ligas', '[]'::jsonb, 'eu_id', (select id from acolitos_membros where user_id=v_uid)); end if;
  with xp as (select membro_id, sum(xp) xp from acolitos_xp_temporada where temporada_id=v_id group by membro_id),
  base as (
    select m.id, coalesce(nullif(m.apelido,''), m.nome) as nome, m.nivel, m.foto_url, m.casa_id, coalesce(x.xp,0) xp,
      case when m.nivel in ('aspirante','coroinha','acolito_aspirante') then 'iniciantes'
           when m.nivel in ('acolito_guardiao','acolito_sentinela') then 'acolitos' else 'cerimoniarios' end liga
    from acolitos_membros m left join xp x on x.membro_id=m.id where m.status='ativo' and m.serve is true)
  select jsonb_agg(jsonb_build_object('liga',liga,'membros',membros) order by ord) into v_res from (
    select liga, case liga when 'iniciantes' then 1 when 'acolitos' then 2 else 3 end ord,
      jsonb_agg(jsonb_build_object('id',id,'nome',nome,'nivel',nivel,'foto_url',foto_url,'casa_id',casa_id,'xp',xp) order by xp desc, nome) membros
    from base where xp > 0 group by liga
  ) g;
  return jsonb_build_object('temporada', jsonb_build_object('nome',v_nome,'inicio',v_ini,'fim',v_fim),
                            'ligas', coalesce(v_res,'[]'::jsonb), 'eu_id', (select id from acolitos_membros where user_id=v_uid));
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_roster_nomes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome),'[]'::jsonb)
  from public.acolitos_membros where status='ativo' and serve is true;
$function$
;
CREATE OR REPLACE FUNCTION public.acolitos_roster_substituicao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'data_nascimento', m.data_nascimento,
        'suspenso_ate', m.suspenso_ate
      ) order by m.nome)
      from acolitos_membros m where m.status = 'ativo' and m.serve is true
    ), '[]'::jsonb),
    'habs', coalesce((
      select jsonb_agg(jsonb_build_object('membro_id', h.membro_id, 'funcao', h.funcao, 'proficiencia', h.proficiencia))
      from acolitos_habilitacoes h
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_eh_equipe boolean := acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe');
  v_membro uuid;
  v_cel record;
  v_slot record;
  v_sub uuid;
  v_diakey text;
  v_count int := 0;
  v_ok boolean;
begin
  if p_membros is null or p_celebracoes is null then return 0; end if;
  foreach v_membro in array p_membros loop
    v_ok := v_eh_equipe
      or exists (select 1 from acolitos_membros where id = v_membro and user_id = auth.uid())
      or exists (select 1 from acolitos_membros me join acolitos_membros tgt on tgt.grupo_irmaos = me.grupo_irmaos
                 where me.user_id = auth.uid() and me.grupo_irmaos is not null and tgt.id = v_membro);
    if not v_ok then continue; end if;

    for v_cel in select * from acolitos_celebracoes where id = any(p_celebracoes) loop
      v_diakey := case extract(dow from v_cel.data)::int when 0 then 'domingo' when 6 then 'sabado' else null end;
      for v_slot in select * from acolitos_escalas where celebracao_id = v_cel.id and membro_id = v_membro loop
        select m.id into v_sub
        from acolitos_membros m
        join acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = v_slot.funcao and h.proficiencia in ('apto','experiente','referencia')
        where m.status = 'ativo' and m.serve is true and m.id <> v_membro
          and (v_diakey is null or exists (select 1 from acolitos_disponibilidade d where d.membro_id = m.id and d.dia = v_diakey and d.horario = v_cel.horario))
          and not exists (select 1 from acolitos_ausencias a where a.membro_id = m.id and (a.celebracao_id = v_cel.id or a.data = v_cel.data))
          and not (m.suspenso_ate is not null and m.suspenso_ate > v_cel.data)
          and not exists (select 1 from acolitos_escalas e where e.celebracao_id = v_cel.id and e.membro_id = m.id)
        order by (select count(*) from acolitos_escalas e2 where e2.membro_id = m.id) asc, random()
        limit 1;
        if v_sub is not null then
          update acolitos_escalas set membro_id = v_sub, substituto_id = v_membro where id = v_slot.id;
          v_count := v_count + 1;
        else
          delete from acolitos_escalas where id = v_slot.id;
        end if;
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.acolitos_solicitos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by (x->>'total')::int desc, x->>'membro'), '[]'::jsonb)
  from (
    select jsonb_build_object('membro_id', m.id, 'membro', coalesce(nullif(m.apelido,''),m.nome),
             'foto_url', m.foto_url, 'nivel', m.nivel, 'casa_id', m.casa_id, 'total', count(*)) as x
    from acolitos_presencas_avulsas pa join acolitos_membros m on m.id=pa.membro_id
    where m.status='ativo' and m.serve is true
    group by m.id, m.apelido, m.nome, m.foto_url, m.nivel, m.casa_id
  ) t;
$function$
;
-- Uma aplicação é uma transação; as mesmas permissões RLS das edições individuais.
create or replace function public.acolitos_jornada_editar_lote(p_membros uuid[], p_acao text, p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_ids uuid[]; v_total integer; v_nivel text; v_prof text; v_modo text; v_funcoes text[];
begin
  if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'Sem permissão para editar membros' using errcode='42501';
  end if;
  select array_agg(distinct x) into v_ids from unnest(p_membros) x where x is not null;
  v_total:=coalesce(cardinality(v_ids),0);
  if v_total=0 or v_total>500 then raise exception 'Selecione de 1 a 500 membros'; end if;
  -- Trava os membros na mesma ordem para serializar aplicações concorrentes.
  perform id from public.acolitos_membros where id=any(v_ids) and status='ativo' and serve is true order by id for update;
  if (select count(*) from public.acolitos_membros where id=any(v_ids) and status='ativo' and serve is true)<>v_total then
    raise exception 'Um membro selecionado não está mais ativo, não serve ou não está acessível. Atualize a matriz';
  end if;
  if p_acao='nivel' then
    v_nivel:=p_dados->>'nivel';
    if v_nivel is null or not (v_nivel=any(array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'])
      or exists(select 1 from public.acolitos_config c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.valor)='array' then c.valor else '[]'::jsonb end) n where c.chave='niveis_full' and n->>'slug'=v_nivel)) then
      raise exception 'Nível inválido';
    end if;
    update public.acolitos_membros set nivel=v_nivel where id=any(v_ids);
  elsif p_acao='funcoes' then
    select array_agg(distinct x) into v_funcoes from jsonb_array_elements_text(p_dados->'funcoes') x;
    v_prof:=p_dados->>'proficiencia';
    if coalesce(cardinality(v_funcoes),0)=0 or exists(select 1 from unnest(v_funcoes) f where f<>all(array['apoio','cruz','vela','sineta','sinao','altar','turibulo','naveta','missal','cred_altar','cred_credencia','mitra','baculo'])) then raise exception 'Escolha funções válidas'; end if;
    if v_prof is null or v_prof<>all(array['nao_treinado','em_formacao','apto','experiente','referencia']) then raise exception 'Proficiência inválida'; end if;
    insert into public.acolitos_habilitacoes(membro_id,funcao,proficiencia,updated_at)
      select m,f,v_prof,now() from unnest(v_ids) m cross join unnest(v_funcoes) f
      on conflict(membro_id,funcao) do update set proficiencia=excluded.proficiencia,updated_at=excluded.updated_at;
  elsif p_acao='disponibilidade' then
    v_modo:=p_dados->>'modo';
    if v_modo is null or v_modo<>all(array['adicionar','remover','substituir','limpar']) then raise exception 'Modo inválido'; end if;
    if v_modo<>'limpar' then
      if jsonb_typeof(p_dados->'horarios') is distinct from 'array' or jsonb_array_length(p_dados->'horarios')=0 then raise exception 'Escolha ao menos um horário'; end if;
      if exists(select 1 from jsonb_array_elements(p_dados->'horarios') h where coalesce(h->>'dia','')<>all(array['sabado','domingo']) or coalesce(btrim(h->>'horario'),'')='' or length(h->>'horario')>30) then raise exception 'Horário inválido'; end if;
    end if;
    if v_modo in ('substituir','limpar') then
      delete from public.acolitos_disponibilidade where membro_id=any(v_ids);
    elsif v_modo='remover' then
      delete from public.acolitos_disponibilidade d where d.membro_id=any(v_ids)
        and exists(select 1 from jsonb_array_elements(p_dados->'horarios') h where h->>'dia'=d.dia and h->>'horario'=d.horario);
    end if;
    if v_modo in ('adicionar','substituir') then
      insert into public.acolitos_disponibilidade(membro_id,dia,horario)
        select m,h.dia,h.horario from unnest(v_ids) m cross join
          (select distinct x->>'dia' dia,x->>'horario' horario from jsonb_array_elements(p_dados->'horarios') x) h
        where not exists(select 1 from public.acolitos_disponibilidade d where d.membro_id=m and d.dia=h.dia and d.horario=h.horario);
    end if;
  else raise exception 'Ação inválida'; end if;
  return jsonb_build_object('ok',true,'total',v_total);
end $$;
revoke all on function public.acolitos_jornada_editar_lote(uuid[],text,jsonb) from public,anon;
grant execute on function public.acolitos_jornada_editar_lote(uuid[],text,jsonb) to authenticated;

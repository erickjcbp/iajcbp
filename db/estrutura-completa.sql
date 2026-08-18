-- ============================================================
-- ACÓLITOS — a estrutura completa do banco, como está hoje
-- Fotografia tirada em 18/08/2026, direto do banco de produção.
--
-- PARA QUE SERVE
-- Rodando este arquivo num banco vazio, você tem de volta a estrutura inteira do app: as
-- tabelas, as colunas, as regras de quem pode ler e escrever o quê, e as funções. É o que
-- salva se a conta do Supabase for perdida, se algo for apagado sem querer, ou se você
-- quiser um banco de testes igual ao de verdade.
--
-- POR QUE ELE EXISTE
-- As migrations 012 a 042 — 31 mudanças de banco — foram aplicadas direto, sem virar arquivo.
-- Essas mudanças, uma a uma, estão perdidas: não há como saber o que cada uma fez. O que dá
-- para recuperar é o RESULTADO delas, que é o que este arquivo guarda. Sem ele não havia como
-- reconstruir o banco do zero, e era o risco mais sério do projeto.
--
-- COMO USAR
-- Banco novo → rode este arquivo primeiro, e depois as migrations de 055 em diante.
-- Banco que já existe → NÃO rode. Ele recria tudo; é fotografia, não remendo.
--
-- O QUE NÃO ESTÁ AQUI
-- • Os DADOS. Só a estrutura — nenhum membro, nenhuma escala, nenhum lançamento.
-- • O schema `auth` do Supabase (contas e logins). Ele é do Supabase e nasce com o projeto;
--   por isso este arquivo só roda num projeto Supabase, não num Postgres pelado.
-- • As extensões, que o Supabase já instala sozinho num projeto novo.
--
-- CONFERIDO ao tirar: 40 tabelas, 92 funções, 75 regras de acesso, proteção de linha ligada
-- nas 40 tabelas, 312 permissões concedidas e 87 revogadas. Nenhuma chave ou senha dentro
-- (procurei antes de guardar).
--
-- Quando o banco mudar bastante, tire outra fotografia e substitua este arquivo.
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict YrDvTceW7O1t9MlqtuRWggxKTN8veSx8rRgeTcEyDyquebeLUxEcecD3ZIqfhcD

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: _acolitos_medalha_ao_apto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._acolitos_medalha_ao_apto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare b record;
begin
  if _prof_rank(NEW.proficiencia) < _prof_rank('apto') then return NEW; end if;
  for b in (
    select mi.id, mi.badge_label, mi.criterio
    from acolitos_missoes mi
    where mi.ativo and mi.concede_badge and mi.badge_label is not null
      and mi.criterio->>'fonte'='habilitacao' and (mi.criterio->'funcoes') ? NEW.funcao
  ) loop
    if exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=b.id and pr.membro_id=NEW.membro_id) then continue; end if;
    if jsonb_array_length(coalesce(b.criterio->'funcoes','[]'::jsonb)) > 0 and not exists (
        select 1 from jsonb_array_elements_text(b.criterio->'funcoes') f
         where not exists (select 1 from acolitos_habilitacoes h where h.membro_id=NEW.membro_id and h.funcao=f.value
                            and _prof_rank(h.proficiencia) >= _prof_rank(b.criterio->>'proficiencia'))) then
      insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, concluida_em)
        values (b.id, NEW.membro_id, 'medalha', 0, now())
      on conflict (missao_id, membro_id) do nothing;
      update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'tipo','medalha','label',b.badge_label,'seen',false,'ts',(extract(epoch from now())*1000)::bigint)) where id=NEW.membro_id;
    end if;
  end loop;
  return NEW;
end; $$;


--
-- Name: _acolitos_semana_str(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._acolitos_semana_str(p_offset integer) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select to_char(((now() at time zone 'America/Sao_Paulo')::date + (coalesce(p_offset,0)*7)), 'IYYY-"W"IW');
$$;


--
-- Name: _prof_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._prof_rank(p text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p when 'referencia' then 5 when 'experiente' then 4 when 'apto' then 3 when 'em_formacao' then 2 when 'nao_treinado' then 1 else 0 end;
$$;


--
-- Name: acolitos_aplicar_troca_escala(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_aplicar_troca_escala(p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text; v_alvo_id uuid; v_funcao text; v_novo_id uuid;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select id, funcao into v_alvo_id, v_funcao
  from public.acolitos_escalas
  where celebracao_id = p_celebracao_id and membro_id = p_membro_ausente_id
    and status in ('escalado','presente','atrasado')
  order by created_at limit 1;
  if v_alvo_id is null then
    return jsonb_build_object('ok', true, 'nao_escalado', true);
  end if;
  update public.acolitos_escalas
    set status='substituido', substituto_id = p_novo_membro_id
    where id = v_alvo_id;
  if p_novo_membro_id is not null then
    insert into public.acolitos_escalas (celebracao_id, membro_id, funcao, status, created_by)
    values (p_celebracao_id, p_novo_membro_id, v_funcao, 'escalado', auth.uid())
    returning id into v_novo_id;
  end if;
  return jsonb_build_object('ok', true, 'funcao', v_funcao, 'alvo_id', v_alvo_id, 'novo_escala_id', v_novo_id);
end; $$;


--
-- Name: acolitos_ausencia_pendente_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_pendente_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
      then (select count(*)::int from public.acolitos_ausencias_pendentes where status='pendente')
    else 0 end;
$$;


--
-- Name: acolitos_ausencia_pendente_decidir(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: acolitos_ausencia_pendente_listar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_pendente_listar() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  return jsonb_build_object('pendentes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'membro_id', p.membro_id, 'nome', m.nome, 'data', p.data,
      'celebracao_id', p.celebracao_id,
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


--
-- Name: acolitos_ausencia_publica_buscar(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_publica_buscar(p_q text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome), '[]'::jsonb)
  from (
    select id, nome
    from public.acolitos_membros
    where status='ativo'
      and length(btrim(coalesce(p_q,''))) >= 2
      and unaccent(nome) ilike '%' || unaccent(replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')) || '%'
    order by nome
    limit 20
  ) s;
$$;


--
-- Name: acolitos_ausencia_publica_celebracoes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_publica_celebracoes() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'data', data, 'horario', horario, 'comunidade', comunidade
  ) order by data, horario), '[]'::jsonb)
  from public.acolitos_celebracoes
  where data >= current_date and data <= (current_date + interval '3 months')::date;
$$;


--
-- Name: acolitos_ausencia_publica_enviar(uuid[], uuid[], text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ausencia_publica_enviar(p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  if array_length(p_membros,1) > 20 or array_length(p_celebracoes,1) > 120 then
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


--
-- Name: acolitos_avaliar_missoes(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_avaliar_missoes(p_membro uuid, p_niveis text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
end; $$;


--
-- Name: acolitos_avulso_add(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_avulso_add(p_celebracao uuid, p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_novo boolean:=false;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then return jsonb_build_object('erro','sem_permissao'); end if;
  insert into acolitos_presencas_avulsas (celebracao_id, membro_id, registrado_por)
    values (p_celebracao, p_membro, auth.uid())
  on conflict (celebracao_id, membro_id) do nothing;
  get diagnostics v_novo = row_count;
  if v_novo then
    update acolitos_membros set xp_avulso = coalesce(xp_avulso,0) + 10 where id=p_membro;
    perform acolitos_cred_temp(p_membro, 10, 'solicito');
  end if;
  return jsonb_build_object('ok',true,'novo',v_novo);
end; $$;


--
-- Name: acolitos_avulso_remove(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_avulso_remove(p_celebracao uuid, p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_del int;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then return jsonb_build_object('erro','sem_permissao'); end if;
  delete from acolitos_presencas_avulsas where celebracao_id=p_celebracao and membro_id=p_membro;
  get diagnostics v_del = row_count;
  if v_del > 0 then
    update acolitos_membros set xp_avulso = greatest(0, coalesce(xp_avulso,0) - 10) where id=p_membro;
    perform acolitos_cred_temp(p_membro, -10, 'solicito_estorno');
  end if;
  return jsonb_build_object('ok',true,'removidos',v_del);
end; $$;


--
-- Name: acolitos_avulsos_celebracao(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_avulsos_celebracao(p_celebracao uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('membro_id',pa.membro_id,'nome',coalesce(nullif(m.apelido,''),m.nome)) order by m.nome)
    from acolitos_presencas_avulsas pa join acolitos_membros m on m.id=pa.membro_id
    where pa.celebracao_id=p_celebracao), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_badge_cumpre(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_badge_cumpre(p_membro uuid, c jsonb) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_nasc date; v_created timestamptz; cnt int;
begin
  if c is null then return false; end if;
  if c->>'fonte' = 'habilitacao' then
    return jsonb_array_length(coalesce(c->'funcoes','[]'::jsonb)) > 0 and not exists (
      select 1 from jsonb_array_elements_text(c->'funcoes') f
       where not exists (select 1 from acolitos_habilitacoes h where h.membro_id=p_membro and h.funcao=f.value
          and _prof_rank(h.proficiencia) >= _prof_rank(c->>'proficiencia')));
  elsif c->>'fonte' = 'idade' then
    select data_nascimento into v_nasc from acolitos_membros where id=p_membro;
    return v_nasc is not null and date_part('year', age(v_nasc)) >= (c->>'min')::int;
  elsif c->>'fonte' = 'missas_total' then
    select count(*) into cnt from acolitos_chamadas_itens ci
      join acolitos_escalas e on e.id=ci.escala_id
     where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro;
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'ensaios_total' then
    select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
      join acolitos_eventos ev on ev.id=ep.evento_id
     where ep.membro_id=p_membro and ep.status='presente' and ev.tipo='ensaio';
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'funcoes_aptas' then
    select count(*) into cnt from acolitos_habilitacoes h
     where h.membro_id=p_membro and h.proficiencia in ('apto','experiente','referencia');
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'tenure' then
    select created_at into v_created from acolitos_membros where id=p_membro;
    return v_created is not null and v_created <= now() - ((c->>'meses')::int || ' months')::interval;
  elsif c->>'fonte' = 'solicitos' then
    select count(*) into cnt from acolitos_presencas_avulsas where membro_id=p_membro;
    return cnt >= (c->>'quantidade')::int;
  elsif c->>'fonte' = 'campeao' then
    select count(*) into cnt from acolitos_campeoes where membro_id=p_membro;
    return cnt >= coalesce((c->>'quantidade')::int, 1);
  end if;
  return false;
end; $$;


--
-- Name: acolitos_badges_membro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_badges_membro(p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid);
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', mi.id, 'label', mi.badge_label, 'icone', mi.badge_icone, 'nivel', mi.nivel_alvo,
      'tier', mi.badge_tier, 'validacao', mi.validacao, 'desc', mi.badge_desc,
      'requisito', case
        when mi.criterio->>'fonte'='habilitacao' then 'Fique Apto em ' || (
          select string_agg(coalesce(lbl.label, f.value), ' e ' order by f.ord)
          from jsonb_array_elements_text(mi.criterio->'funcoes') with ordinality f(value,ord)
          left join (values ('apoio','Apoio'),('cruz','Cruz'),('vela','Vela'),('sineta','Sineta'),('sinao','Sinão'),
            ('altar','Altar'),('turibulo','Turíbulo'),('naveta','Naveta'),('missal','Missal'),
            ('cred_altar','Cerimoniário de Altar'),('cred_credencia','Cerimoniário de Credência'),
            ('mitra','Mitra'),('baculo','Báculo')) lbl(slug,label) on lbl.slug=f.value)
        when mi.criterio->>'fonte'='idade' then 'Complete ' || (mi.criterio->>'min') || ' anos'
        when mi.criterio->>'fonte'='missas_total' then 'Sirva ' || (mi.criterio->>'quantidade') || ' missas no total'
        when mi.criterio->>'fonte'='ensaios_total' then 'Participe de ' || (mi.criterio->>'quantidade') || ' ensaios no total'
        when mi.criterio->>'fonte'='funcoes_aptas' then 'Fique Apto em ' || (mi.criterio->>'quantidade') || ' funções'
        when mi.criterio->>'fonte'='solicitos' then 'Sirva ' || (mi.criterio->>'quantidade') || ' vezes sem estar escalado'
        when mi.criterio->>'fonte'='campeao' then 'Vença ' || (mi.criterio->>'quantidade') || ' temporada(s)'
        when mi.criterio->>'fonte'='tenure' then 'Complete ' || case when (mi.criterio->>'meses')::int >= 12 and (mi.criterio->>'meses')::int % 12 = 0
              then ((mi.criterio->>'meses')::int / 12)::text || ' ano(s)' else (mi.criterio->>'meses') || ' meses' end || ' de pastoral'
        when mi.validacao='avaliada' then 'Concedida pela coordenação'
        else 'Conclua: ' || mi.titulo end,
      'ganho', case
        when mi.criterio is null then exists(select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
        else acolitos_badge_cumpre(p_membro, mi.criterio)
      end)
      order by array_position(array['coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'], mi.nivel_alvo) nulls last, mi.ordem)
    from acolitos_missoes mi where mi.ativo and mi.concede_badge and mi.badge_label is not null
  ), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_campeoes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_campeoes() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'temporada', c.temporada_nome, 'liga', c.liga,
           'membro', coalesce(nullif(mb.apelido,''), c.membro_nome),
           'membro_id', c.membro_id, 'xp', c.xp)
         order by c.created_at desc, c.liga), '[]'::jsonb)
  from acolitos_campeoes c
  left join acolitos_membros mb on mb.id = c.membro_id;
$$;


--
-- Name: acolitos_candidatar_vaga(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_id uuid;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  if not exists (select 1 from public.acolitos_habilitacoes where membro_id = v_me and funcao = p_funcao) then
    return jsonb_build_object('erro','sem_habilitacao');
  end if;
  if exists (select 1 from public.acolitos_escalas
             where celebracao_id = p_celebracao_id and membro_id = v_me and status = 'escalado') then
    return jsonb_build_object('erro','ja_escalado');
  end if;
  if exists (select 1 from public.acolitos_solicitacoes
             where celebracao_id = p_celebracao_id and membro_id = v_me and tipo='candidatura'
               and status in ('aguardando_coordenacao')) then
    return jsonb_build_object('erro','ja_candidatou');
  end if;
  insert into public.acolitos_solicitacoes(membro_id, celebracao_id, funcao, tipo, status, motivo)
  values (v_me, p_celebracao_id, p_funcao, 'candidatura', 'aguardando_coordenacao', p_motivo)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;


--
-- Name: acolitos_chamada_responsavel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_chamada_responsavel(p_celebracao uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
end; $$;


--
-- Name: acolitos_colegas_casa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_colegas_casa(p_casa uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(json_agg(x order by x.nome), '[]'::json) from (
    select m.id, coalesce(nullif(m.apelido,''), m.nome) as nome, m.foto_url, m.nivel
    from public.acolitos_membros m
    where m.casa_id = p_casa and m.status='ativo'
  ) x;
$$;


--
-- Name: acolitos_competencias_progresso(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_competencias_progresso(p_membro uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: acolitos_controla_membro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_controla_membro(p_membro uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(
    select 1 from public.acolitos_membros m
    where m.id = p_membro
      and ( m.user_id = auth.uid()
         or (m.grupo_irmaos is not null and m.grupo_irmaos = acolitos_meu_grupo()) )
  );
$$;


--
-- Name: acolitos_cred_temp(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_cred_temp(p_membro uuid, p_xp integer, p_origem text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid;
begin
  if p_xp is null or p_xp = 0 then return; end if;
  select id into v from acolitos_temporadas where ativa order by created_at desc limit 1;
  if v is null then return; end if;
  insert into acolitos_xp_temporada (membro_id, temporada_id, xp, origem) values (p_membro, v, p_xp, p_origem);
end; $$;


--
-- Name: acolitos_desfazer_troca_escala(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_desfazer_troca_escala(p_alvo_id uuid, p_novo_escala_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  if p_novo_escala_id is not null then
    delete from public.acolitos_escalas where id = p_novo_escala_id;
  end if;
  update public.acolitos_escalas set substituto_id = null where id = p_alvo_id;
  return jsonb_build_object('ok', true);
end; $$;


--
-- Name: acolitos_destaques(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_destaques() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'servos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, count(e.id) as total
        from public.acolitos_membros m join public.acolitos_escalas e
          on e.membro_id=m.id and e.status in ('presente','atrasado')
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel
        order by total desc, nome) x),
    'versateis', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, count(h.id) as total
        from public.acolitos_membros m join public.acolitos_habilitacoes h
          on h.membro_id=m.id and h.proficiencia in ('apto','experiente','referencia')
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel
        order by total desc, nome) x),
    'prontos', (select coalesce(json_agg(x),'[]'::json) from (
        select m.id, coalesce(nullif(m.apelido,''),m.nome) as nome, m.foto_url, m.nivel, count(d.id) as total
        from public.acolitos_membros m join public.acolitos_disponibilidade d on d.membro_id=m.id
        where m.status='ativo' group by m.id, m.apelido, m.nome, m.foto_url, m.nivel
        order by total desc, nome) x)
  );
$$;


--
-- Name: acolitos_ensaio_ajudantes(uuid, uuid[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ensaio_ajudantes(p_evento uuid, p_ajudantes uuid[], p_niveis text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); a uuid; n int:=0;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  if p_ajudantes is null then return jsonb_build_object('ok',true,'ajudantes',0); end if;
  foreach a in array p_ajudantes loop
    insert into acolitos_evento_presencas (evento_id, membro_id, status) values (p_evento, a, 'ajudou')
      on conflict (evento_id, membro_id) do update set status='ajudou';
    -- avalia as quests automáticas de "ajudar em ensaios" do próximo nível do ajudante
    perform acolitos_avaliar_missoes(a, p_niveis);
    -- notifica (XP vem ao concluir cada quest contada)
    update acolitos_membros
       set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
         'msg','✋ Você foi marcado como ajudante de um ensaio — conta na sua jornada!','seen',false,'ts',(extract(epoch from now())*1000)::bigint))
     where id=a;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok',true,'ajudantes',n);
end; $$;


--
-- Name: acolitos_ensaio_chamada(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ensaio_chamada(p_evento uuid, p_presentes uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_conv text[]; n int;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  select convocados into v_conv from acolitos_eventos where id=p_evento;
  if v_conv is null then return jsonb_build_object('erro','nao_eh_ensaio'); end if;
  insert into acolitos_evento_presencas (evento_id, membro_id, status)
    select p_evento, m.id, 'presente' from acolitos_membros m where m.id = any(coalesce(p_presentes,'{}'::uuid[]))
  on conflict (evento_id, membro_id) do update set status='presente';
  update acolitos_evento_presencas ep set status='ausente'
    where ep.evento_id=p_evento and ep.status='presente'
      and not (ep.membro_id = any(coalesce(p_presentes,'{}'::uuid[])));
  select count(*) into n from acolitos_evento_presencas where evento_id=p_evento and status='presente';
  return jsonb_build_object('ok', true, 'presentes', n);
end; $$;


--
-- Name: acolitos_ensaio_convocados(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ensaio_convocados(p_evento uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_conv text[];
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  select convocados into v_conv from acolitos_eventos where id=p_evento;
  if v_conv is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome,'nivel',m.nivel,
            'presente', exists(select 1 from acolitos_evento_presencas ep where ep.evento_id=p_evento and ep.membro_id=m.id and ep.status='presente'))
          order by m.nome)
        from acolitos_membros m where m.status='ativo' and m.nivel = any(v_conv)), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_escalas_futuras(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_escalas_futuras() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(json_agg(c order by c.data, c.horario), '[]'::json)
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
    where cel.data >= (now() at time zone 'America/Sao_Paulo')::date
  ) c;
$$;


--
-- Name: acolitos_escalas_passadas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_escalas_passadas() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: acolitos_estrelas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_estrelas(p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid); v_desde timestamptz; v_xp int; v_lim int:=200;
begin
  select (user_id=v_uid), nivel_desde into v_dono, v_desde from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return jsonb_build_object('erro','sem_permissao'); end if;
  select coalesce(sum(xp_ganho),0) into v_xp from acolitos_missao_progresso
   where membro_id=p_membro and status='concluida' and (v_desde is null or concluida_em >= v_desde);
  return jsonb_build_object('estrelas', floor(v_xp / v_lim), 'xp_nivel', v_xp, 'xp_prox', v_lim - (v_xp % v_lim), 'limiar', v_lim);
end; $$;


--
-- Name: acolitos_estrelas_lote(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_estrelas_lote(p_membros uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_lim int := 200; v_out jsonb;
begin
  if p_membros is null or array_length(p_membros,1) is null then
    return '{}'::jsonb;
  end if;
  select coalesce(jsonb_object_agg(t.membro_id::text, t.estrelas), '{}'::jsonb)
    into v_out
  from (
    select m.id as membro_id,
           floor(coalesce(sum(p.xp_ganho) filter (
             where p.status='concluida'
               and (m.nivel_desde is null or p.concluida_em >= m.nivel_desde)
           ), 0) / v_lim)::int as estrelas
    from acolitos_membros m
    left join acolitos_missao_progresso p on p.membro_id = m.id
    where m.id = any(p_membros)
    group by m.id
  ) t;
  return coalesce(v_out, '{}'::jsonb);
end; $$;


--
-- Name: acolitos_faltas_recentes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_faltas_recentes() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'membro', coalesce(nullif(m.apelido,''), m.nome),
        'funcao', e.funcao,
        'data', cel.data, 'horario', cel.horario, 'comunidade', cel.comunidade,
        'substituto', case when ci.substituto_id is not null then coalesce(nullif(sub.apelido,''), sub.nome) else null end
      ) as x, cel.data as d, cel.horario as h
      from acolitos_chamadas_itens ci
      join acolitos_chamadas ch on ch.id = ci.chamada_id
      join acolitos_escalas e on e.id = ci.escala_id
      join acolitos_celebracoes cel on cel.id = ch.celebracao_id
      join acolitos_membros m on m.id = e.membro_id
      left join acolitos_membros sub on sub.id = ci.substituto_id
      where ci.resultado = 'ausente'
      order by cel.data desc, cel.horario desc
      limit 80
    ) t
  ), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_get_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_get_role(uid uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select pm.role
  from public.pastoral_members pm
  join public.pastoral_modules pmod on pm.module_id = pmod.id
  where pm.user_id = uid and pmod.slug = 'acolitos'
  limit 1;
$$;


--
-- Name: acolitos_hab_decidir(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_hab_decidir(p_pedido uuid, p_decisao text, p_obs text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_m uuid; v_f text; v_lbl text;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  select membro_id, funcao, coalesce(label,funcao) into v_m, v_f, v_lbl from acolitos_hab_pedidos where id=p_pedido and status='em_analise';
  if v_m is null then return jsonb_build_object('erro','pedido_invalido'); end if;
  if p_decisao='aprovar' then
    insert into acolitos_habilitacoes (membro_id, funcao, proficiencia, updated_at)
      values (v_m, v_f, 'apto', now())
    on conflict (membro_id, funcao) do update set proficiencia='apto', updated_at=now();
    update acolitos_hab_pedidos set status='aprovado', decidido_por=auth.uid(), decidido_em=now() where id=p_pedido;
    update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
       'msg','✅ Pedido aprovado: você agora está Apto em '||v_lbl||'!','seen',false,'ts',(extract(epoch from now())*1000)::bigint))
     where id=v_m;
    return jsonb_build_object('ok',true,'acao','aprovado');
  elsif p_decisao='revisar' then
    update acolitos_hab_pedidos set status='revisao', obs_revisao=nullif(trim(p_obs),''), decidido_por=auth.uid(), decidido_em=now() where id=p_pedido;
    update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
       'msg','📝 Revisão sobre "Já faço: '||v_lbl||'": '||coalesce(nullif(trim(p_obs),''),'explique melhor')||' — entre em Quests e reenvie.',
       'seen',false,'ts',(extract(epoch from now())*1000)::bigint))
     where id=v_m;
    return jsonb_build_object('ok',true,'acao','revisao');
  else
    update acolitos_hab_pedidos set status='recusado', decidido_por=auth.uid(), decidido_em=now() where id=p_pedido;
    return jsonb_build_object('ok',true,'acao','recusado');
  end if;
end; $$;


--
-- Name: acolitos_hab_fila(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_hab_fila() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',p.id,'membro_id',p.membro_id,
             'membro',coalesce(nullif(m.apelido,''),m.nome),'funcao',p.funcao,
             'label',coalesce(p.label,p.funcao),'evidencia',p.evidencia) order by p.created_at)
    from acolitos_hab_pedidos p join acolitos_membros m on m.id=p.membro_id
    where p.status='em_analise'), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_hab_pedidos_meus(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_hab_pedidos_meus(p_membro uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(funcao), '[]'::jsonb)
  from acolitos_hab_pedidos where membro_id=p_membro and status='em_analise';
$$;


--
-- Name: acolitos_hab_pedir(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_hab_pedir(p_membro uuid, p_funcao text, p_label text DEFAULT NULL::text, p_evidencia text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_ok boolean; v_prof text;
begin
  select true into v_ok from acolitos_membros
   where id=p_membro and (user_id=v_uid or (grupo_irmaos is not null and grupo_irmaos = acolitos_meu_grupo()));
  if not coalesce(v_ok,false) then return jsonb_build_object('erro','sem_permissao'); end if;
  if coalesce(trim(p_funcao),'')='' then return jsonb_build_object('erro','sem_funcao'); end if;
  if coalesce(trim(p_evidencia),'')='' then return jsonb_build_object('erro','sem_explicacao'); end if;
  select proficiencia into v_prof from acolitos_habilitacoes where membro_id=p_membro and funcao=p_funcao;
  if v_prof='apto' then return jsonb_build_object('erro','ja_apto'); end if;
  delete from acolitos_hab_pedidos where membro_id=p_membro and funcao=p_funcao and status='revisao';
  insert into acolitos_hab_pedidos (membro_id, funcao, label, evidencia)
    values (p_membro, p_funcao, p_label, p_evidencia)
  on conflict (membro_id, funcao) where status='em_analise' do nothing;
  return jsonb_build_object('ok',true);
end; $$;


--
-- Name: acolitos_hab_revisoes_minhas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_hab_revisoes_minhas(p_membro uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_object_agg(funcao, coalesce(obs_revisao,'')), '{}'::jsonb)
  from acolitos_hab_pedidos where membro_id=p_membro and status='revisao';
$$;


--
-- Name: acolitos_habilitados_funcao(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_habilitados_funcao(p_funcao text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_out jsonb;
begin
  v_me := acolitos_meu_membro_id();
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'apelido', m.apelido)
           order by coalesce(m.apelido, m.nome)), '[]'::jsonb) into v_out
  from public.acolitos_membros m
  join public.acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = p_funcao
  where m.status = 'ativo' and m.id is distinct from v_me;
  return jsonb_build_object('membros', v_out);
end; $$;


--
-- Name: acolitos_is_superadmin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select valor from acolitos_config where chave='superadmins'), '["erickmartins","erickmartinsadmin"]'::jsonb)
         ? split_part((select email from auth.users where id = auth.uid()), '@', 1);
$$;


--
-- Name: acolitos_is_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_is_superadmin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from auth.users u,
         jsonb_array_elements_text( coalesce((select valor from public.acolitos_config where chave='superadmins'), '[]'::jsonb) ) as sa(name)
    where u.id = uid
      and split_part(u.email, '@', 1) = sa.name
  );
$$;


--
-- Name: acolitos_limpar_chamada(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_limpar_chamada(p_celebracao uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if acolitos_get_role(auth.uid()) not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    raise exception 'sem permissao';
  end if;
  delete from public.acolitos_chamadas_itens
    where chamada_id in (select id from public.acolitos_chamadas where celebracao_id = p_celebracao);
  delete from public.acolitos_chamadas where celebracao_id = p_celebracao;
  update public.acolitos_escalas set status='escalado', substituto_id=null where celebracao_id = p_celebracao;
end; $$;


--
-- Name: acolitos_link_irmaos(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_link_irmaos(p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int := coalesce(array_length(p_ids,1),0);
begin
  if n < 2 then return; end if;
  if not exists (
    select 1 from public.acolitos_membros where id = any(p_ids) and user_id = auth.uid()
  ) then
    return;
  end if;
  for i in 1..n loop
    update public.acolitos_membros
      set tem_irmao_pastoral = true, escalar_com_irmao = true,
          irmao_id = p_ids[ case when i = 1 then 2 else 1 end ]
      where id = p_ids[i] and (user_id = auth.uid() or user_id is null);
  end loop;
end $$;


--
-- Name: acolitos_login_registrar(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;
  insert into acolitos_logins (membro_id, usuario, updated_at) values (p_membro, p_usuario, now())
  on conflict (membro_id) do update set
    usuario = coalesce(p_usuario, acolitos_logins.usuario),
    updated_at = now();
  return jsonb_build_object('ok', true);
end; $$;


--
-- Name: acolitos_logins_listar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_logins_listar() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not acolitos_is_superadmin() then return jsonb_build_object('erro','sem_permissao'); end if;
  return jsonb_build_object('membros', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'nome', m.nome, 'nivel', m.nivel, 'user_id', m.user_id,
      'tem_conta', (m.user_id is not null),
      'usuario', coalesce(l.usuario, split_part(u.email,'@',1))) order by m.nome)
    from acolitos_membros m
    left join acolitos_logins l on l.membro_id = m.id
    left join auth.users u on u.id = m.user_id
    where m.status='ativo'
  ), '[]'::jsonb));
end; $$;


--
-- Name: acolitos_medalhas_avaliar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_medalhas_avaliar(p_membro uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid); m record; v_n int:=0;
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then return 0; end if;
  for m in (
    select mi.id, mi.xp, mi.badge_label, mi.criterio
    from acolitos_missoes mi
    where mi.ativo and mi.concede_badge and mi.validacao='automatica' and mi.nivel_alvo is null
      and mi.criterio is not null and mi.criterio->>'fonte' <> 'habilitacao'
      and not exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
  ) loop
    if acolitos_badge_cumpre(p_membro, m.criterio) then
      insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, concluida_em)
        values (m.id, p_membro, 'concluida', 0, now())
      on conflict (missao_id, membro_id) do update set status='concluida', concluida_em=now();
      update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'tipo','medalha','label',m.badge_label,'seen',false,'ts',(extract(epoch from now())*1000 + v_n)::bigint)) where id=p_membro;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end; $$;


--
-- Name: acolitos_membro_card(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_membro_card(p_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'id', m.id,
    'nome', coalesce(nullif(m.apelido,''), m.nome),
    'nome_completo', m.nome,
    'foto_url', m.foto_url,
    'nivel', m.nivel,
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


--
-- Name: acolitos_membros_display(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_membros_display(p_ids uuid[]) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_object_agg(m.id::text, jsonb_build_object(
           'id', m.id, 'nome', m.nome, 'apelido', m.apelido,
           'foto_url', m.foto_url, 'nivel', m.nivel)), '{}'::jsonb)
  from acolitos_membros m
  where m.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;


--
-- Name: acolitos_membros_por_setor(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_membros_por_setor(p_setores text[]) RETURNS TABLE(id uuid, nome text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- security definer porque membro comum não lê acolitos_membros direto (a RLS barra), e
  -- esta função devolve só id e nome — o mesmo que acolitos_roster_nomes já devolve a todos.
  select m.id, m.nome
  from public.acolitos_membros m
  where m.status = 'ativo'
    and p_setores is not null
    and array_length(p_setores, 1) > 0
    and m.setores && p_setores
  order by m.nome;
$$;


--
-- Name: acolitos_meu_grupo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_meu_grupo() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select grupo_irmaos from public.acolitos_membros where user_id = auth.uid() limit 1;
$$;


--
-- Name: acolitos_meu_membro_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_meu_membro_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.acolitos_membros where user_id = auth.uid() and status = 'ativo' limit 1;
$$;


--
-- Name: acolitos_missao_decidir(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_xp int; v_tit text; v_env uuid[]; e uuid; v_part int; v_temp uuid;
        v_desde timestamptz; v_from int; v_badge boolean; v_blabel text; v_ja boolean;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  if p_decisao='recusar' then
    delete from acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro and status='em_analise';
    return jsonb_build_object('ok',true,'acao','recusada');
  end if;
  if p_decisao='revisar' then
    insert into acolitos_missao_progresso (missao_id, membro_id, status, obs_revisao)
      values (p_missao, p_membro, 'revisao', nullif(trim(p_obs),''))
    on conflict (missao_id, membro_id) do update set status='revisao', obs_revisao=nullif(trim(p_obs),'')
      where acolitos_missao_progresso.status <> 'concluida';
    select titulo into v_tit from acolitos_missoes where id=p_missao;
    update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
       'msg','📝 Revisão da coordenação sobre "'||coalesce(v_tit,'sua missão')||'": '||coalesce(nullif(trim(p_obs),''),'revise e reenvie sua resposta')||' — entre em Quests e responda de novo.',
       'seen',false,'ts',(extract(epoch from now())*1000)::bigint))
     where id=p_membro;
    return jsonb_build_object('ok',true,'acao','revisao');
  end if;
  select xp, titulo, coalesce(concede_badge,false), badge_label into v_xp, v_tit, v_badge, v_blabel
    from acolitos_missoes where id=p_missao and ativo;
  if v_xp is null then return jsonb_build_object('erro','missao_invalida'); end if;
  select id into v_temp from acolitos_temporadas where ativa limit 1;
  select (status='concluida') into v_ja from acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro;
  select envolvidos into v_env from acolitos_missao_progresso where missao_id=p_missao and membro_id=p_membro;
  insert into acolitos_missao_progresso (missao_id, membro_id, status, xp_ganho, temporada_id, aprovado_por, concluida_em)
    values (p_missao, p_membro, 'concluida', v_xp, v_temp, auth.uid(), now())
  on conflict (missao_id, membro_id) do update set status='concluida', xp_ganho=v_xp, temporada_id=v_temp, aprovado_por=auth.uid(), concluida_em=now();
  perform acolitos_cred_temp(p_membro, v_xp, 'missao');
  select nivel_desde into v_desde from acolitos_membros where id=p_membro;
  select coalesce(sum(xp_ganho),0) into v_from from acolitos_missao_progresso
    where membro_id=p_membro and status='concluida' and missao_id <> p_missao
      and (v_desde is null or concluida_em >= v_desde);
  update acolitos_membros
     set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
       'tipo','xp_ganho','gain',v_xp,'titulo',v_tit,'from_xp',v_from,
       'seen',false,'ts',(extract(epoch from now())*1000)::bigint))
   where id = p_membro;
  if v_badge and coalesce(v_ja,false)=false then
    update acolitos_membros
       set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
         'tipo','medalha','label',coalesce(v_blabel,v_tit),'seen',false,'ts',(extract(epoch from now())*1000+1)::bigint))
     where id = p_membro;
  end if;
  v_part := greatest(5, (v_xp/2));
  if v_env is not null then
    foreach e in array v_env loop
      if e <> p_membro then
        update acolitos_membros
           set xp_avulso = coalesce(xp_avulso,0) + v_part,
               avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                 'msg', '🎉 Você ganhou '||v_part||' XP por participar de "'||v_tit||'"!', 'seen', false, 'ts', (extract(epoch from now())*1000)::bigint))
         where id = e;
        perform acolitos_cred_temp(e, v_part, 'participacao');
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok',true,'acao','concluida','xp',v_xp);
end; $$;


--
-- Name: acolitos_missao_reivindicar(uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_membro uuid; v_val text;
begin
  select id into v_membro from acolitos_membros where user_id=v_uid;
  if v_membro is null then return jsonb_build_object('erro','sem_membro'); end if;
  if coalesce(btrim(p_evidencia),'')='' then return jsonb_build_object('erro','evidencia_obrigatoria'); end if;
  select validacao into v_val from acolitos_missoes where id=p_missao and ativo;
  if v_val is null then return jsonb_build_object('erro','missao_invalida'); end if;
  if v_val not in ('reivindicada','automatica','avaliada') then return jsonb_build_object('erro','nao_reivindicavel'); end if;
  insert into acolitos_missao_progresso (missao_id, membro_id, status, evidencia, envolvidos)
    values (p_missao, v_membro, 'em_analise', p_evidencia, p_envolvidos)
  on conflict (missao_id, membro_id) do update set status='em_analise', evidencia=excluded.evidencia, envolvidos=excluded.envolvidos
    where acolitos_missao_progresso.status <> 'concluida';
  return jsonb_build_object('ok', true);
end; $$;


--
-- Name: acolitos_missao_semana(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_missao_semana(p_membro uuid, p_niveis text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid);
  v_week text; v_wint int; v_mid uuid; v_tema text; v_cnt int; v_off int; v_m record; v_st text;
begin
  select (user_id=v_uid) into v_dono from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return jsonb_build_object('erro','sem_permissao'); end if;
  v_week := to_char(now() at time zone 'America/Sao_Paulo','IYYY-"W"IW');
  v_wint := (extract(isoyear from now() at time zone 'America/Sao_Paulo')*100 + extract(week from now() at time zone 'America/Sao_Paulo'))::int;
  select missao_id, tema into v_mid, v_tema from acolitos_semana_override where semana=v_week;
  if v_mid is null then
    select count(*) into v_cnt from acolitos_missoes mi
      where mi.ativo and mi.capitulo is null and mi.nivel_alvo is null and coalesce(mi.concede_badge,false)=false
        and mi.validacao='reivindicada' and (mi.aplica_de='aspirante' or mi.aplica_de is null);
    if coalesce(v_cnt,0) > 0 then
      v_off := v_wint % v_cnt;
      select mi.id into v_mid from acolitos_missoes mi
        where mi.ativo and mi.capitulo is null and mi.nivel_alvo is null and coalesce(mi.concede_badge,false)=false
          and mi.validacao='reivindicada' and (mi.aplica_de='aspirante' or mi.aplica_de is null)
        order by md5(mi.id::text) offset v_off limit 1;
    end if;
  end if;
  if v_mid is null then return jsonb_build_object('missao', null, 'semana', v_week); end if;
  select * into v_m from acolitos_missoes where id=v_mid;
  select coalesce((select status from acolitos_missao_progresso where missao_id=v_mid and membro_id=p_membro), 'pendente') into v_st;
  return jsonb_build_object('semana', v_week, 'tema', v_tema,
    'missao', jsonb_build_object('id',v_m.id,'titulo',v_m.titulo,'descricao',v_m.descricao,'validacao',v_m.validacao,'xp',v_m.xp,'seriedade',v_m.seriedade,'status',v_st));
end; $$;


--
-- Name: acolitos_missoes_board(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_missoes_board(p_membro uuid, p_niveis text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_role text := acolitos_get_role(v_uid);
  v_dono boolean;
  v_nivel text; v_idx int; v_prox text;
  v_xp int; v_avulso int;
  v_cap_arr jsonb := '[]'::jsonb;
  v_missoes jsonb;
  v_completo boolean; v_chain_ok boolean := true; v_elegivel boolean := false; v_has_cap boolean := false;
  v_bonus jsonb; v_pend jsonb;
  rec record;
begin
  select (m.user_id = v_uid), coalesce(m.xp_avulso,0) into v_dono, v_avulso from acolitos_membros m where m.id = p_membro;
  if coalesce(v_dono,false) = false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select nivel into v_nivel from acolitos_membros where id = p_membro;
  v_idx := array_position(p_niveis, v_nivel);
  v_prox := case when v_idx is not null and v_idx < array_length(p_niveis,1) then p_niveis[v_idx+1] else null end;
  select coalesce(sum(xp_ganho),0) + coalesce(v_avulso,0) into v_xp
    from acolitos_missao_progresso where membro_id = p_membro and status = 'concluida';
  select coalesce(jsonb_agg(jsonb_build_object('funcao', d.funcao, 'label', coalesce(lbl.label, d.funcao)) order by coalesce(lbl.ord,99)), '[]'::jsonb)
    into v_pend
  from (
    select distinct fn.funcao from acolitos_missoes mi
    cross join lateral jsonb_array_elements_text(mi.criterio->'funcoes') as fn(funcao)
    where mi.ativo and mi.obrigatoria and mi.nivel_alvo is not null
      and mi.criterio->>'fonte'='habilitacao' and mi.criterio->>'proficiencia'='apto'
      and array_position(p_niveis, mi.nivel_alvo) <= v_idx
  ) d
  left join (values ('apoio','Apoio',1),('cruz','Cruz',2),('vela','Vela',3),('sineta','Sineta',4),('sinao','Sinão',5),
    ('altar','Altar',6),('turibulo','Turíbulo',7),('naveta','Naveta',8),('missal','Missal',9),
    ('cred_altar','Cerimoniário de Altar',10),('cred_credencia','Cerimoniário de Credência',11),
    ('mitra','Mitra',12),('baculo','Báculo',13)) lbl(funcao,label,ord) on lbl.funcao=d.funcao
  left join acolitos_habilitacoes h on h.membro_id=p_membro and h.funcao=d.funcao
  where coalesce(h.proficiencia,'nao_treinado') not in ('apto','experiente','referencia');

  if v_prox is not null then
    v_elegivel := true;
    for rec in (select capitulo from acolitos_missoes where ativo and nivel_alvo = v_prox and capitulo is not null group by capitulo order by capitulo) loop
      v_has_cap := true;
      select jsonb_agg(t.j order by t.ob desc, t.ord) into v_missoes
      from (
        select jsonb_build_object(
                 'id', mi.id, 'titulo', mi.titulo, 'descricao', mi.descricao, 'validacao', mi.validacao,
                 'xp', mi.xp, 'obrigatoria', mi.obrigatoria, 'seriedade', mi.seriedade,
                 'competencia', (select l.label from acolitos_listas l where l.tipo='competencia' and l.valor = mi.criterio->>'competencia'),
                 'fonte', mi.criterio->>'fonte',
                 'atual', acolitos_progresso_criterio(p_membro, mi.criterio),
                 'alvo', (mi.criterio->>'quantidade')::int,
                 'status', eff.status) as j,
               mi.obrigatoria as ob, mi.ordem as ord
        from acolitos_missoes mi
        left join acolitos_missao_progresso pr on pr.missao_id = mi.id and pr.membro_id = p_membro
        cross join lateral (select case when coalesce(mi.criterio->>'fonte','')='habilitacao'
                                        then (case when acolitos_prof_ok(p_membro, mi.criterio->'funcoes', mi.criterio->>'proficiencia') then 'concluida' else coalesce(pr.status,'pendente') end)
                                        else coalesce(pr.status,'pendente') end as status) eff
        where mi.ativo and mi.nivel_alvo = v_prox and mi.capitulo = rec.capitulo
          and (
            eff.status <> 'pendente' or mi.criterio->>'fonte' is not null
            or (select count(*) from acolitos_missoes m2 left join acolitos_missao_progresso p2 on p2.missao_id=m2.id and p2.membro_id=p_membro
                where m2.ativo and m2.nivel_alvo=v_prox and m2.capitulo=rec.capitulo and m2.criterio->>'fonte' is null
                  and coalesce(p2.status,'pendente')='pendente' and m2.ordem < mi.ordem) < 2
          )
      ) t;
      v_completo := not exists (
        select 1 from acolitos_missoes mi where mi.ativo and mi.nivel_alvo = v_prox and mi.capitulo = rec.capitulo and mi.obrigatoria
           and not ((coalesce(mi.criterio->>'fonte','')='habilitacao' and acolitos_prof_ok(p_membro, mi.criterio->'funcoes', mi.criterio->>'proficiencia'))
             or exists (select 1 from acolitos_missao_progresso pr where pr.missao_id = mi.id and pr.membro_id = p_membro and pr.status='concluida')));
      v_cap_arr := v_cap_arr || jsonb_build_object('capitulo', rec.capitulo, 'desbloqueado', v_chain_ok, 'completo', v_completo, 'missoes', coalesce(v_missoes,'[]'::jsonb));
      if not v_completo then v_chain_ok := false; v_elegivel := false; end if;
    end loop;
    if not v_has_cap then v_elegivel := false; end if;
    if jsonb_array_length(v_pend) > 0 then v_elegivel := false; end if;
  end if;

  select coalesce(jsonb_agg(j order by em_analise desc, ord), '[]'::jsonb) into v_bonus
  from (
    select jsonb_build_object('id', mi.id, 'titulo', mi.titulo, 'descricao', mi.descricao,
             'validacao', mi.validacao, 'xp', mi.xp, 'seriedade', mi.seriedade,
             'competencia', (select l.label from acolitos_listas l where l.tipo='competencia' and l.valor = mi.criterio->>'competencia'),
             'status', coalesce(pr.status,'pendente')) as j,
           (coalesce(pr.status,'') = 'em_analise') as em_analise, mi.ordem as ord
    from acolitos_missoes mi left join acolitos_missao_progresso pr on pr.missao_id = mi.id and pr.membro_id = p_membro
    where mi.ativo and mi.capitulo is null and mi.nivel_alvo is null and coalesce(pr.status,'pendente') <> 'concluida'
      and (mi.aplica_de is null or array_position(p_niveis, mi.aplica_de) <= v_idx)
      and (mi.aplica_ate is null or array_position(p_niveis, mi.aplica_ate) >= v_idx)
    order by em_analise desc, mi.ordem limit 5
  ) t;

  return jsonb_build_object('nivel', v_nivel, 'proximo_nivel', v_prox, 'xp_total', v_xp,
    'capitulos', v_cap_arr, 'bonus', v_bonus, 'pendencias', coalesce(v_pend,'[]'::jsonb), 'elegivel', coalesce(v_elegivel,false));
end; $$;


--
-- Name: acolitos_missoes_fila(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_missoes_fila() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'missao_id', mi.id, 'titulo', mi.titulo, 'xp', mi.xp,
      'membro_id', m.id, 'membro', m.nome, 'evidencia', pr.evidencia,
      'envolvidos', (select string_agg(m2.nome, ', ') from acolitos_membros m2 where pr.envolvidos is not null and m2.id = any(pr.envolvidos)),
      'quando', pr.created_at
    ) order by pr.created_at)
    from acolitos_missao_progresso pr
    join acolitos_missoes mi on mi.id = pr.missao_id
    join acolitos_membros m on m.id = pr.membro_id
    where pr.status='em_analise'), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_prof_ok(uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_prof_ok(p_membro uuid, p_funcoes jsonb, p_prof text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(bool_and(
    array_position(array['nao_treinado','em_formacao','apto','experiente','referencia'], coalesce(h.proficiencia,'nao_treinado'))
    >= array_position(array['nao_treinado','em_formacao','apto','experiente','referencia'], p_prof)
  ), true)
  from jsonb_array_elements_text(coalesce(p_funcoes,'[]'::jsonb)) as fn(funcao)
  left join acolitos_habilitacoes h on h.membro_id = p_membro and h.funcao = fn.funcao;
$$;


--
-- Name: acolitos_progresso_criterio(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_progresso_criterio(p_membro uuid, c jsonb) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_desde timestamptz; cnt int;
begin
  if c is null or c->>'quantidade' is null then return null; end if;
  select nivel_desde into v_desde from acolitos_membros where id=p_membro;
  if c->>'fonte'='missas_servidas' then
    select count(*) into cnt from acolitos_chamadas_itens ci
      join acolitos_escalas e on e.id=ci.escala_id
      join acolitos_celebracoes ce on ce.id=e.celebracao_id
     where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro and (v_desde is null or ce.data >= v_desde::date)
       and (c->'funcoes' is null or e.funcao in (select jsonb_array_elements_text(c->'funcoes')));
    return cnt;
  elsif c->>'fonte'='ensaio' then
    select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
      join acolitos_eventos ev on ev.id=ep.evento_id
     where ep.membro_id=p_membro and ep.status='presente' and ev.tipo='ensaio' and (v_desde is null or ev.data >= v_desde::date);
    return cnt;
  elsif c->>'fonte'='ensaios_ajudados' then
    select count(distinct ep.evento_id) into cnt from acolitos_evento_presencas ep
      join acolitos_eventos ev on ev.id=ep.evento_id
     where ep.membro_id=p_membro and ep.status='ajudou' and ev.tipo='ensaio' and (v_desde is null or ev.data >= v_desde::date);
    return cnt;
  elsif c->>'fonte'='funcoes_distintas' then
    select count(distinct e.funcao) into cnt from acolitos_chamadas_itens ci
      join acolitos_escalas e on e.id=ci.escala_id
      join acolitos_celebracoes ce on ce.id=e.celebracao_id
     where ci.resultado in ('presente','atrasado') and e.membro_id=p_membro and (v_desde is null or ce.data >= v_desde::date);
    return cnt;
  end if;
  return null;
end; $$;


--
-- Name: acolitos_promocoes_pendentes(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_promocoes_pendentes(p_niveis text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('membro_id', x.id, 'membro', x.nome, 'nivel', x.nivel, 'proximo', x.prox) order by x.nome)
    from (
      select m.id, m.nome, m.nivel, p_niveis[array_position(p_niveis,m.nivel)+1] as prox
      from acolitos_membros m
      where m.status='ativo' and array_position(p_niveis,m.nivel) is not null
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
end; $$;


--
-- Name: acolitos_promover(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_promover(p_membro uuid, p_novo_nivel text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    return jsonb_build_object('erro','sem_permissao'); end if;
  if exists (select 1 from acolitos_missoes mi
             where mi.ativo and mi.capitulo is not null and mi.obrigatoria and mi.nivel_alvo=p_novo_nivel
               and not exists (select 1 from acolitos_missao_progresso pr
                                where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')) then
    return jsonb_build_object('erro','nao_elegivel'); end if;
  update acolitos_membros set nivel = p_novo_nivel, nivel_desde = now() where id = p_membro;
  return jsonb_build_object('ok', true, 'nivel', p_novo_nivel);
end; $$;


--
-- Name: acolitos_quase_la(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_quase_la(p_niveis text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      where m.status='ativo' and array_position(p_niveis,m.nivel) is not null
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
end; $$;


--
-- Name: acolitos_quest_criar(text, text, integer, text, text[], date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_quest_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_niveis text[], p_expira date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_id uuid; v_n int; v_niv text[]; v_val text;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  if coalesce(trim(p_titulo),'')='' then return jsonb_build_object('erro','sem_titulo'); end if;
  v_niv := case when p_niveis is null or array_length(p_niveis,1) is null then null else p_niveis end;
  v_val := case when p_validacao in ('reivindicada','avaliada','automatica') then p_validacao else 'reivindicada' end;
  insert into acolitos_missoes (titulo, descricao, tipo, validacao, xp, exclusiva, niveis_alvo, aplica_de, obrigatoria, ativo, seriedade, ordem, expira_em)
    values (p_titulo, p_descricao, 'bonus', v_val, coalesce(p_xp,100), true, v_niv, '__exclusiva__', false, true, 'surpresa', 10, p_expira)
    returning id into v_id;
  update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'msg','✨ Quest Exclusiva: '||p_titulo||'!','tipo','quest_exclusiva','titulo',p_titulo,'seen',false,'ts',(extract(epoch from now())*1000)::bigint))
    where status='ativo' and user_id is not null and (v_niv is null or nivel = any(v_niv));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok',true,'id',v_id,'notificados',v_n);
end; $$;


--
-- Name: acolitos_quests_exclusivas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_quests_exclusivas(p_membro uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_dono boolean; v_role text:=acolitos_get_role(v_uid); v_nivel text;
begin
  select (user_id=v_uid), nivel into v_dono, v_nivel from acolitos_membros where id=p_membro;
  if coalesce(v_dono,false)=false and (v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe')) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',mi.id,'titulo',mi.titulo,'descricao',mi.descricao,'validacao',mi.validacao,'xp',mi.xp,'seriedade',mi.seriedade,
             'status', coalesce((select status from acolitos_missao_progresso where missao_id=mi.id and membro_id=p_membro),'pendente')) order by mi.created_at desc)
    from acolitos_missoes mi
    where mi.ativo and mi.exclusiva and (mi.niveis_alvo is null or v_nivel = any(mi.niveis_alvo))
      and (mi.expira_em is null or mi.expira_em >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from acolitos_missao_progresso pr where pr.missao_id=mi.id and pr.membro_id=p_membro and pr.status='concluida')
  ), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_ranking_temporada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_ranking_temporada() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_nome text; v_ini date; v_fim date; v_res jsonb;
begin
  select id, nome, inicio, fim into v_id, v_nome, v_ini, v_fim from acolitos_temporadas where ativa order by created_at desc limit 1;
  if v_id is null then return jsonb_build_object('temporada', null, 'ligas', '[]'::jsonb, 'eu_id', (select id from acolitos_membros where user_id=v_uid)); end if;
  with xp as (select membro_id, sum(xp) xp from acolitos_xp_temporada where temporada_id=v_id group by membro_id),
  base as (
    select m.id, coalesce(nullif(m.apelido,''), m.nome) as nome, m.nivel, m.foto_url, coalesce(x.xp,0) xp,
      case when m.nivel in ('aspirante','coroinha','acolito_aspirante') then 'iniciantes'
           when m.nivel in ('acolito_guardiao','acolito_sentinela') then 'acolitos' else 'cerimoniarios' end liga
    from acolitos_membros m left join xp x on x.membro_id=m.id where m.status='ativo')
  select jsonb_agg(jsonb_build_object('liga',liga,'membros',membros) order by ord) into v_res from (
    select liga, case liga when 'iniciantes' then 1 when 'acolitos' then 2 else 3 end ord,
      jsonb_agg(jsonb_build_object('id',id,'nome',nome,'nivel',nivel,'foto_url',foto_url,'xp',xp) order by xp desc, nome) membros
    from base where xp > 0 group by liga
  ) g;
  return jsonb_build_object('temporada', jsonb_build_object('nome',v_nome,'inicio',v_ini,'fim',v_fim),
                            'ligas', coalesce(v_res,'[]'::jsonb), 'eu_id', (select id from acolitos_membros where user_id=v_uid));
end; $$;


--
-- Name: acolitos_responsaveis_de_tarefa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_responsaveis_de_tarefa() RETURNS TABLE(id uuid, nome text, apelido text, setores text[])
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id, m.nome, m.apelido, m.setores
  from public.acolitos_membros m
  where m.status = 'ativo'
    and m.setores is not null
    and array_length(m.setores, 1) > 0
  order by coalesce(m.apelido, m.nome);
$$;


--
-- Name: acolitos_revisoes_minhas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_revisoes_minhas(p_membro uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_object_agg(missao_id::text, coalesce(obs_revisao,'')), '{}'::jsonb)
  from acolitos_missao_progresso where membro_id=p_membro and status='revisao';
$$;


--
-- Name: acolitos_roster_nomes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_roster_nomes() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome),'[]'::jsonb)
  from public.acolitos_membros where status='ativo';
$$;


--
-- Name: acolitos_roster_substituicao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_roster_substituicao() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: acolitos_semana_agenda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_agenda() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_cur text:=_acolitos_semana_str(0);
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('semana',o.semana,'segunda',to_date(o.semana,'IYYY-"W"IW'),
             'titulo',mi.titulo,'tema',o.tema,'atual',(o.semana=v_cur)) order by o.semana)
    from acolitos_semana_override o join acolitos_missoes mi on mi.id=o.missao_id
    where o.semana >= v_cur), '[]'::jsonb);
end; $$;


--
-- Name: acolitos_semana_atual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_atual() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_week text; v_mid uuid; v_tema text; v_tit text; v_cnt int; v_off int; v_wint int;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  v_week := to_char(now() at time zone 'America/Sao_Paulo','IYYY-"W"IW');
  select missao_id, tema into v_mid, v_tema from acolitos_semana_override where semana=v_week;
  if v_mid is not null then
    select titulo into v_tit from acolitos_missoes where id=v_mid;
    return jsonb_build_object('modo','fixa','titulo',v_tit,'tema',v_tema,'semana',v_week);
  end if;
  v_wint := (extract(isoyear from now() at time zone 'America/Sao_Paulo')*100 + extract(week from now() at time zone 'America/Sao_Paulo'))::int;
  select count(*) into v_cnt from acolitos_missoes mi where mi.ativo and mi.capitulo is null and mi.nivel_alvo is null and coalesce(mi.concede_badge,false)=false and mi.validacao='reivindicada' and (mi.aplica_de='aspirante' or mi.aplica_de is null);
  if coalesce(v_cnt,0) > 0 then
    v_off := v_wint % v_cnt;
    select titulo into v_tit from acolitos_missoes mi where mi.ativo and mi.capitulo is null and mi.nivel_alvo is null and coalesce(mi.concede_badge,false)=false and mi.validacao='reivindicada' and (mi.aplica_de='aspirante' or mi.aplica_de is null) order by md5(mi.id::text) offset v_off limit 1;
  end if;
  return jsonb_build_object('modo','auto','titulo',v_tit,'semana',v_week);
end; $$;


--
-- Name: acolitos_semana_criar(text, text, integer, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_tema text DEFAULT NULL::text, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_id uuid; v_week text;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  if coalesce(trim(p_titulo),'')='' then return jsonb_build_object('erro','sem_titulo'); end if;
  insert into acolitos_missoes (titulo, descricao, tipo, validacao, xp, capitulo, nivel_alvo, aplica_de, obrigatoria, ativo, seriedade, ordem)
    values (p_titulo, p_descricao, 'bonus', 'reivindicada', coalesce(p_xp,15), null, null, '__semana__', false, true, 'surpresa', 190)
    returning id into v_id;
  v_week := _acolitos_semana_str(p_offset);
  insert into acolitos_semana_override (semana, missao_id, tema) values (v_week, v_id, nullif(trim(p_tema),''))
  on conflict (semana) do update set missao_id=excluded.missao_id, tema=excluded.tema, created_at=now();
  return jsonb_build_object('ok',true,'id',v_id,'semana',v_week);
end; $$;


--
-- Name: acolitos_semana_definir(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_definir(p_missao uuid, p_tema text DEFAULT NULL::text, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_week text:=_acolitos_semana_str(p_offset);
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  insert into acolitos_semana_override (semana, missao_id, tema) values (v_week, p_missao, nullif(trim(p_tema),''))
    on conflict (semana) do update set missao_id=excluded.missao_id, tema=excluded.tema, created_at=now();
  return jsonb_build_object('ok',true,'semana',v_week);
end; $$;


--
-- Name: acolitos_semana_limpar(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_limpar(p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  delete from acolitos_semana_override where semana=_acolitos_semana_str(p_offset);
  return jsonb_build_object('ok',true);
end; $$;


--
-- Name: acolitos_semana_remover(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_semana_remover(p_semana text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  delete from acolitos_semana_override where semana=p_semana;
  return jsonb_build_object('ok',true);
end; $$;


--
-- Name: acolitos_set_admin_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_set_admin_role(p_user uuid, p_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare mid uuid;
begin
  if not acolitos_is_superadmin(auth.uid()) then raise exception 'apenas superadmin'; end if;
  if p_role not in ('coord_admin','subadmin','membro_equipe') then raise exception 'papel invalido'; end if;
  select id into mid from public.pastoral_modules where slug='acolitos' limit 1;
  update public.pastoral_members set role = p_role where user_id = p_user and module_id = mid;
end; $$;


--
-- Name: acolitos_solicitacao_cancelar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid;
begin
  v_me := acolitos_meu_membro_id();
  update public.acolitos_solicitacoes
    set status = 'cancelado', atualizado_em = now()
    where id = p_solicitacao_id and membro_id = v_me
      and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega');
  if not found then return jsonb_build_object('erro','nao_pendente'); end if;
  return jsonb_build_object('ok', true);
end; $$;


--
-- Name: acolitos_solicitacao_decidir(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text; s public.acolitos_solicitacoes%rowtype; v_troca jsonb; v_novo_esc uuid; v_final text;
        v_tipo text; v_com text; v_cap int; v_ocup int;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select * into s from public.acolitos_solicitacoes where id = p_solicitacao_id;
  if s.id is null then return jsonb_build_object('erro','nao_encontrada'); end if;

  if p_acao = 'negar' then
    -- guarda contra dupla-decisão (concorrência de coords): só nega o que ainda está pendente,
    -- senão re-negaria um pedido já homologado/coberto e deixaria a escala mutada + resultado órfão.
    update public.acolitos_solicitacoes set status='negado', decidido_por=auth.uid(), atualizado_em=now()
      where id = s.id
        and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega');
    if not found then return jsonb_build_object('erro','nao_pendente'); end if;
    return jsonb_build_object('ok',true,'status','negado');

  elsif p_acao = 'homologar' and s.tipo='troca' and s.status='aguardando_coordenacao' then
    -- membro sai, colega (alvo) entra
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, s.alvo_membro_id);
    -- se o membro já não estava escalado (ex.: ausência aprovada rodou auto-troca antes), não marca sucesso falso
    if (v_troca->>'nao_escalado')::boolean then return jsonb_build_object('erro','ja_nao_escalado'); end if;
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='homologado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','homologado');

  elsif p_acao = 'confirmar_cobertura' and s.tipo='troca' and s.status='aguardando_cobertura' then
    -- membro sai, substituto escolhido pela coordenação entra (p_substituto_id pode ser null = vaga vazia)
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, p_substituto_id);
    if (v_troca->>'nao_escalado')::boolean then return jsonb_build_object('erro','ja_nao_escalado'); end if;
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='coberto', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','coberto');

  elsif p_acao = 'aprovar_candidatura' and s.tipo='candidatura' and s.status='aguardando_coordenacao' then
    -- Serializa por celebração+função: sem isto, dois coordenadores aprovando no mesmo segundo
    -- passam os dois pela contagem antes de qualquer um inserir. É exatamente quando há fila
    -- que este buraco morde.
    perform pg_advisory_xact_lock(hashtextextended(s.celebracao_id::text || '|' || s.funcao, 0));

    -- A pessoa não pode entrar duas vezes na mesma missa. A candidatura já confere isto na hora
    -- de PEDIR, mas entre pedir e aprovar pode passar um dia — e o gerador de escala pode ter
    -- escalado a pessoa nesse meio tempo, em outra função.
    if exists (select 1 from public.acolitos_escalas
               where celebracao_id = s.celebracao_id and membro_id = s.membro_id
                 and status = 'escalado') then
      return jsonb_build_object('erro','ja_escalado');
    end if;

    -- A vaga tem de estar aberta AGORA. A regra espelha a da tela (escala.html modeloFor):
    -- tipo+comunidade, caindo para missa_comum da comunidade e depois missa_comum|matriz.
    -- Se o servidor usasse outra regra que a tela, recusaria vaga que a tela mostra aberta.
    select c.tipo, c.comunidade into v_tipo, v_com
      from public.acolitos_celebracoes c where c.id = s.celebracao_id;
    select mo.quantidade into v_cap from public.acolitos_modelos mo
      where mo.funcao = s.funcao
        and (mo.tipo, mo.comunidade) in ((v_tipo, v_com), ('missa_comum', v_com), ('missa_comum', 'matriz'))
      order by case when mo.tipo = v_tipo and mo.comunidade = v_com then 0
                    when mo.tipo = 'missa_comum' and mo.comunidade = v_com then 1
                    else 2 end
      limit 1;
    -- Sem modelo nenhum para a função, não se inventa limite: mantém o comportamento de antes.
    if v_cap is not null then
      select count(*) into v_ocup from public.acolitos_escalas
        where celebracao_id = s.celebracao_id and funcao = s.funcao and status = 'escalado';
      if v_ocup >= v_cap then
        return jsonb_build_object('erro','vaga_cheia','ocupadas',v_ocup,'vagas',v_cap);
      end if;
    end if;

    insert into public.acolitos_escalas(celebracao_id, membro_id, funcao, status, created_by)
    values (s.celebracao_id, s.membro_id, s.funcao, 'escalado', auth.uid())
    returning id into v_novo_esc;
    update public.acolitos_solicitacoes set status='aprovado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','aprovado');
  end if;

  return jsonb_build_object('erro','acao_invalida','tipo',s.tipo,'status',s.status);
end; $$;


--
-- Name: acolitos_solicitacao_reenviar(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_status text;
begin
  v_me := acolitos_meu_membro_id();
  v_status := case when p_novo_alvo is null then 'aguardando_cobertura' else 'aguardando_colega' end;
  update public.acolitos_solicitacoes
    set alvo_membro_id = p_novo_alvo, status = v_status, atualizado_em = now()
    where id = p_solicitacao_id and membro_id = v_me and tipo = 'troca'
      and status = 'recusado_colega';
  if not found then return jsonb_build_object('erro','nao_recusado'); end if;
  return jsonb_build_object('ok', true, 'status', v_status);
end; $$;


--
-- Name: acolitos_solicitacoes_membro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitacoes_membro() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_meus jsonb; v_conv jsonb;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('meus','[]'::jsonb,'convites','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'tipo', s.tipo, 'status', s.status, 'funcao', s.funcao,
           'motivo', s.motivo, 'alvo_nome', ma.nome,
           'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade
         ) order by s.criado_em desc), '[]'::jsonb) into v_meus
  from public.acolitos_solicitacoes s
  join public.acolitos_celebracoes c on c.id = s.celebracao_id
  left join public.acolitos_membros ma on ma.id = s.alvo_membro_id
  where s.membro_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'status', s.status, 'funcao', s.funcao,
           'de_nome', mp.nome, 'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade
         ) order by s.criado_em desc), '[]'::jsonb) into v_conv
  from public.acolitos_solicitacoes s
  join public.acolitos_celebracoes c on c.id = s.celebracao_id
  join public.acolitos_membros mp on mp.id = s.membro_id
  where s.alvo_membro_id = v_me and s.status = 'aguardando_colega';
  return jsonb_build_object('meus', v_meus, 'convites', v_conv);
end; $$;


--
-- Name: acolitos_solicitacoes_pendentes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitacoes_pendentes() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text; v_trocas jsonb; v_cand jsonb; v_cobrir jsonb;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('trocas','[]'::jsonb,'candidaturas','[]'::jsonb,'cobrir','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_trocas from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,'alvo_nome',ma.nome,
             'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    left join public.acolitos_membros ma on ma.id=s.alvo_membro_id
    where s.tipo='troca' and s.status='aguardando_coordenacao') t;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_cand from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,
             'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    where s.tipo='candidatura' and s.status='aguardando_coordenacao') t;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_cobrir from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,'celebracao_id',s.celebracao_id,
             'membro_id',s.membro_id,'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    where s.tipo='troca' and s.status='aguardando_cobertura') t;
  return jsonb_build_object('trocas',v_trocas,'candidaturas',v_cand,'cobrir',v_cobrir);
end; $$;


--
-- Name: acolitos_solicitar_troca(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_cel uuid; v_funcao text; v_status text; v_id uuid;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  select celebracao_id, funcao into v_cel, v_funcao
  from public.acolitos_escalas
  where id = p_escala_id and membro_id = v_me and status = 'escalado';
  if v_cel is null then return jsonb_build_object('erro','nao_escalado'); end if;
  if exists (select 1 from public.acolitos_solicitacoes
             where escala_id = p_escala_id and membro_id = v_me
               and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega')) then
    return jsonb_build_object('erro','ja_existe');
  end if;
  v_status := case when p_alvo_membro_id is null then 'aguardando_cobertura' else 'aguardando_colega' end;
  insert into public.acolitos_solicitacoes(membro_id, celebracao_id, escala_id, funcao, tipo, alvo_membro_id, status, motivo)
  values (v_me, v_cel, p_escala_id, v_funcao, 'troca', p_alvo_membro_id, v_status, p_motivo)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end; $$;


--
-- Name: acolitos_solicitos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_solicitos() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(x order by (x->>'total')::int desc, x->>'membro'), '[]'::jsonb)
  from (
    select jsonb_build_object('membro_id', m.id, 'membro', coalesce(nullif(m.apelido,''),m.nome),
             'foto_url', m.foto_url, 'nivel', m.nivel, 'total', count(*)) as x
    from acolitos_presencas_avulsas pa join acolitos_membros m on m.id=pa.membro_id
    where m.status='ativo'
    group by m.id, m.apelido, m.nome, m.foto_url, m.nivel
  ) t;
$$;


--
-- Name: acolitos_substituir_ausente(uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
        where m.status = 'ativo' and m.id <> v_membro
          and (v_diakey is null or exists (select 1 from acolitos_disponibilidade d where d.membro_id = m.id and d.dia = v_diakey and d.horario = v_cel.horario))
          and not exists (select 1 from acolitos_ausencias a where a.membro_id = m.id and (a.celebracao_id = v_cel.id or a.data = v_cel.data))
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
$$;


--
-- Name: acolitos_substituto_creditar(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: acolitos_temporada_abrir(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_temporada_abrir(p_nome text, p_inicio date, p_fim date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_id uuid;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  update acolitos_temporadas set ativa=false where ativa;
  insert into acolitos_temporadas (nome, inicio, fim, ativa) values (p_nome, p_inicio, p_fim, true) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end; $$;


--
-- Name: acolitos_temporada_fechar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_temporada_fechar() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_role text:=acolitos_get_role(auth.uid()); v_id uuid; v_nome text; r record; n int:=0;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then return jsonb_build_object('erro','sem_permissao'); end if;
  select id, nome into v_id, v_nome from acolitos_temporadas where ativa order by created_at desc limit 1;
  if v_id is null then return jsonb_build_object('erro','sem_temporada'); end if;
  for r in (
    with xp as (select membro_id, sum(xp) xp from acolitos_xp_temporada where temporada_id=v_id group by membro_id),
    base as (select m.id, m.nome, x.xp,
       case when m.nivel in ('aspirante','coroinha','acolito_aspirante') then 'iniciantes'
            when m.nivel in ('acolito_guardiao','acolito_sentinela') then 'acolitos' else 'cerimoniarios' end liga
       from acolitos_membros m join xp x on x.membro_id=m.id where m.status='ativo' and x.xp>0)
    select distinct on (liga) liga, id, nome, xp from base order by liga, xp desc, nome
  ) loop
    insert into acolitos_campeoes (temporada_id, temporada_nome, liga, membro_id, membro_nome, xp)
      values (v_id, v_nome, r.liga, r.id, r.nome, r.xp);
    update acolitos_membros set avisos = coalesce(avisos,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
       'tipo','campeao','liga',r.liga,'temporada',v_nome,'seen',false,'ts',(extract(epoch from now())*1000)::bigint))
     where id=r.id;
    n := n+1;
  end loop;
  update acolitos_temporadas set ativa=false where id=v_id;
  return jsonb_build_object('ok',true,'campeoes',n);
end; $$;


--
-- Name: acolitos_troca_responder(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_novo text;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  v_novo := case when p_aceita then 'aguardando_coordenacao' else 'recusado_colega' end;
  update public.acolitos_solicitacoes
    set status = v_novo, atualizado_em = now()
    where id = p_solicitacao_id and alvo_membro_id = v_me and status = 'aguardando_colega';
  if not found then return jsonb_build_object('erro','nao_pendente'); end if;
  return jsonb_build_object('ok', true, 'status', v_novo);
end; $$;


--
-- Name: acolitos_vagas_abertas_membro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_vagas_abertas_membro() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid; v_out jsonb;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('vagas','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'celebracao_id', c.id, 'data', c.data, 'horario', c.horario,
           'comunidade', c.comunidade, 'tipo', c.tipo, 'funcao', mo.funcao
         ) order by c.data, c.horario), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  join public.acolitos_modelos mo
    on mo.tipo = c.tipo and mo.comunidade = c.comunidade
  join public.acolitos_habilitacoes h
    on h.membro_id = v_me and h.funcao = mo.funcao
  where c.data >= current_date
    and mo.quantidade > (
      select count(*) from public.acolitos_escalas e
      where e.celebracao_id = c.id and e.funcao = mo.funcao and e.status = 'escalado'
    )
    and not exists (
      select 1 from public.acolitos_escalas e2
      where e2.celebracao_id = c.id and e2.membro_id = v_me and e2.status = 'escalado'
    );
  return jsonb_build_object('vagas', v_out);
end; $$;


--
-- Name: acolitos_xp_hoje(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acolitos_xp_hoje(p_membro uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(xt.xp),0)::int
  from acolitos_xp_temporada xt
  where xt.membro_id = p_membro
    and (xt.created_at at time zone 'America/Sao_Paulo')::date
        = (now() at time zone 'America/Sao_Paulo')::date;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  begin
    insert into public.profiles (id, nome, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
      new.email
    );
    return new;
  end;
  $$;


--
-- Name: is_central_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_central_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    grupo_interesse text,
    mensagem text,
    status text DEFAULT 'pendente'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT access_requests_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text])))
);


--
-- Name: acolitos_ausencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_ausencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    celebracao_id uuid,
    motivo text DEFAULT 'outro'::text NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now(),
    data date,
    CONSTRAINT acolitos_ausencias_motivo_check CHECK ((motivo = ANY (ARRAY['doenca'::text, 'viagem'::text, 'familia'::text, 'outro'::text])))
);


--
-- Name: acolitos_ausencias_pendentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_ausencias_pendentes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    data date NOT NULL,
    motivo text,
    informante_nome text,
    informante_contato text,
    status text DEFAULT 'pendente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revisado_por uuid,
    revisado_em timestamp with time zone,
    celebracao_id uuid,
    CONSTRAINT acolitos_ausencias_pendentes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text])))
);


--
-- Name: TABLE acolitos_ausencias_pendentes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.acolitos_ausencias_pendentes IS 'Fila de avisos de ausência da página pública /ausencias (aguardando confirmação da equipe).';


--
-- Name: acolitos_campeoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_campeoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temporada_id uuid,
    temporada_nome text,
    liga text,
    membro_id uuid,
    membro_nome text,
    xp integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_casas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_casas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nome text NOT NULL,
    emoji text,
    lema text,
    lema_pt text,
    tagline text,
    caracteristicas text[] DEFAULT '{}'::text[] NOT NULL,
    cor text,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo text DEFAULT 'membro'::text NOT NULL
);


--
-- Name: acolitos_celebracoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_celebracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data date NOT NULL,
    horario text NOT NULL,
    comunidade text DEFAULT 'matriz'::text NOT NULL,
    tipo text DEFAULT 'missa_comum'::text NOT NULL,
    observacoes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT acolitos_celebracoes_comunidade_check CHECK ((comunidade = ANY (ARRAY['matriz'::text, 'santo_antonio'::text])))
);


--
-- Name: acolitos_chamadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_chamadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    celebracao_id uuid NOT NULL,
    realizada_por uuid,
    realizada_em timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_chamadas_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_chamadas_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chamada_id uuid NOT NULL,
    escala_id uuid NOT NULL,
    resultado text NOT NULL,
    substituto_id uuid,
    CONSTRAINT acolitos_chamadas_itens_resultado_check CHECK ((resultado = ANY (ARRAY['presente'::text, 'ausente'::text, 'atrasado'::text])))
);


--
-- Name: acolitos_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_config (
    chave text NOT NULL,
    valor jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: acolitos_crm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_crm (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    etapa text DEFAULT 'aprovacao_cadastro'::text NOT NULL,
    etapa_iniciada_em timestamp with time zone DEFAULT now(),
    observacoes text,
    CONSTRAINT acolitos_crm_etapa_check CHECK ((etapa = ANY (ARRAY['aprovacao_cadastro'::text, 'integracao'::text, 'whatsapp'::text, 'tunica'::text, 'disponivel_escala'::text, 'integrado'::text])))
);


--
-- Name: acolitos_crm_historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_crm_historico (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    etapa_de text NOT NULL,
    etapa_para text NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_disponibilidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_disponibilidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    dia text NOT NULL,
    horario text NOT NULL,
    comunidade text,
    restricao text,
    CONSTRAINT acolitos_disponibilidade_dia_check CHECK ((dia = ANY (ARRAY['sabado'::text, 'domingo'::text])))
);


--
-- Name: acolitos_escala_artes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_escala_artes (
    domingo_data date NOT NULL,
    png_url text NOT NULL,
    tempo text,
    descricao text,
    cor text,
    gerado_em timestamp with time zone DEFAULT now() NOT NULL,
    gerado_por text DEFAULT 'cron'::text NOT NULL
);


--
-- Name: acolitos_escalas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_escalas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    celebracao_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    funcao text NOT NULL,
    status text DEFAULT 'escalado'::text NOT NULL,
    substituto_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT acolitos_escalas_status_check CHECK ((status = ANY (ARRAY['escalado'::text, 'presente'::text, 'ausente_justificado'::text, 'ausente'::text, 'atrasado'::text, 'substituido'::text])))
);


--
-- Name: acolitos_evento_presencas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_evento_presencas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evento_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    status text DEFAULT 'vou'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    tipo text DEFAULT 'evento'::text NOT NULL,
    data date NOT NULL,
    hora time without time zone,
    hora_fim time without time zone,
    local text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    convocados text[]
);


--
-- Name: acolitos_financeiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_financeiro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    categoria text DEFAULT 'outro'::text NOT NULL,
    valor numeric(12,2) NOT NULL,
    descricao text,
    data date DEFAULT CURRENT_DATE NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acolitos_financeiro_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text]))),
    CONSTRAINT acolitos_financeiro_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: acolitos_frequencia; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.acolitos_frequencia WITH (security_invoker='on') AS
 WITH base AS (
         SELECT e.membro_id,
            e.status,
            c.data
           FROM (public.acolitos_escalas e
             JOIN public.acolitos_celebracoes c ON ((c.id = e.celebracao_id)))
        UNION ALL
         SELECT e.substituto_id AS membro_id,
            'presente'::text AS status,
            c.data
           FROM (public.acolitos_escalas e
             JOIN public.acolitos_celebracoes c ON ((c.id = e.celebracao_id)))
          WHERE ((e.status = 'substituido'::text) AND (e.substituto_id IS NOT NULL))
        )
 SELECT membro_id,
    count(*) AS total_escalas,
    count(*) FILTER (WHERE (status = ANY (ARRAY['presente'::text, 'atrasado'::text]))) AS servidas,
    count(*) FILTER (WHERE (status = 'ausente_justificado'::text)) AS faltas_just,
    count(*) FILTER (WHERE (status = 'ausente'::text)) AS faltas_nao_just,
    count(*) FILTER (WHERE (status = 'atrasado'::text)) AS atrasos,
    count(*) FILTER (WHERE (status = 'escalado'::text)) AS pendentes,
    round(((100.0 * (count(*) FILTER (WHERE (status = ANY (ARRAY['presente'::text, 'atrasado'::text]))))::numeric) / (NULLIF(count(*) FILTER (WHERE (status = ANY (ARRAY['presente'::text, 'atrasado'::text, 'ausente_justificado'::text, 'ausente'::text]))), 0))::numeric)) AS taxa,
    max(data) FILTER (WHERE (status = ANY (ARRAY['presente'::text, 'atrasado'::text]))) AS ultima_participacao
   FROM base
  GROUP BY membro_id;


--
-- Name: acolitos_hab_pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_hab_pedidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    funcao text NOT NULL,
    label text,
    status text DEFAULT 'em_analise'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decidido_por uuid,
    decidido_em timestamp with time zone,
    evidencia text,
    obs_revisao text
);


--
-- Name: acolitos_habilitacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_habilitacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    funcao text NOT NULL,
    proficiencia text DEFAULT 'nao_treinado'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT acolitos_habilitacoes_funcao_check CHECK ((funcao = ANY (ARRAY['apoio'::text, 'cruz'::text, 'vela'::text, 'sineta'::text, 'sinao'::text, 'altar'::text, 'turibulo'::text, 'naveta'::text, 'missal'::text, 'cred_altar'::text, 'cred_credencia'::text, 'mitra'::text, 'baculo'::text]))),
    CONSTRAINT acolitos_habilitacoes_proficiencia_check CHECK ((proficiencia = ANY (ARRAY['nao_treinado'::text, 'em_formacao'::text, 'apto'::text, 'experiente'::text, 'referencia'::text])))
);


--
-- Name: acolitos_listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_listas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    valor text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: acolitos_liturgia_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_liturgia_override (
    domingo_data date NOT NULL,
    tempo text NOT NULL,
    descricao text NOT NULL,
    cor text NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acolitos_logins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_logins (
    membro_id uuid NOT NULL,
    usuario text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_membros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_membros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    data_nascimento date,
    telefone text,
    responsavel text,
    comunidade text DEFAULT 'matriz'::text NOT NULL,
    pode_outras_comunidades boolean DEFAULT true,
    tem_pai_ministro boolean DEFAULT false,
    nome_pai_ministro text,
    tem_mae_ministro boolean DEFAULT false,
    nome_mae_ministro text,
    comunidade_ministro text,
    escalar_com_pais boolean DEFAULT false,
    tem_irmao_pastoral boolean DEFAULT false,
    irmao_id uuid,
    escalar_com_irmao boolean DEFAULT false,
    necessidades_especiais text,
    observacoes text,
    foto_url text,
    status text DEFAULT 'ativo'::text NOT NULL,
    proxima_etapa text,
    created_at timestamp with time zone DEFAULT now(),
    batismo boolean DEFAULT false,
    primeira_eucaristia boolean DEFAULT false,
    crisma boolean DEFAULT false,
    tem_tunica boolean DEFAULT false,
    no_grupo_whatsapp boolean DEFAULT false,
    endereco text,
    celular_mae text,
    celular_recado text,
    nivel_visto text,
    nivel text,
    apelido text,
    grupo_irmaos uuid,
    serve boolean DEFAULT true NOT NULL,
    eh_equipe boolean DEFAULT false NOT NULL,
    setores text[] DEFAULT '{}'::text[] NOT NULL,
    permissoes text[] DEFAULT '{}'::text[] NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    desenvolvimento_habilidades text[] DEFAULT '{}'::text[] NOT NULL,
    desenvolvimento_competencias text[] DEFAULT '{}'::text[] NOT NULL,
    mensagem_coordenacao text,
    telefone_whatsapp boolean DEFAULT false NOT NULL,
    habilidades_desenvolvidas text[] DEFAULT '{}'::text[] NOT NULL,
    competencias_desenvolvidas text[] DEFAULT '{}'::text[] NOT NULL,
    casa_id uuid,
    nivel_desde timestamp with time zone,
    xp_avulso integer DEFAULT 0 NOT NULL,
    nome_mae text,
    nome_pai text,
    contato_principal text,
    celular_responsavel text,
    responsavel_whatsapp boolean DEFAULT false NOT NULL,
    CONSTRAINT acolitos_membros_comunidade_check CHECK ((comunidade = ANY (ARRAY['matriz'::text, 'santo_antonio'::text, 'outra'::text]))),
    CONSTRAINT acolitos_membros_contato_principal_check CHECK (((contato_principal IS NULL) OR (contato_principal = ANY (ARRAY['mae'::text, 'pai'::text])))),
    CONSTRAINT acolitos_membros_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'afastado'::text, 'desligado'::text, 'em_integracao'::text])))
);


--
-- Name: acolitos_missao_progresso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_missao_progresso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    missao_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    status text DEFAULT 'em_analise'::text NOT NULL,
    xp_ganho integer DEFAULT 0 NOT NULL,
    temporada_id uuid,
    evidencia text,
    aprovado_por uuid,
    concluida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    envolvidos uuid[],
    obs_revisao text,
    CONSTRAINT acolitos_missao_progresso_status_check CHECK ((status = ANY (ARRAY['em_analise'::text, 'concluida'::text, 'revisao'::text, 'medalha'::text])))
);


--
-- Name: acolitos_missoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_missoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text DEFAULT ''::text,
    tipo text DEFAULT 'bonus'::text NOT NULL,
    validacao text DEFAULT 'reivindicada'::text NOT NULL,
    xp integer DEFAULT 10 NOT NULL,
    nivel_alvo text,
    aplica_de text,
    aplica_ate text,
    criterio jsonb,
    concede_badge boolean DEFAULT false NOT NULL,
    badge_icone text,
    badge_label text,
    seriedade text,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    capitulo integer,
    obrigatoria boolean DEFAULT true NOT NULL,
    recorrente boolean DEFAULT false NOT NULL,
    niveis_alvo text[],
    exclusiva boolean DEFAULT false,
    expira_em date,
    badge_desc text,
    badge_tier text,
    CONSTRAINT acolitos_missoes_tipo_check CHECK ((tipo = ANY (ARRAY['requisito'::text, 'bonus'::text]))),
    CONSTRAINT acolitos_missoes_validacao_check CHECK ((validacao = ANY (ARRAY['automatica'::text, 'avaliada'::text, 'reivindicada'::text])))
);


--
-- Name: acolitos_modelos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_modelos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    comunidade text NOT NULL,
    funcao text NOT NULL,
    quantidade integer DEFAULT 0 NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- Name: acolitos_presencas_avulsas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_presencas_avulsas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    celebracao_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    registrado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acolitos_push_subs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_push_subs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    ultima_ok timestamp with time zone
);


--
-- Name: acolitos_semana_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_semana_override (
    semana text NOT NULL,
    missao_id uuid,
    tema text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_solicitacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_solicitacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    celebracao_id uuid NOT NULL,
    escala_id uuid,
    funcao text NOT NULL,
    tipo text NOT NULL,
    alvo_membro_id uuid,
    status text DEFAULT 'aguardando_coordenacao'::text NOT NULL,
    motivo text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    decidido_por uuid,
    resultado_escala_id uuid,
    CONSTRAINT acolitos_solicitacoes_tipo_check CHECK ((tipo = ANY (ARRAY['troca'::text, 'candidatura'::text])))
);


--
-- Name: acolitos_substituto_creditos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_substituto_creditos (
    celebracao_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    registrado_por uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: acolitos_tarefas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_tarefas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    time_slug text NOT NULL,
    responsavel_id uuid,
    prazo date,
    observacao text,
    recorrencia text DEFAULT 'nenhuma'::text NOT NULL,
    concluida_em timestamp with time zone,
    concluida_por uuid,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    criada_por uuid,
    andamento_em timestamp with time zone,
    andamento_por uuid,
    origem_id uuid,
    CONSTRAINT acolitos_tarefas_recorrencia_check CHECK ((recorrencia = ANY (ARRAY['nenhuma'::text, 'semanal'::text, 'mensal'::text, 'anual'::text, 'celebracao'::text])))
);


--
-- Name: acolitos_temporadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_temporadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    inicio date DEFAULT CURRENT_DATE NOT NULL,
    fim date,
    ativa boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acolitos_xp_temporada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acolitos_xp_temporada (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membro_id uuid NOT NULL,
    temporada_id uuid NOT NULL,
    xp integer NOT NULL,
    origem text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_tools (
    group_id uuid NOT NULL,
    tool_id uuid NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    lider_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pastoral_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pastoral_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    module_id uuid NOT NULL,
    role text DEFAULT 'novo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pastoral_members_role_check CHECK ((role = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text, 'cerimonario'::text, 'acolito'::text, 'coroinha'::text, 'aspirante'::text, 'novo'::text])))
);


--
-- Name: pastoral_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pastoral_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    foto_url text,
    group_id uuid,
    role text DEFAULT 'membro'::text NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'lider'::text, 'membro'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'bloqueado'::text])))
);


--
-- Name: tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    icone text DEFAULT '🔧'::text,
    url text NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: acolitos_ausencias acolitos_ausencias_membro_id_celebracao_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias
    ADD CONSTRAINT acolitos_ausencias_membro_id_celebracao_id_key UNIQUE (membro_id, celebracao_id);


--
-- Name: acolitos_ausencias_pendentes acolitos_ausencias_pendentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias_pendentes
    ADD CONSTRAINT acolitos_ausencias_pendentes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_ausencias acolitos_ausencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias
    ADD CONSTRAINT acolitos_ausencias_pkey PRIMARY KEY (id);


--
-- Name: acolitos_campeoes acolitos_campeoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_campeoes
    ADD CONSTRAINT acolitos_campeoes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_casas acolitos_casas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_casas
    ADD CONSTRAINT acolitos_casas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_casas acolitos_casas_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_casas
    ADD CONSTRAINT acolitos_casas_slug_key UNIQUE (slug);


--
-- Name: acolitos_celebracoes acolitos_celebracoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_celebracoes
    ADD CONSTRAINT acolitos_celebracoes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_chamadas acolitos_chamadas_celebracao_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas
    ADD CONSTRAINT acolitos_chamadas_celebracao_id_key UNIQUE (celebracao_id);


--
-- Name: acolitos_chamadas_itens acolitos_chamadas_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas_itens
    ADD CONSTRAINT acolitos_chamadas_itens_pkey PRIMARY KEY (id);


--
-- Name: acolitos_chamadas acolitos_chamadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas
    ADD CONSTRAINT acolitos_chamadas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_config acolitos_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_config
    ADD CONSTRAINT acolitos_config_pkey PRIMARY KEY (chave);


--
-- Name: acolitos_crm_historico acolitos_crm_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm_historico
    ADD CONSTRAINT acolitos_crm_historico_pkey PRIMARY KEY (id);


--
-- Name: acolitos_crm acolitos_crm_membro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm
    ADD CONSTRAINT acolitos_crm_membro_id_key UNIQUE (membro_id);


--
-- Name: acolitos_crm acolitos_crm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm
    ADD CONSTRAINT acolitos_crm_pkey PRIMARY KEY (id);


--
-- Name: acolitos_disponibilidade acolitos_disponibilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_disponibilidade
    ADD CONSTRAINT acolitos_disponibilidade_pkey PRIMARY KEY (id);


--
-- Name: acolitos_escala_artes acolitos_escala_artes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escala_artes
    ADD CONSTRAINT acolitos_escala_artes_pkey PRIMARY KEY (domingo_data);


--
-- Name: acolitos_escalas acolitos_escalas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escalas
    ADD CONSTRAINT acolitos_escalas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_evento_presencas acolitos_evento_presencas_evento_id_membro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_evento_presencas
    ADD CONSTRAINT acolitos_evento_presencas_evento_id_membro_id_key UNIQUE (evento_id, membro_id);


--
-- Name: acolitos_evento_presencas acolitos_evento_presencas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_evento_presencas
    ADD CONSTRAINT acolitos_evento_presencas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_eventos acolitos_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_eventos
    ADD CONSTRAINT acolitos_eventos_pkey PRIMARY KEY (id);


--
-- Name: acolitos_financeiro acolitos_financeiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_financeiro
    ADD CONSTRAINT acolitos_financeiro_pkey PRIMARY KEY (id);


--
-- Name: acolitos_hab_pedidos acolitos_hab_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_hab_pedidos
    ADD CONSTRAINT acolitos_hab_pedidos_pkey PRIMARY KEY (id);


--
-- Name: acolitos_habilitacoes acolitos_habilitacoes_membro_id_funcao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_habilitacoes
    ADD CONSTRAINT acolitos_habilitacoes_membro_id_funcao_key UNIQUE (membro_id, funcao);


--
-- Name: acolitos_habilitacoes acolitos_habilitacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_habilitacoes
    ADD CONSTRAINT acolitos_habilitacoes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_listas acolitos_listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_listas
    ADD CONSTRAINT acolitos_listas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_listas acolitos_listas_tipo_valor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_listas
    ADD CONSTRAINT acolitos_listas_tipo_valor_key UNIQUE (tipo, valor);


--
-- Name: acolitos_liturgia_override acolitos_liturgia_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_liturgia_override
    ADD CONSTRAINT acolitos_liturgia_override_pkey PRIMARY KEY (domingo_data);


--
-- Name: acolitos_logins acolitos_logins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_logins
    ADD CONSTRAINT acolitos_logins_pkey PRIMARY KEY (membro_id);


--
-- Name: acolitos_membros acolitos_membros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_membros
    ADD CONSTRAINT acolitos_membros_pkey PRIMARY KEY (id);


--
-- Name: acolitos_missao_progresso acolitos_missao_progresso_missao_id_membro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_missao_progresso
    ADD CONSTRAINT acolitos_missao_progresso_missao_id_membro_id_key UNIQUE (missao_id, membro_id);


--
-- Name: acolitos_missao_progresso acolitos_missao_progresso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_missao_progresso
    ADD CONSTRAINT acolitos_missao_progresso_pkey PRIMARY KEY (id);


--
-- Name: acolitos_missoes acolitos_missoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_missoes
    ADD CONSTRAINT acolitos_missoes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_modelos acolitos_modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_modelos
    ADD CONSTRAINT acolitos_modelos_pkey PRIMARY KEY (id);


--
-- Name: acolitos_modelos acolitos_modelos_tipo_comunidade_funcao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_modelos
    ADD CONSTRAINT acolitos_modelos_tipo_comunidade_funcao_key UNIQUE (tipo, comunidade, funcao);


--
-- Name: acolitos_presencas_avulsas acolitos_presencas_avulsas_celebracao_id_membro_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_presencas_avulsas
    ADD CONSTRAINT acolitos_presencas_avulsas_celebracao_id_membro_id_key UNIQUE (celebracao_id, membro_id);


--
-- Name: acolitos_presencas_avulsas acolitos_presencas_avulsas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_presencas_avulsas
    ADD CONSTRAINT acolitos_presencas_avulsas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_push_subs acolitos_push_subs_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_push_subs
    ADD CONSTRAINT acolitos_push_subs_endpoint_key UNIQUE (endpoint);


--
-- Name: acolitos_push_subs acolitos_push_subs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_push_subs
    ADD CONSTRAINT acolitos_push_subs_pkey PRIMARY KEY (id);


--
-- Name: acolitos_semana_override acolitos_semana_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_semana_override
    ADD CONSTRAINT acolitos_semana_override_pkey PRIMARY KEY (semana);


--
-- Name: acolitos_solicitacoes acolitos_solicitacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_solicitacoes
    ADD CONSTRAINT acolitos_solicitacoes_pkey PRIMARY KEY (id);


--
-- Name: acolitos_substituto_creditos acolitos_substituto_creditos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_substituto_creditos
    ADD CONSTRAINT acolitos_substituto_creditos_pkey PRIMARY KEY (celebracao_id, membro_id);


--
-- Name: acolitos_tarefas acolitos_tarefas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_tarefas
    ADD CONSTRAINT acolitos_tarefas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_temporadas acolitos_temporadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_temporadas
    ADD CONSTRAINT acolitos_temporadas_pkey PRIMARY KEY (id);


--
-- Name: acolitos_xp_temporada acolitos_xp_temporada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_xp_temporada
    ADD CONSTRAINT acolitos_xp_temporada_pkey PRIMARY KEY (id);


--
-- Name: group_tools group_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tools
    ADD CONSTRAINT group_tools_pkey PRIMARY KEY (group_id, tool_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: pastoral_members pastoral_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_members
    ADD CONSTRAINT pastoral_members_pkey PRIMARY KEY (id);


--
-- Name: pastoral_members pastoral_members_user_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_members
    ADD CONSTRAINT pastoral_members_user_id_module_id_key UNIQUE (user_id, module_id);


--
-- Name: pastoral_modules pastoral_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_modules
    ADD CONSTRAINT pastoral_modules_pkey PRIMARY KEY (id);


--
-- Name: pastoral_modules pastoral_modules_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_modules
    ADD CONSTRAINT pastoral_modules_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: acolitos_aus_membro_data_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX acolitos_aus_membro_data_uq ON public.acolitos_ausencias USING btree (membro_id, data) WHERE (celebracao_id IS NULL);


--
-- Name: acolitos_aus_pend_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acolitos_aus_pend_status_idx ON public.acolitos_ausencias_pendentes USING btree (status, created_at DESC);


--
-- Name: acolitos_aus_pend_uniq_cel; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX acolitos_aus_pend_uniq_cel ON public.acolitos_ausencias_pendentes USING btree (membro_id, celebracao_id) WHERE (status = 'pendente'::text);


--
-- Name: acolitos_hab_pedidos_pend_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX acolitos_hab_pedidos_pend_uniq ON public.acolitos_hab_pedidos USING btree (membro_id, funcao) WHERE (status = 'em_analise'::text);


--
-- Name: acolitos_tarefas_andamento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acolitos_tarefas_andamento_idx ON public.acolitos_tarefas USING btree (andamento_em) WHERE (concluida_em IS NULL);


--
-- Name: acolitos_tarefas_origem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acolitos_tarefas_origem_idx ON public.acolitos_tarefas USING btree (origem_id) WHERE (concluida_em IS NULL);


--
-- Name: acolitos_tarefas_prazo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acolitos_tarefas_prazo_idx ON public.acolitos_tarefas USING btree (prazo) WHERE (concluida_em IS NULL);


--
-- Name: acolitos_tarefas_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acolitos_tarefas_time_idx ON public.acolitos_tarefas USING btree (time_slug);


--
-- Name: acolitos_temporadas_uma_ativa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX acolitos_temporadas_uma_ativa ON public.acolitos_temporadas USING btree (ativa) WHERE ativa;


--
-- Name: idx_acolitos_evento_presencas_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acolitos_evento_presencas_evento ON public.acolitos_evento_presencas USING btree (evento_id);


--
-- Name: idx_acolitos_eventos_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acolitos_eventos_data ON public.acolitos_eventos USING btree (data);


--
-- Name: idx_acolitos_financeiro_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acolitos_financeiro_data ON public.acolitos_financeiro USING btree (data DESC);


--
-- Name: idx_acolitos_membros_grupo_irmaos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acolitos_membros_grupo_irmaos ON public.acolitos_membros USING btree (grupo_irmaos) WHERE (grupo_irmaos IS NOT NULL);


--
-- Name: idx_solic_alvo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solic_alvo ON public.acolitos_solicitacoes USING btree (alvo_membro_id);


--
-- Name: idx_solic_celebra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solic_celebra ON public.acolitos_solicitacoes USING btree (celebracao_id);


--
-- Name: idx_solic_membro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solic_membro ON public.acolitos_solicitacoes USING btree (membro_id);


--
-- Name: idx_solic_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solic_status ON public.acolitos_solicitacoes USING btree (status);


--
-- Name: ix_xp_temp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_xp_temp ON public.acolitos_xp_temporada USING btree (temporada_id, membro_id);


--
-- Name: acolitos_habilitacoes trg_acolitos_medalha_apto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_acolitos_medalha_apto AFTER INSERT OR UPDATE OF proficiencia ON public.acolitos_habilitacoes FOR EACH ROW EXECUTE FUNCTION public._acolitos_medalha_ao_apto();


--
-- Name: access_requests access_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: acolitos_ausencias acolitos_ausencias_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias
    ADD CONSTRAINT acolitos_ausencias_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_ausencias acolitos_ausencias_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias
    ADD CONSTRAINT acolitos_ausencias_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_ausencias_pendentes acolitos_ausencias_pendentes_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias_pendentes
    ADD CONSTRAINT acolitos_ausencias_pendentes_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_ausencias_pendentes acolitos_ausencias_pendentes_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias_pendentes
    ADD CONSTRAINT acolitos_ausencias_pendentes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_ausencias_pendentes acolitos_ausencias_pendentes_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_ausencias_pendentes
    ADD CONSTRAINT acolitos_ausencias_pendentes_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES auth.users(id);


--
-- Name: acolitos_campeoes acolitos_campeoes_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_campeoes
    ADD CONSTRAINT acolitos_campeoes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_campeoes acolitos_campeoes_temporada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_campeoes
    ADD CONSTRAINT acolitos_campeoes_temporada_id_fkey FOREIGN KEY (temporada_id) REFERENCES public.acolitos_temporadas(id) ON DELETE SET NULL;


--
-- Name: acolitos_celebracoes acolitos_celebracoes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_celebracoes
    ADD CONSTRAINT acolitos_celebracoes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: acolitos_chamadas acolitos_chamadas_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas
    ADD CONSTRAINT acolitos_chamadas_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_chamadas_itens acolitos_chamadas_itens_chamada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas_itens
    ADD CONSTRAINT acolitos_chamadas_itens_chamada_id_fkey FOREIGN KEY (chamada_id) REFERENCES public.acolitos_chamadas(id) ON DELETE CASCADE;


--
-- Name: acolitos_chamadas_itens acolitos_chamadas_itens_escala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas_itens
    ADD CONSTRAINT acolitos_chamadas_itens_escala_id_fkey FOREIGN KEY (escala_id) REFERENCES public.acolitos_escalas(id) ON DELETE CASCADE;


--
-- Name: acolitos_chamadas_itens acolitos_chamadas_itens_substituto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas_itens
    ADD CONSTRAINT acolitos_chamadas_itens_substituto_id_fkey FOREIGN KEY (substituto_id) REFERENCES public.acolitos_membros(id);


--
-- Name: acolitos_chamadas acolitos_chamadas_realizada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_chamadas
    ADD CONSTRAINT acolitos_chamadas_realizada_por_fkey FOREIGN KEY (realizada_por) REFERENCES auth.users(id);


--
-- Name: acolitos_crm_historico acolitos_crm_historico_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm_historico
    ADD CONSTRAINT acolitos_crm_historico_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: acolitos_crm_historico acolitos_crm_historico_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm_historico
    ADD CONSTRAINT acolitos_crm_historico_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_crm acolitos_crm_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_crm
    ADD CONSTRAINT acolitos_crm_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_disponibilidade acolitos_disponibilidade_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_disponibilidade
    ADD CONSTRAINT acolitos_disponibilidade_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_escalas acolitos_escalas_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escalas
    ADD CONSTRAINT acolitos_escalas_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_escalas acolitos_escalas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escalas
    ADD CONSTRAINT acolitos_escalas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: acolitos_escalas acolitos_escalas_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escalas
    ADD CONSTRAINT acolitos_escalas_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_escalas acolitos_escalas_substituto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_escalas
    ADD CONSTRAINT acolitos_escalas_substituto_id_fkey FOREIGN KEY (substituto_id) REFERENCES public.acolitos_membros(id);


--
-- Name: acolitos_evento_presencas acolitos_evento_presencas_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_evento_presencas
    ADD CONSTRAINT acolitos_evento_presencas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.acolitos_eventos(id) ON DELETE CASCADE;


--
-- Name: acolitos_evento_presencas acolitos_evento_presencas_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_evento_presencas
    ADD CONSTRAINT acolitos_evento_presencas_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_hab_pedidos acolitos_hab_pedidos_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_hab_pedidos
    ADD CONSTRAINT acolitos_hab_pedidos_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_habilitacoes acolitos_habilitacoes_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_habilitacoes
    ADD CONSTRAINT acolitos_habilitacoes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_logins acolitos_logins_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_logins
    ADD CONSTRAINT acolitos_logins_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_membros acolitos_membros_casa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_membros
    ADD CONSTRAINT acolitos_membros_casa_id_fkey FOREIGN KEY (casa_id) REFERENCES public.acolitos_casas(id) ON DELETE SET NULL;


--
-- Name: acolitos_membros acolitos_membros_irmao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_membros
    ADD CONSTRAINT acolitos_membros_irmao_id_fkey FOREIGN KEY (irmao_id) REFERENCES public.acolitos_membros(id) ON DELETE SET NULL;


--
-- Name: acolitos_membros acolitos_membros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_membros
    ADD CONSTRAINT acolitos_membros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: acolitos_missao_progresso acolitos_missao_progresso_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_missao_progresso
    ADD CONSTRAINT acolitos_missao_progresso_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_missao_progresso acolitos_missao_progresso_missao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_missao_progresso
    ADD CONSTRAINT acolitos_missao_progresso_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.acolitos_missoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_presencas_avulsas acolitos_presencas_avulsas_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_presencas_avulsas
    ADD CONSTRAINT acolitos_presencas_avulsas_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_presencas_avulsas acolitos_presencas_avulsas_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_presencas_avulsas
    ADD CONSTRAINT acolitos_presencas_avulsas_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_semana_override acolitos_semana_override_missao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_semana_override
    ADD CONSTRAINT acolitos_semana_override_missao_id_fkey FOREIGN KEY (missao_id) REFERENCES public.acolitos_missoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_solicitacoes acolitos_solicitacoes_alvo_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_solicitacoes
    ADD CONSTRAINT acolitos_solicitacoes_alvo_membro_id_fkey FOREIGN KEY (alvo_membro_id) REFERENCES public.acolitos_membros(id) ON DELETE SET NULL;


--
-- Name: acolitos_solicitacoes acolitos_solicitacoes_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_solicitacoes
    ADD CONSTRAINT acolitos_solicitacoes_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_solicitacoes acolitos_solicitacoes_escala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_solicitacoes
    ADD CONSTRAINT acolitos_solicitacoes_escala_id_fkey FOREIGN KEY (escala_id) REFERENCES public.acolitos_escalas(id) ON DELETE SET NULL;


--
-- Name: acolitos_solicitacoes acolitos_solicitacoes_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_solicitacoes
    ADD CONSTRAINT acolitos_solicitacoes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_substituto_creditos acolitos_substituto_creditos_celebracao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_substituto_creditos
    ADD CONSTRAINT acolitos_substituto_creditos_celebracao_id_fkey FOREIGN KEY (celebracao_id) REFERENCES public.acolitos_celebracoes(id) ON DELETE CASCADE;


--
-- Name: acolitos_substituto_creditos acolitos_substituto_creditos_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_substituto_creditos
    ADD CONSTRAINT acolitos_substituto_creditos_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_substituto_creditos acolitos_substituto_creditos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_substituto_creditos
    ADD CONSTRAINT acolitos_substituto_creditos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id);


--
-- Name: acolitos_tarefas acolitos_tarefas_andamento_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_tarefas
    ADD CONSTRAINT acolitos_tarefas_andamento_por_fkey FOREIGN KEY (andamento_por) REFERENCES public.acolitos_membros(id) ON DELETE SET NULL;


--
-- Name: acolitos_tarefas acolitos_tarefas_concluida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_tarefas
    ADD CONSTRAINT acolitos_tarefas_concluida_por_fkey FOREIGN KEY (concluida_por) REFERENCES public.acolitos_membros(id) ON DELETE SET NULL;


--
-- Name: acolitos_tarefas acolitos_tarefas_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_tarefas
    ADD CONSTRAINT acolitos_tarefas_origem_id_fkey FOREIGN KEY (origem_id) REFERENCES public.acolitos_tarefas(id) ON DELETE SET NULL;


--
-- Name: acolitos_tarefas acolitos_tarefas_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_tarefas
    ADD CONSTRAINT acolitos_tarefas_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.acolitos_membros(id) ON DELETE SET NULL;


--
-- Name: acolitos_xp_temporada acolitos_xp_temporada_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_xp_temporada
    ADD CONSTRAINT acolitos_xp_temporada_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.acolitos_membros(id) ON DELETE CASCADE;


--
-- Name: acolitos_xp_temporada acolitos_xp_temporada_temporada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acolitos_xp_temporada
    ADD CONSTRAINT acolitos_xp_temporada_temporada_id_fkey FOREIGN KEY (temporada_id) REFERENCES public.acolitos_temporadas(id) ON DELETE CASCADE;


--
-- Name: group_tools group_tools_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tools
    ADD CONSTRAINT group_tools_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_tools group_tools_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tools
    ADD CONSTRAINT group_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE;


--
-- Name: groups groups_lider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: pastoral_members pastoral_members_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_members
    ADD CONSTRAINT pastoral_members_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.pastoral_modules(id) ON DELETE CASCADE;


--
-- Name: pastoral_members pastoral_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pastoral_members
    ADD CONSTRAINT pastoral_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pastoral_members Admin altera roles pastorais; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin altera roles pastorais" ON public.pastoral_members FOR UPDATE USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text]))) WITH CHECK (
CASE
    WHEN (role = ANY (ARRAY['aspirante'::text, 'coroinha'::text, 'acolito'::text, 'cerimonario'::text, 'membro_equipe'::text, 'novo'::text])) THEN (public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text]))
    WHEN (role = ANY (ARRAY['subadmin'::text, 'coord_admin'::text])) THEN (public.acolitos_get_role(auth.uid()) = 'coord_admin'::text)
    ELSE false
END);


--
-- Name: profiles Admin gerencia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia" ON public.profiles USING (public.is_central_admin()) WITH CHECK (public.is_central_admin());


--
-- Name: group_tools Admin gerencia group_tools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia group_tools" ON public.group_tools USING (public.is_central_admin()) WITH CHECK (public.is_central_admin());


--
-- Name: groups Admin gerencia grupos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia grupos" ON public.groups USING (public.is_central_admin()) WITH CHECK (public.is_central_admin());


--
-- Name: access_requests Admin gerencia requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia requests" ON public.access_requests USING (public.is_central_admin()) WITH CHECK (public.is_central_admin());


--
-- Name: tools Admin gerencia tools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia tools" ON public.tools USING (public.is_central_admin()) WITH CHECK (public.is_central_admin());


--
-- Name: profiles Admin le todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin le todos" ON public.profiles FOR SELECT USING (public.is_central_admin());


--
-- Name: access_requests Anonimo insere; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonimo insere" ON public.access_requests FOR INSERT WITH CHECK (true);


--
-- Name: acolitos_escala_artes Artes leitura autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Artes leitura autenticada" ON public.acolitos_escala_artes FOR SELECT TO authenticated USING (true);


--
-- Name: acolitos_crm Autenticado insere crm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado insere crm" ON public.acolitos_crm FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_membros Autenticado insere membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado insere membros" ON public.acolitos_membros FOR INSERT WITH CHECK (((auth.role() = 'authenticated'::text) AND ((user_id = auth.uid()) OR (user_id IS NULL))));


--
-- Name: acolitos_casas Autenticado le casas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado le casas" ON public.acolitos_casas FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_listas Autenticado le listas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado le listas" ON public.acolitos_listas FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_missoes Autenticado le missoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado le missoes" ON public.acolitos_missoes FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_modelos Autenticado le modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado le modelos" ON public.acolitos_modelos FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_temporadas Autenticado le temporadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticado le temporadas" ON public.acolitos_temporadas FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_celebracoes Autenticados leem celebracoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem celebracoes" ON public.acolitos_celebracoes FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_config Autenticados leem config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem config" ON public.acolitos_config FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_escalas Autenticados leem escalas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem escalas" ON public.acolitos_escalas FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_eventos Autenticados leem eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem eventos" ON public.acolitos_eventos FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: group_tools Autenticados leem group_tools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem group_tools" ON public.group_tools FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: groups Autenticados leem grupos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem grupos" ON public.groups FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: pastoral_modules Autenticados leem módulos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem módulos" ON public.pastoral_modules FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: acolitos_evento_presencas Autenticados leem presencas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem presencas" ON public.acolitos_evento_presencas FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: tools Autenticados leem tools ativas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem tools ativas" ON public.tools FOR SELECT USING (((auth.role() = 'authenticated'::text) AND (ativo = true)));


--
-- Name: acolitos_escalas Cerimonario atualiza status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cerimonario atualiza status" ON public.acolitos_escalas FOR UPDATE USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text, 'cerimonario'::text]))) WITH CHECK ((status = ANY (ARRAY['presente'::text, 'ausente'::text, 'atrasado'::text, 'substituido'::text, 'ausente_justificado'::text])));


--
-- Name: acolitos_ausencias Cerimonario gerencia ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cerimonario gerencia ausencias" ON public.acolitos_ausencias USING ((public.acolitos_get_role(auth.uid()) = 'cerimonario'::text)) WITH CHECK ((public.acolitos_get_role(auth.uid()) = 'cerimonario'::text));


--
-- Name: acolitos_evento_presencas Conta confirma presenca propria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Conta confirma presenca propria" ON public.acolitos_evento_presencas USING (public.acolitos_controla_membro(membro_id)) WITH CHECK (public.acolitos_controla_membro(membro_id));


--
-- Name: acolitos_chamadas Equipe e cerimonario gerenciam chamadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe e cerimonario gerenciam chamadas" ON public.acolitos_chamadas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text, 'cerimonario'::text])));


--
-- Name: acolitos_chamadas_itens Equipe e cerimonario gerenciam itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe e cerimonario gerenciam itens" ON public.acolitos_chamadas_itens USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text, 'cerimonario'::text])));


--
-- Name: acolitos_missao_progresso Equipe gere progresso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gere progresso" ON public.acolitos_missao_progresso USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_temporadas Equipe gere temporadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gere temporadas" ON public.acolitos_temporadas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_casas Equipe gerencia casas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia casas" ON public.acolitos_casas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_celebracoes Equipe gerencia celebracoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia celebracoes" ON public.acolitos_celebracoes USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_crm Equipe gerencia crm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia crm" ON public.acolitos_crm USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_disponibilidade Equipe gerencia disp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia disp" ON public.acolitos_disponibilidade USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_escalas Equipe gerencia escalas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia escalas" ON public.acolitos_escalas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_eventos Equipe gerencia eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia eventos" ON public.acolitos_eventos USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_financeiro Equipe gerencia financeiro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia financeiro" ON public.acolitos_financeiro USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_habilitacoes Equipe gerencia hab; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia hab" ON public.acolitos_habilitacoes USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_listas Equipe gerencia listas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia listas" ON public.acolitos_listas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_membros Equipe gerencia membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia membros" ON public.acolitos_membros USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_modelos Equipe gerencia modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia modelos" ON public.acolitos_modelos USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_evento_presencas Equipe gerencia presencas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe gerencia presencas" ON public.acolitos_evento_presencas USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_crm_historico Equipe le historico crm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe le historico crm" ON public.acolitos_crm_historico USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_missao_progresso Equipe le progresso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe le progresso" ON public.acolitos_missao_progresso FOR SELECT USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_ausencias Equipe le todas ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe le todas ausencias" ON public.acolitos_ausencias USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_membros Equipe le todos membros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe le todos membros" ON public.acolitos_membros FOR SELECT USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: pastoral_members Equipe le todos vinculos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Equipe le todos vinculos" ON public.pastoral_members FOR SELECT USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_membros Familia edita irmaos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Familia edita irmaos" ON public.acolitos_membros FOR UPDATE USING (((grupo_irmaos IS NOT NULL) AND (grupo_irmaos = public.acolitos_meu_grupo()))) WITH CHECK (((grupo_irmaos IS NOT NULL) AND (grupo_irmaos = public.acolitos_meu_grupo())));


--
-- Name: acolitos_ausencias Familia gerencia ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Familia gerencia ausencias" ON public.acolitos_ausencias USING ((membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.grupo_irmaos = public.acolitos_meu_grupo())))) WITH CHECK ((membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.grupo_irmaos = public.acolitos_meu_grupo()))));


--
-- Name: acolitos_disponibilidade Familia gerencia disponibilidade; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Familia gerencia disponibilidade" ON public.acolitos_disponibilidade USING ((membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.grupo_irmaos = public.acolitos_meu_grupo())))) WITH CHECK ((membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.grupo_irmaos = public.acolitos_meu_grupo()))));


--
-- Name: acolitos_membros Familia ve irmaos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Familia ve irmaos" ON public.acolitos_membros FOR SELECT USING (((grupo_irmaos IS NOT NULL) AND (grupo_irmaos = public.acolitos_meu_grupo())));


--
-- Name: acolitos_ausencias Membro atualiza propria ausencia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro atualiza propria ausencia" ON public.acolitos_ausencias FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_ausencias.membro_id) AND (m.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_ausencias.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_escalas Membro atualiza propria escala; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro atualiza propria escala" ON public.acolitos_escalas FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_escalas.membro_id) AND (m.user_id = auth.uid()))))) WITH CHECK ((status = 'ausente_justificado'::text));


--
-- Name: acolitos_membros Membro atualiza proprio registro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro atualiza proprio registro" ON public.acolitos_membros FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: acolitos_ausencias Membro cancela propria ausencia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro cancela propria ausencia" ON public.acolitos_ausencias FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_ausencias.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_ausencias Membro insere propria ausencia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro insere propria ausencia" ON public.acolitos_ausencias FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_ausencias.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: pastoral_members Membro insere proprio vinculo como novo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro insere proprio vinculo como novo" ON public.pastoral_members FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = 'novo'::text)));


--
-- Name: acolitos_disponibilidade Membro le propria disp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le propria disp" ON public.acolitos_disponibilidade FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_disponibilidade.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_ausencias Membro le proprias ausencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le proprias ausencias" ON public.acolitos_ausencias FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_ausencias.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_habilitacoes Membro le proprias hab; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le proprias hab" ON public.acolitos_habilitacoes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_habilitacoes.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_crm Membro le proprio crm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le proprio crm" ON public.acolitos_crm FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_crm.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_missao_progresso Membro le proprio progresso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le proprio progresso" ON public.acolitos_missao_progresso FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.acolitos_membros m
  WHERE ((m.id = acolitos_missao_progresso.membro_id) AND (m.user_id = auth.uid())))));


--
-- Name: acolitos_membros Membro le proprio registro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Membro le proprio registro" ON public.acolitos_membros FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: acolitos_liturgia_override Override escrita coordenacao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Override escrita coordenacao" ON public.acolitos_liturgia_override TO authenticated USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text])));


--
-- Name: acolitos_liturgia_override Override leitura autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Override leitura autenticada" ON public.acolitos_liturgia_override FOR SELECT TO authenticated USING (true);


--
-- Name: acolitos_push_subs Push subs do próprio dono; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Push subs do próprio dono" ON public.acolitos_push_subs TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: acolitos_missoes Superadmin gere missoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin gere missoes" ON public.acolitos_missoes USING (public.acolitos_is_superadmin(auth.uid())) WITH CHECK (public.acolitos_is_superadmin(auth.uid()));


--
-- Name: acolitos_config Superadmin gerencia config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin gerencia config" ON public.acolitos_config USING (public.acolitos_is_superadmin(auth.uid())) WITH CHECK (public.acolitos_is_superadmin(auth.uid()));


--
-- Name: acolitos_tarefas Tarefas escrita coordenacao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tarefas escrita coordenacao" ON public.acolitos_tarefas TO authenticated USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text]))) WITH CHECK ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: acolitos_tarefas Tarefas leitura coordenacao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tarefas leitura coordenacao" ON public.acolitos_tarefas FOR SELECT TO authenticated USING ((public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text])));


--
-- Name: profiles Usuario le proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario le proprio perfil" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: pastoral_members Usuario le proprio vinculo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario le proprio vinculo" ON public.pastoral_members FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: access_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_ausencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_ausencias ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_ausencias_pendentes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_ausencias_pendentes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_campeoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_campeoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_casas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_casas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_celebracoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_celebracoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_chamadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_chamadas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_chamadas_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_chamadas_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_config ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_crm; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_crm ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_crm_historico; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_crm_historico ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_disponibilidade; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_disponibilidade ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_escala_artes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_escala_artes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_escalas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_escalas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_evento_presencas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_evento_presencas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_financeiro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_hab_pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_hab_pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_habilitacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_habilitacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_listas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_listas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_liturgia_override; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_liturgia_override ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_logins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_logins ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_membros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_membros ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_missao_progresso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_missao_progresso ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_missoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_missoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_modelos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_modelos ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_presencas_avulsas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_presencas_avulsas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_push_subs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_push_subs ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_semana_override; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_semana_override ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_solicitacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_solicitacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_substituto_creditos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_substituto_creditos ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_tarefas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_tarefas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_temporadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_temporadas ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_xp_temporada; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acolitos_xp_temporada ENABLE ROW LEVEL SECURITY;

--
-- Name: group_tools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_tools ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: pastoral_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pastoral_members ENABLE ROW LEVEL SECURITY;

--
-- Name: pastoral_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pastoral_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: acolitos_solicitacoes solic_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY solic_select ON public.acolitos_solicitacoes FOR SELECT USING (((membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.user_id = auth.uid()))) OR (alvo_membro_id IN ( SELECT acolitos_membros.id
   FROM public.acolitos_membros
  WHERE (acolitos_membros.user_id = auth.uid()))) OR (public.acolitos_get_role(auth.uid()) = ANY (ARRAY['coord_admin'::text, 'subadmin'::text, 'membro_equipe'::text, 'cerimonario'::text]))));


--
-- Name: tools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _acolitos_medalha_ao_apto(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._acolitos_medalha_ao_apto() FROM PUBLIC;
GRANT ALL ON FUNCTION public._acolitos_medalha_ao_apto() TO service_role;


--
-- Name: FUNCTION _acolitos_semana_str(p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._acolitos_semana_str(p_offset integer) TO anon;
GRANT ALL ON FUNCTION public._acolitos_semana_str(p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public._acolitos_semana_str(p_offset integer) TO service_role;


--
-- Name: FUNCTION _prof_rank(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._prof_rank(p text) TO anon;
GRANT ALL ON FUNCTION public._prof_rank(p text) TO authenticated;
GRANT ALL ON FUNCTION public._prof_rank(p text) TO service_role;


--
-- Name: FUNCTION acolitos_aplicar_troca_escala(p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_aplicar_troca_escala(p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_aplicar_troca_escala(p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_aplicar_troca_escala(p_celebracao_id uuid, p_membro_ausente_id uuid, p_novo_membro_id uuid) TO service_role;


--
-- Name: FUNCTION acolitos_ausencia_pendente_count(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ausencia_pendente_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_count() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_count() TO service_role;


--
-- Name: FUNCTION acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_decidir(p_ids uuid[], p_acao text) TO service_role;


--
-- Name: FUNCTION acolitos_ausencia_pendente_listar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ausencia_pendente_listar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_listar() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_pendente_listar() TO service_role;


--
-- Name: FUNCTION acolitos_ausencia_publica_buscar(p_q text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_buscar(p_q text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_buscar(p_q text) TO service_role;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_buscar(p_q text) TO anon;


--
-- Name: FUNCTION acolitos_ausencia_publica_celebracoes(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_celebracoes() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_celebracoes() TO service_role;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_celebracoes() TO anon;


--
-- Name: FUNCTION acolitos_ausencia_publica_enviar(p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_enviar(p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_enviar(p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text) TO service_role;
GRANT ALL ON FUNCTION public.acolitos_ausencia_publica_enviar(p_membros uuid[], p_celebracoes uuid[], p_motivo text, p_informante text, p_contato text) TO anon;


--
-- Name: FUNCTION acolitos_avaliar_missoes(p_membro uuid, p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_avaliar_missoes(p_membro uuid, p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_avaliar_missoes(p_membro uuid, p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_avaliar_missoes(p_membro uuid, p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_avulso_add(p_celebracao uuid, p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_avulso_add(p_celebracao uuid, p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_avulso_add(p_celebracao uuid, p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_avulso_add(p_celebracao uuid, p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_avulso_remove(p_celebracao uuid, p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_avulso_remove(p_celebracao uuid, p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_avulso_remove(p_celebracao uuid, p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_avulso_remove(p_celebracao uuid, p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_avulsos_celebracao(p_celebracao uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_avulsos_celebracao(p_celebracao uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_avulsos_celebracao(p_celebracao uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_avulsos_celebracao(p_celebracao uuid) TO service_role;


--
-- Name: FUNCTION acolitos_badge_cumpre(p_membro uuid, c jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_badge_cumpre(p_membro uuid, c jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_badge_cumpre(p_membro uuid, c jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_badge_cumpre(p_membro uuid, c jsonb) TO service_role;


--
-- Name: FUNCTION acolitos_badges_membro(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_badges_membro(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_badges_membro(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_badges_membro(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_campeoes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_campeoes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_campeoes() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_campeoes() TO service_role;


--
-- Name: FUNCTION acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text) TO service_role;


--
-- Name: FUNCTION acolitos_chamada_responsavel(p_celebracao uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_chamada_responsavel(p_celebracao uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_chamada_responsavel(p_celebracao uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_chamada_responsavel(p_celebracao uuid) TO service_role;


--
-- Name: FUNCTION acolitos_colegas_casa(p_casa uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_colegas_casa(p_casa uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_colegas_casa(p_casa uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_colegas_casa(p_casa uuid) TO service_role;


--
-- Name: FUNCTION acolitos_competencias_progresso(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_competencias_progresso(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_competencias_progresso(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_competencias_progresso(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_controla_membro(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_controla_membro(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_controla_membro(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_controla_membro(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_cred_temp(p_membro uuid, p_xp integer, p_origem text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_cred_temp(p_membro uuid, p_xp integer, p_origem text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_cred_temp(p_membro uuid, p_xp integer, p_origem text) TO service_role;


--
-- Name: FUNCTION acolitos_desfazer_troca_escala(p_alvo_id uuid, p_novo_escala_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_desfazer_troca_escala(p_alvo_id uuid, p_novo_escala_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_desfazer_troca_escala(p_alvo_id uuid, p_novo_escala_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_desfazer_troca_escala(p_alvo_id uuid, p_novo_escala_id uuid) TO service_role;


--
-- Name: FUNCTION acolitos_destaques(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_destaques() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_destaques() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_destaques() TO service_role;


--
-- Name: FUNCTION acolitos_ensaio_ajudantes(p_evento uuid, p_ajudantes uuid[], p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ensaio_ajudantes(p_evento uuid, p_ajudantes uuid[], p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ensaio_ajudantes(p_evento uuid, p_ajudantes uuid[], p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ensaio_ajudantes(p_evento uuid, p_ajudantes uuid[], p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_ensaio_chamada(p_evento uuid, p_presentes uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ensaio_chamada(p_evento uuid, p_presentes uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ensaio_chamada(p_evento uuid, p_presentes uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ensaio_chamada(p_evento uuid, p_presentes uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_ensaio_convocados(p_evento uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ensaio_convocados(p_evento uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ensaio_convocados(p_evento uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ensaio_convocados(p_evento uuid) TO service_role;


--
-- Name: FUNCTION acolitos_escalas_futuras(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_escalas_futuras() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_escalas_futuras() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_escalas_futuras() TO service_role;


--
-- Name: FUNCTION acolitos_escalas_passadas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_escalas_passadas() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_escalas_passadas() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_escalas_passadas() TO service_role;


--
-- Name: FUNCTION acolitos_estrelas(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_estrelas(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_estrelas(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_estrelas(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_estrelas_lote(p_membros uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_estrelas_lote(p_membros uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_estrelas_lote(p_membros uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_estrelas_lote(p_membros uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_faltas_recentes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_faltas_recentes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_faltas_recentes() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_faltas_recentes() TO service_role;


--
-- Name: FUNCTION acolitos_get_role(uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_get_role(uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_get_role(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_get_role(uid uuid) TO service_role;


--
-- Name: FUNCTION acolitos_hab_decidir(p_pedido uuid, p_decisao text, p_obs text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_hab_decidir(p_pedido uuid, p_decisao text, p_obs text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_hab_decidir(p_pedido uuid, p_decisao text, p_obs text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_hab_decidir(p_pedido uuid, p_decisao text, p_obs text) TO service_role;


--
-- Name: FUNCTION acolitos_hab_fila(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_hab_fila() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_hab_fila() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_hab_fila() TO service_role;


--
-- Name: FUNCTION acolitos_hab_pedidos_meus(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_hab_pedidos_meus(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_hab_pedidos_meus(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_hab_pedidos_meus(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_hab_pedir(p_membro uuid, p_funcao text, p_label text, p_evidencia text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_hab_pedir(p_membro uuid, p_funcao text, p_label text, p_evidencia text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_hab_pedir(p_membro uuid, p_funcao text, p_label text, p_evidencia text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_hab_pedir(p_membro uuid, p_funcao text, p_label text, p_evidencia text) TO service_role;


--
-- Name: FUNCTION acolitos_hab_revisoes_minhas(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_hab_revisoes_minhas(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_hab_revisoes_minhas(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_hab_revisoes_minhas(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_habilitados_funcao(p_funcao text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_habilitados_funcao(p_funcao text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_habilitados_funcao(p_funcao text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_habilitados_funcao(p_funcao text) TO service_role;


--
-- Name: FUNCTION acolitos_is_superadmin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_is_superadmin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_is_superadmin() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_is_superadmin() TO service_role;


--
-- Name: FUNCTION acolitos_is_superadmin(uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_is_superadmin(uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_is_superadmin(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_is_superadmin(uid uuid) TO service_role;


--
-- Name: FUNCTION acolitos_limpar_chamada(p_celebracao uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_limpar_chamada(p_celebracao uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_limpar_chamada(p_celebracao uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_limpar_chamada(p_celebracao uuid) TO service_role;


--
-- Name: FUNCTION acolitos_link_irmaos(p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_link_irmaos(p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_link_irmaos(p_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_link_irmaos(p_ids uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_login_registrar(p_membro uuid, p_usuario text, p_senha text) TO service_role;


--
-- Name: FUNCTION acolitos_logins_listar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_logins_listar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_logins_listar() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_logins_listar() TO service_role;


--
-- Name: FUNCTION acolitos_medalhas_avaliar(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_medalhas_avaliar(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_medalhas_avaliar(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_medalhas_avaliar(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_membro_card(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_membro_card(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_membro_card(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_membro_card(p_id uuid) TO service_role;


--
-- Name: FUNCTION acolitos_membros_display(p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_membros_display(p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_membros_display(p_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_membros_display(p_ids uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_membros_por_setor(p_setores text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_membros_por_setor(p_setores text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_membros_por_setor(p_setores text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_membros_por_setor(p_setores text[]) TO service_role;


--
-- Name: FUNCTION acolitos_meu_grupo(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_meu_grupo() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_meu_grupo() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_meu_grupo() TO service_role;


--
-- Name: FUNCTION acolitos_meu_membro_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_meu_membro_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_meu_membro_id() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_meu_membro_id() TO service_role;


--
-- Name: FUNCTION acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_missao_decidir(p_missao uuid, p_membro uuid, p_decisao text, p_obs text) TO service_role;


--
-- Name: FUNCTION acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_missao_reivindicar(p_missao uuid, p_evidencia text, p_envolvidos uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_missao_semana(p_membro uuid, p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_missao_semana(p_membro uuid, p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_missao_semana(p_membro uuid, p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_missao_semana(p_membro uuid, p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_missoes_board(p_membro uuid, p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_missoes_board(p_membro uuid, p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_missoes_board(p_membro uuid, p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_missoes_board(p_membro uuid, p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_missoes_fila(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_missoes_fila() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_missoes_fila() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_missoes_fila() TO service_role;


--
-- Name: FUNCTION acolitos_prof_ok(p_membro uuid, p_funcoes jsonb, p_prof text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_prof_ok(p_membro uuid, p_funcoes jsonb, p_prof text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_prof_ok(p_membro uuid, p_funcoes jsonb, p_prof text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_prof_ok(p_membro uuid, p_funcoes jsonb, p_prof text) TO service_role;


--
-- Name: FUNCTION acolitos_progresso_criterio(p_membro uuid, c jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_progresso_criterio(p_membro uuid, c jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_progresso_criterio(p_membro uuid, c jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_progresso_criterio(p_membro uuid, c jsonb) TO service_role;


--
-- Name: FUNCTION acolitos_promocoes_pendentes(p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_promocoes_pendentes(p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_promocoes_pendentes(p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_promocoes_pendentes(p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_promover(p_membro uuid, p_novo_nivel text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_promover(p_membro uuid, p_novo_nivel text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_promover(p_membro uuid, p_novo_nivel text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_promover(p_membro uuid, p_novo_nivel text) TO service_role;


--
-- Name: FUNCTION acolitos_quase_la(p_niveis text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_quase_la(p_niveis text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_quase_la(p_niveis text[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_quase_la(p_niveis text[]) TO service_role;


--
-- Name: FUNCTION acolitos_quest_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_niveis text[], p_expira date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_quest_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_niveis text[], p_expira date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_quest_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_niveis text[], p_expira date) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_quest_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_niveis text[], p_expira date) TO service_role;


--
-- Name: FUNCTION acolitos_quests_exclusivas(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_quests_exclusivas(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_quests_exclusivas(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_quests_exclusivas(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_ranking_temporada(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_ranking_temporada() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_ranking_temporada() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_ranking_temporada() TO service_role;


--
-- Name: FUNCTION acolitos_responsaveis_de_tarefa(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_responsaveis_de_tarefa() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_responsaveis_de_tarefa() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_responsaveis_de_tarefa() TO service_role;


--
-- Name: FUNCTION acolitos_revisoes_minhas(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_revisoes_minhas(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_revisoes_minhas(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_revisoes_minhas(p_membro uuid) TO service_role;


--
-- Name: FUNCTION acolitos_roster_nomes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_roster_nomes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_roster_nomes() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_roster_nomes() TO service_role;


--
-- Name: FUNCTION acolitos_roster_substituicao(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_roster_substituicao() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_roster_substituicao() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_roster_substituicao() TO service_role;


--
-- Name: FUNCTION acolitos_semana_agenda(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_agenda() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_agenda() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_agenda() TO service_role;


--
-- Name: FUNCTION acolitos_semana_atual(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_atual() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_atual() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_atual() TO service_role;


--
-- Name: FUNCTION acolitos_semana_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_tema text, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_tema text, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_tema text, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_criar(p_titulo text, p_descricao text, p_xp integer, p_validacao text, p_tema text, p_offset integer) TO service_role;


--
-- Name: FUNCTION acolitos_semana_definir(p_missao uuid, p_tema text, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_definir(p_missao uuid, p_tema text, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_definir(p_missao uuid, p_tema text, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_definir(p_missao uuid, p_tema text, p_offset integer) TO service_role;


--
-- Name: FUNCTION acolitos_semana_limpar(p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_limpar(p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_limpar(p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_limpar(p_offset integer) TO service_role;


--
-- Name: FUNCTION acolitos_semana_remover(p_semana text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_semana_remover(p_semana text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_semana_remover(p_semana text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_semana_remover(p_semana text) TO service_role;


--
-- Name: FUNCTION acolitos_set_admin_role(p_user uuid, p_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_set_admin_role(p_user uuid, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_set_admin_role(p_user uuid, p_role text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_set_admin_role(p_user uuid, p_role text) TO service_role;


--
-- Name: FUNCTION acolitos_solicitacao_cancelar(p_solicitacao_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid) TO service_role;


--
-- Name: FUNCTION acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid) TO service_role;


--
-- Name: FUNCTION acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid) TO service_role;


--
-- Name: FUNCTION acolitos_solicitacoes_membro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitacoes_membro() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitacoes_membro() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitacoes_membro() TO service_role;


--
-- Name: FUNCTION acolitos_solicitacoes_pendentes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitacoes_pendentes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitacoes_pendentes() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitacoes_pendentes() TO service_role;


--
-- Name: FUNCTION acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION acolitos_solicitos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_solicitos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_solicitos() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_solicitos() TO service_role;


--
-- Name: FUNCTION acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_substituir_ausente(p_membros uuid[], p_celebracoes uuid[]) TO service_role;


--
-- Name: FUNCTION acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_substituto_creditar(p_celebracao uuid, p_substituto uuid) TO service_role;


--
-- Name: FUNCTION acolitos_temporada_abrir(p_nome text, p_inicio date, p_fim date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_temporada_abrir(p_nome text, p_inicio date, p_fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_temporada_abrir(p_nome text, p_inicio date, p_fim date) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_temporada_abrir(p_nome text, p_inicio date, p_fim date) TO service_role;


--
-- Name: FUNCTION acolitos_temporada_fechar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_temporada_fechar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_temporada_fechar() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_temporada_fechar() TO service_role;


--
-- Name: FUNCTION acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean) TO service_role;


--
-- Name: FUNCTION acolitos_vagas_abertas_membro(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_vagas_abertas_membro() FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_vagas_abertas_membro() TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_vagas_abertas_membro() TO service_role;


--
-- Name: FUNCTION acolitos_xp_hoje(p_membro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acolitos_xp_hoje(p_membro uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acolitos_xp_hoje(p_membro uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acolitos_xp_hoje(p_membro uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_central_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_central_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_central_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_central_admin() TO service_role;


--
-- Name: TABLE access_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.access_requests TO anon;
GRANT ALL ON TABLE public.access_requests TO authenticated;
GRANT ALL ON TABLE public.access_requests TO service_role;


--
-- Name: TABLE acolitos_ausencias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_ausencias TO anon;
GRANT ALL ON TABLE public.acolitos_ausencias TO authenticated;
GRANT ALL ON TABLE public.acolitos_ausencias TO service_role;


--
-- Name: TABLE acolitos_ausencias_pendentes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_ausencias_pendentes TO anon;
GRANT ALL ON TABLE public.acolitos_ausencias_pendentes TO authenticated;
GRANT ALL ON TABLE public.acolitos_ausencias_pendentes TO service_role;


--
-- Name: TABLE acolitos_campeoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_campeoes TO anon;
GRANT ALL ON TABLE public.acolitos_campeoes TO authenticated;
GRANT ALL ON TABLE public.acolitos_campeoes TO service_role;


--
-- Name: TABLE acolitos_casas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_casas TO anon;
GRANT ALL ON TABLE public.acolitos_casas TO authenticated;
GRANT ALL ON TABLE public.acolitos_casas TO service_role;


--
-- Name: TABLE acolitos_celebracoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_celebracoes TO anon;
GRANT ALL ON TABLE public.acolitos_celebracoes TO authenticated;
GRANT ALL ON TABLE public.acolitos_celebracoes TO service_role;


--
-- Name: TABLE acolitos_chamadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_chamadas TO anon;
GRANT ALL ON TABLE public.acolitos_chamadas TO authenticated;
GRANT ALL ON TABLE public.acolitos_chamadas TO service_role;


--
-- Name: TABLE acolitos_chamadas_itens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_chamadas_itens TO anon;
GRANT ALL ON TABLE public.acolitos_chamadas_itens TO authenticated;
GRANT ALL ON TABLE public.acolitos_chamadas_itens TO service_role;


--
-- Name: TABLE acolitos_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_config TO anon;
GRANT ALL ON TABLE public.acolitos_config TO authenticated;
GRANT ALL ON TABLE public.acolitos_config TO service_role;


--
-- Name: TABLE acolitos_crm; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_crm TO anon;
GRANT ALL ON TABLE public.acolitos_crm TO authenticated;
GRANT ALL ON TABLE public.acolitos_crm TO service_role;


--
-- Name: TABLE acolitos_crm_historico; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_crm_historico TO anon;
GRANT ALL ON TABLE public.acolitos_crm_historico TO authenticated;
GRANT ALL ON TABLE public.acolitos_crm_historico TO service_role;


--
-- Name: TABLE acolitos_disponibilidade; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_disponibilidade TO anon;
GRANT ALL ON TABLE public.acolitos_disponibilidade TO authenticated;
GRANT ALL ON TABLE public.acolitos_disponibilidade TO service_role;


--
-- Name: TABLE acolitos_escala_artes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_escala_artes TO anon;
GRANT ALL ON TABLE public.acolitos_escala_artes TO authenticated;
GRANT ALL ON TABLE public.acolitos_escala_artes TO service_role;


--
-- Name: TABLE acolitos_escalas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_escalas TO anon;
GRANT ALL ON TABLE public.acolitos_escalas TO authenticated;
GRANT ALL ON TABLE public.acolitos_escalas TO service_role;


--
-- Name: TABLE acolitos_evento_presencas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_evento_presencas TO anon;
GRANT ALL ON TABLE public.acolitos_evento_presencas TO authenticated;
GRANT ALL ON TABLE public.acolitos_evento_presencas TO service_role;


--
-- Name: TABLE acolitos_eventos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_eventos TO anon;
GRANT ALL ON TABLE public.acolitos_eventos TO authenticated;
GRANT ALL ON TABLE public.acolitos_eventos TO service_role;


--
-- Name: TABLE acolitos_financeiro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_financeiro TO anon;
GRANT ALL ON TABLE public.acolitos_financeiro TO authenticated;
GRANT ALL ON TABLE public.acolitos_financeiro TO service_role;


--
-- Name: TABLE acolitos_frequencia; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.acolitos_frequencia TO anon;
GRANT ALL ON TABLE public.acolitos_frequencia TO authenticated;
GRANT ALL ON TABLE public.acolitos_frequencia TO service_role;


--
-- Name: TABLE acolitos_hab_pedidos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_hab_pedidos TO anon;
GRANT ALL ON TABLE public.acolitos_hab_pedidos TO authenticated;
GRANT ALL ON TABLE public.acolitos_hab_pedidos TO service_role;


--
-- Name: TABLE acolitos_habilitacoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_habilitacoes TO anon;
GRANT ALL ON TABLE public.acolitos_habilitacoes TO authenticated;
GRANT ALL ON TABLE public.acolitos_habilitacoes TO service_role;


--
-- Name: TABLE acolitos_listas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_listas TO anon;
GRANT ALL ON TABLE public.acolitos_listas TO authenticated;
GRANT ALL ON TABLE public.acolitos_listas TO service_role;


--
-- Name: TABLE acolitos_liturgia_override; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_liturgia_override TO anon;
GRANT ALL ON TABLE public.acolitos_liturgia_override TO authenticated;
GRANT ALL ON TABLE public.acolitos_liturgia_override TO service_role;


--
-- Name: TABLE acolitos_logins; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_logins TO anon;
GRANT ALL ON TABLE public.acolitos_logins TO authenticated;
GRANT ALL ON TABLE public.acolitos_logins TO service_role;


--
-- Name: TABLE acolitos_membros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_membros TO anon;
GRANT ALL ON TABLE public.acolitos_membros TO authenticated;
GRANT ALL ON TABLE public.acolitos_membros TO service_role;


--
-- Name: TABLE acolitos_missao_progresso; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_missao_progresso TO anon;
GRANT ALL ON TABLE public.acolitos_missao_progresso TO authenticated;
GRANT ALL ON TABLE public.acolitos_missao_progresso TO service_role;


--
-- Name: TABLE acolitos_missoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_missoes TO anon;
GRANT ALL ON TABLE public.acolitos_missoes TO authenticated;
GRANT ALL ON TABLE public.acolitos_missoes TO service_role;


--
-- Name: TABLE acolitos_modelos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_modelos TO anon;
GRANT ALL ON TABLE public.acolitos_modelos TO authenticated;
GRANT ALL ON TABLE public.acolitos_modelos TO service_role;


--
-- Name: TABLE acolitos_presencas_avulsas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_presencas_avulsas TO anon;
GRANT ALL ON TABLE public.acolitos_presencas_avulsas TO authenticated;
GRANT ALL ON TABLE public.acolitos_presencas_avulsas TO service_role;


--
-- Name: TABLE acolitos_push_subs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_push_subs TO anon;
GRANT ALL ON TABLE public.acolitos_push_subs TO authenticated;
GRANT ALL ON TABLE public.acolitos_push_subs TO service_role;


--
-- Name: TABLE acolitos_semana_override; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_semana_override TO anon;
GRANT ALL ON TABLE public.acolitos_semana_override TO authenticated;
GRANT ALL ON TABLE public.acolitos_semana_override TO service_role;


--
-- Name: TABLE acolitos_solicitacoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_solicitacoes TO anon;
GRANT ALL ON TABLE public.acolitos_solicitacoes TO authenticated;
GRANT ALL ON TABLE public.acolitos_solicitacoes TO service_role;


--
-- Name: TABLE acolitos_substituto_creditos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_substituto_creditos TO anon;
GRANT ALL ON TABLE public.acolitos_substituto_creditos TO authenticated;
GRANT ALL ON TABLE public.acolitos_substituto_creditos TO service_role;


--
-- Name: TABLE acolitos_tarefas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_tarefas TO authenticated;
GRANT ALL ON TABLE public.acolitos_tarefas TO service_role;


--
-- Name: TABLE acolitos_temporadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_temporadas TO anon;
GRANT ALL ON TABLE public.acolitos_temporadas TO authenticated;
GRANT ALL ON TABLE public.acolitos_temporadas TO service_role;


--
-- Name: TABLE acolitos_xp_temporada; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.acolitos_xp_temporada TO anon;
GRANT ALL ON TABLE public.acolitos_xp_temporada TO authenticated;
GRANT ALL ON TABLE public.acolitos_xp_temporada TO service_role;


--
-- Name: TABLE group_tools; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.group_tools TO anon;
GRANT ALL ON TABLE public.group_tools TO authenticated;
GRANT ALL ON TABLE public.group_tools TO service_role;


--
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.groups TO anon;
GRANT ALL ON TABLE public.groups TO authenticated;
GRANT ALL ON TABLE public.groups TO service_role;


--
-- Name: TABLE pastoral_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pastoral_members TO anon;
GRANT ALL ON TABLE public.pastoral_members TO authenticated;
GRANT ALL ON TABLE public.pastoral_members TO service_role;


--
-- Name: TABLE pastoral_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pastoral_modules TO anon;
GRANT ALL ON TABLE public.pastoral_modules TO authenticated;
GRANT ALL ON TABLE public.pastoral_modules TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE tools; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tools TO anon;
GRANT ALL ON TABLE public.tools TO authenticated;
GRANT ALL ON TABLE public.tools TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict YrDvTceW7O1t9MlqtuRWggxKTN8veSx8rRgeTcEyDyquebeLUxEcecD3ZIqfhcD


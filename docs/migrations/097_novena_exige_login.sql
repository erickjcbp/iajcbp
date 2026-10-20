-- 097 — Novena: marcar, trocar e sair da escala exige login (2026-10-20)
--
-- Antes: as 3 funções do /novena aceitavam chamada ANÔNIMA só com o id do membro. A busca
-- pública por nome devolve esse id, então qualquer pessoa podia tirar outra da escala da
-- novena, trocar a função dela ou inscrevê-la em missas.
-- Agora: só age quem está logado e é o próprio servo, alguém da mesma família (grupo_irmaos)
-- ou a equipe — a mesma regra da acolitos_substituir_ausente. Os 171 servos ativos têm login.

create or replace function public.acolitos_novena_pode_agir(p_membro_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select auth.uid() is not null and p_membro_id is not null and (
    acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe')
    or exists (select 1 from acolitos_membros where id = p_membro_id and user_id = auth.uid())
    or exists (select 1 from acolitos_membros me join acolitos_membros tgt on tgt.grupo_irmaos = me.grupo_irmaos
               where me.user_id = auth.uid() and me.grupo_irmaos is not null and tgt.id = p_membro_id));
$$;
revoke all on function public.acolitos_novena_pode_agir(uuid) from public, anon;
grant execute on function public.acolitos_novena_pode_agir(uuid) to authenticated;


CREATE OR REPLACE FUNCTION public.acolitos_novena_publica_missas(p_membro_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb;
begin
  if not public.acolitos_novena_pode_agir(p_membro_id) then return '[]'::jsonb; end if;
  if p_membro_id is null
     or not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo') then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade,
           'local_nome', nullif(btrim(substring(c.observacoes from E'Local: ([^\\r\\n]+)')), ''),
           'minha_funcao', (select e.funcao from public.acolitos_escalas e
                            where e.celebracao_id = c.id and e.membro_id = p_membro_id and e.status = 'escalado' limit 1),
           'funcoes', coalesce((
             select jsonb_agg(jsonb_build_object('funcao', mo.funcao,
                      'restantes', mo.quantidade - (select count(*) from public.acolitos_escalas e3
                                                    where e3.celebracao_id = c.id and e3.funcao = mo.funcao and e3.status = 'escalado'))
                    order by coalesce(array_position(array['cred_altar','cred_credencia','missal','altar','cruz','sineta','sinao','vela','apoio'], mo.funcao), 99))
             from public.acolitos_modelos mo
             join public.acolitos_habilitacoes h on h.membro_id = p_membro_id and h.funcao = mo.funcao
             where mo.tipo = c.tipo and mo.comunidade = c.comunidade
               and mo.quantidade > (select count(*) from public.acolitos_escalas e4
                                    where e4.celebracao_id = c.id and e4.funcao = mo.funcao and e4.status = 'escalado')
           ), '[]'::jsonb),
           'lotada', not exists (
             select 1 from public.acolitos_modelos mo
             where mo.tipo = c.tipo and mo.comunidade = c.comunidade and mo.quantidade >
               (select count(*) from public.acolitos_escalas e2
                where e2.celebracao_id = c.id and e2.funcao = mo.funcao and e2.status = 'escalado'))
         ) order by c.data, c.minutos), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  where c.data >= current_date and (c.novena_publica or c.observacoes ilike 'Novena%');
  return v_out;
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_novena_publica_enviar(p_membro_id uuid, p_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  it jsonb; v_pedida text; v_cel uuid; c public.acolitos_celebracoes%rowtype; v_fn text; v_cerimo boolean;
  v_ordem text[] := array['cred_altar','cred_credencia','missal','altar','cruz','sineta','sinao','vela','apoio'];
  v_postos jsonb := '[]'::jsonb; v_pulados jsonb := '[]'::jsonb;
begin
  if not public.acolitos_novena_pode_agir(p_membro_id) then return jsonb_build_object('erro','sem_login'); end if;
  if p_membro_id is null or p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if jsonb_array_length(p_itens) > 15 then return jsonb_build_object('erro','muitos_itens'); end if;
  if not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo' and serve) then
    return jsonb_build_object('erro','membro_invalido');
  end if;
  select exists (select 1 from public.acolitos_habilitacoes
                 where membro_id = p_membro_id and funcao in ('cred_altar','cred_credencia','missal')) into v_cerimo;

  for it in select * from jsonb_array_elements(p_itens) loop
    begin v_cel := (it->>'celebracao_id')::uuid; exception when others then v_cel := null; end;
    v_pedida := nullif(it->>'funcao','');
    if v_cel is null or exists (select 1 from jsonb_array_elements(v_postos) q where (q->>'celebracao_id')::uuid = v_cel) then continue; end if;
    -- trava a celebração: dois links concorrentes não passam da quantidade do modelo
    select * into c from public.acolitos_celebracoes
      where id = v_cel and data >= current_date and (novena_publica or observacoes ilike 'Novena%') for update;
    if c.id is null then v_pulados := v_pulados || jsonb_build_object('celebracao_id',v_cel,'motivo','invalida'); continue; end if;
    if exists (select 1 from public.acolitos_escalas
               where celebracao_id = c.id and membro_id = p_membro_id and status = 'escalado') then
      v_pulados := v_pulados || jsonb_build_object('celebracao_id',c.id,'motivo','ja_escalado'); continue;
    end if;

    select mo.funcao into v_fn
    from public.acolitos_modelos mo
    join public.acolitos_habilitacoes h on h.membro_id = p_membro_id and h.funcao = mo.funcao
    where mo.tipo = c.tipo and mo.comunidade = c.comunidade
      and mo.quantidade > (select count(*) from public.acolitos_escalas e
                           where e.celebracao_id = c.id and e.funcao = mo.funcao and e.status = 'escalado')
      and (v_pedida is not null or not (v_cerimo and mo.funcao = 'apoio'))
      and (v_pedida is null or mo.funcao = v_pedida)
    order by coalesce(array_position(v_ordem, mo.funcao), 99)
    limit 1;

    if v_fn is null then v_pulados := v_pulados || jsonb_build_object('celebracao_id',c.id,'motivo','sem_vaga'); continue; end if;

    insert into public.acolitos_escalas(celebracao_id, membro_id, funcao, status)
    values (c.id, p_membro_id, v_fn, 'escalado');
    v_postos := v_postos || jsonb_build_object('celebracao_id',c.id,'data',c.data,'horario',c.horario,'funcao',v_fn);
  end loop;

  if jsonb_array_length(v_postos) = 0 then
    return jsonb_build_object('erro','sem_itens_validos','pulados',v_pulados);
  end if;
  return jsonb_build_object('ok', true, 'postos', v_postos, 'pulados', v_pulados);
end; $function$
;
CREATE OR REPLACE FUNCTION public.acolitos_novena_publica_alterar(p_membro_id uuid, p_celebracao_id uuid, p_acao text, p_funcao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.acolitos_celebracoes%rowtype; e public.acolitos_escalas%rowtype;
begin
  if not public.acolitos_novena_pode_agir(p_membro_id) then return jsonb_build_object('erro','sem_login'); end if;
  if p_membro_id is null or p_celebracao_id is null or p_acao not in ('trocar','sair') then
    return jsonb_build_object('erro','pedido_invalido');
  end if;
  if not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo' and serve) then
    return jsonb_build_object('erro','membro_invalido');
  end if;
  select * into c from public.acolitos_celebracoes
    where id = p_celebracao_id and data >= current_date and (novena_publica or observacoes ilike 'Novena%') for update;
  if c.id is null then return jsonb_build_object('erro','invalida'); end if;
  select * into e from public.acolitos_escalas
    where celebracao_id = c.id and membro_id = p_membro_id and status = 'escalado' limit 1;
  if e.id is null then return jsonb_build_object('erro','nao_escalado'); end if;

  if p_acao = 'sair' then
    delete from public.acolitos_escalas where id = e.id;
    return jsonb_build_object('ok', true, 'acao','sair', 'celebracao_id', c.id);
  end if;

  if p_funcao is null or p_funcao = e.funcao then return jsonb_build_object('erro','pedido_invalido'); end if;
  if not exists (
    select 1 from public.acolitos_modelos mo
    join public.acolitos_habilitacoes h on h.membro_id = p_membro_id and h.funcao = mo.funcao
    where mo.tipo = c.tipo and mo.comunidade = c.comunidade and mo.funcao = p_funcao
      and mo.quantidade > (select count(*) from public.acolitos_escalas x
                           where x.celebracao_id = c.id and x.funcao = mo.funcao and x.status = 'escalado')
  ) then return jsonb_build_object('erro','sem_vaga'); end if;
  update public.acolitos_escalas set funcao = p_funcao where id = e.id;
  return jsonb_build_object('ok', true, 'acao','trocar', 'celebracao_id', c.id, 'funcao', p_funcao);
end; $function$
;

revoke execute on function public.acolitos_novena_publica_missas(uuid) from anon, public;
revoke execute on function public.acolitos_novena_publica_enviar(uuid, jsonb) from anon, public;
revoke execute on function public.acolitos_novena_publica_alterar(uuid, uuid, text, text) from anon, public;

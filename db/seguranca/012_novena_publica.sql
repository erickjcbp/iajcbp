-- 012 — Link público da Novena: servo marca as MISSAS e a função entra sozinha na escala (2026-10-05)
-- Sem login. O nome é achado por acolitos_ausencia_publica_buscar (já liberada a anon).
-- Missa da novena = celebração com observacoes começando em 'Novena'. Vagas = acolitos_modelos
-- do tipo/comunidade da celebração (a "missa comum" de sempre).
-- A função é escolhida pelo banco: entre as habilitações do membro com vaga aberta, a mais
-- específica primeiro (cerimoniais > altar > cruz > sineta > sinão > vela > apoio), para o
-- 'apoio' (genérico) não consumir quem serve em função mais escassa.
-- Cerimoniário (cred_altar / cred_credencia / missal) NUNCA cai em 'apoio' — mesma regra do gerador.

-- 1) Missas da novena, com o estado deste membro
create or replace function public.acolitos_novena_publica_missas(p_membro_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_out jsonb;
begin
  if p_membro_id is null
     or not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo') then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade,
           'minha_funcao', (select e.funcao from public.acolitos_escalas e
                            where e.celebracao_id = c.id and e.membro_id = p_membro_id and e.status = 'escalado' limit 1),
           'lotada', not exists (
             select 1 from public.acolitos_modelos mo
             where mo.tipo = c.tipo and mo.comunidade = c.comunidade and mo.quantidade >
               (select count(*) from public.acolitos_escalas e2
                where e2.celebracao_id = c.id and e2.funcao = mo.funcao and e2.status = 'escalado'))
         ) order by c.data, c.minutos), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  where c.data >= current_date and c.observacoes ilike 'Novena%';
  return v_out;
end; $$;

-- 2) Marcar missas: coloca o membro na escala, uma função por missa
create or replace function public.acolitos_novena_publica_enviar(p_membro_id uuid, p_celebracoes uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_cel uuid; c public.acolitos_celebracoes%rowtype; v_fn text; v_cerimo boolean;
  v_ordem text[] := array['cred_altar','cred_credencia','missal','altar','cruz','sineta','sinao','vela','apoio'];
  v_postos jsonb := '[]'::jsonb; v_pulados jsonb := '[]'::jsonb;
begin
  if p_membro_id is null or p_celebracoes is null or array_length(p_celebracoes,1) is null then
    return jsonb_build_object('erro','sem_itens');
  end if;
  if array_length(p_celebracoes,1) > 15 then return jsonb_build_object('erro','muitos_itens'); end if;
  if not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo' and serve) then
    return jsonb_build_object('erro','membro_invalido');
  end if;
  select exists (select 1 from public.acolitos_habilitacoes
                 where membro_id = p_membro_id and funcao in ('cred_altar','cred_credencia','missal')) into v_cerimo;

  for v_cel in select distinct x from unnest(p_celebracoes) x loop
    -- trava a celebração: dois links concorrentes não passam da quantidade do modelo
    select * into c from public.acolitos_celebracoes
      where id = v_cel and data >= current_date and observacoes ilike 'Novena%' for update;
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
      and not (v_cerimo and mo.funcao = 'apoio')
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
end; $$;

revoke execute on function public.acolitos_novena_publica_missas(uuid) from public;
revoke execute on function public.acolitos_novena_publica_enviar(uuid,uuid[]) from public;
grant execute on function public.acolitos_novena_publica_missas(uuid) to anon, authenticated;
grant execute on function public.acolitos_novena_publica_enviar(uuid,uuid[]) to anon, authenticated;

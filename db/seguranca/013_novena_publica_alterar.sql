-- 013 — Link público da Novena: servo troca a função ou sai de uma missa em que já está (2026-10-05)
-- Sem login, mesma confiança da 012 (o nome é achado por acolitos_ausencia_publica_buscar).
-- Só mexe em escala 'escalado' de missa da novena futura. Troca respeita habilitação e vaga (a própria vaga não conta contra si).
-- Cerimoniário só cai em 'apoio' se a PESSOA escolher (mesma regra da 012).
create or replace function public.acolitos_novena_publica_alterar(p_membro_id uuid, p_celebracao_id uuid, p_acao text, p_funcao text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.acolitos_celebracoes%rowtype; e public.acolitos_escalas%rowtype;
begin
  if p_membro_id is null or p_celebracao_id is null or p_acao not in ('trocar','sair') then
    return jsonb_build_object('erro','pedido_invalido');
  end if;
  if not exists (select 1 from public.acolitos_membros where id = p_membro_id and status = 'ativo' and serve) then
    return jsonb_build_object('erro','membro_invalido');
  end if;
  select * into c from public.acolitos_celebracoes
    where id = p_celebracao_id and data >= current_date and observacoes ilike 'Novena%' for update;
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
end; $$;
revoke execute on function public.acolitos_novena_publica_alterar(uuid,uuid,text,text) from public;
grant execute on function public.acolitos_novena_publica_alterar(uuid,uuid,text,text) to anon, authenticated;

-- 011 — Solicitações do membro (troca / candidatura) + Caixa de Aprovações (2026-07-15)
-- Autoatendimento: o membro pede troca (colega aceita → coordenação homologa) ou se candidata a vaga.
-- A mutação real da escala reusa acolitos_aplicar_troca_escala (009). Ausências (fila) e novos
-- cadastros (CRM) NÃO entram aqui — a Caixa só os agrega.

create table if not exists public.acolitos_solicitacoes (
  id                  uuid primary key default gen_random_uuid(),
  membro_id           uuid not null references public.acolitos_membros(id) on delete cascade,
  celebracao_id       uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  escala_id           uuid references public.acolitos_escalas(id) on delete set null,
  funcao              text not null,
  tipo                text not null check (tipo in ('troca','candidatura')),
  alvo_membro_id      uuid references public.acolitos_membros(id) on delete set null,
  status              text not null default 'aguardando_coordenacao',
  motivo              text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  decidido_por        uuid,
  resultado_escala_id uuid
);
create index if not exists idx_solic_status   on public.acolitos_solicitacoes(status);
create index if not exists idx_solic_membro   on public.acolitos_solicitacoes(membro_id);
create index if not exists idx_solic_alvo     on public.acolitos_solicitacoes(alvo_membro_id);
create index if not exists idx_solic_celebra  on public.acolitos_solicitacoes(celebracao_id);

alter table public.acolitos_solicitacoes enable row level security;

-- Dono OU alvo (colega convidado) lê. Coordenação lê tudo.
drop policy if exists solic_select on public.acolitos_solicitacoes;
create policy solic_select on public.acolitos_solicitacoes for select using (
  membro_id     in (select id from public.acolitos_membros where user_id = auth.uid())
  or alvo_membro_id in (select id from public.acolitos_membros where user_id = auth.uid())
  or public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
);
-- Sem policies de INSERT/UPDATE/DELETE diretas: todo write é via RPC SECURITY DEFINER (abaixo).

-- ── Helper interno: id do meu membro ativo ──────────────────────────────
create or replace function public.acolitos_meu_membro_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.acolitos_membros where user_id = auth.uid() and status = 'ativo' limit 1;
$$;

-- ── Pedir troca ─────────────────────────────────────────────────────────
create or replace function public.acolitos_solicitar_troca(
  p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid; v_cel uuid; v_funcao text; v_status text; v_id uuid;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  select celebracao_id, funcao into v_cel, v_funcao
  from public.acolitos_escalas
  where id = p_escala_id and membro_id = v_me and status = 'escalado';
  if v_cel is null then return jsonb_build_object('erro','nao_escalado'); end if;
  -- não permite pedido duplicado pendente para a mesma escala
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

-- ── Candidatar-se a vaga ────────────────────────────────────────────────
create or replace function public.acolitos_candidatar_vaga(
  p_celebracao_id uuid, p_funcao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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

-- ── Colega responde ao convite ──────────────────────────────────────────
create or replace function public.acolitos_troca_responder(
  p_solicitacao_id uuid, p_aceita boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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

-- ── Dono cancela ────────────────────────────────────────────────────────
create or replace function public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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

-- ── Dono reenvia (outro colega, ou null = cobertura) ───────────────────
create or replace function public.acolitos_solicitacao_reenviar(
  p_solicitacao_id uuid, p_novo_alvo uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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

-- ── Meus pedidos + convites direcionados a mim ─────────────────────────
create or replace function public.acolitos_solicitacoes_membro()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
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

-- ── Vagas abertas na minha função (modelos − preenchidas) ──────────────
create or replace function public.acolitos_vagas_abertas_membro()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
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
    and mo.vagas > (
      select count(*) from public.acolitos_escalas e
      where e.celebracao_id = c.id and e.funcao = mo.funcao and e.status = 'escalado'
    )
    and not exists (
      select 1 from public.acolitos_escalas e2
      where e2.celebracao_id = c.id and e2.membro_id = v_me and e2.status = 'escalado'
    );
  return jsonb_build_object('vagas', v_out);
end; $$;

-- grants
revoke execute on function public.acolitos_meu_membro_id() from public;
revoke execute on function public.acolitos_solicitar_troca(uuid,uuid,text) from public;
revoke execute on function public.acolitos_candidatar_vaga(uuid,text,text) from public;
revoke execute on function public.acolitos_troca_responder(uuid,boolean) from public;
revoke execute on function public.acolitos_solicitacao_cancelar(uuid) from public;
revoke execute on function public.acolitos_solicitacao_reenviar(uuid,uuid) from public;
revoke execute on function public.acolitos_solicitacoes_membro() from public;
revoke execute on function public.acolitos_vagas_abertas_membro() from public;
grant execute on function public.acolitos_meu_membro_id() to authenticated;
grant execute on function public.acolitos_solicitar_troca(uuid,uuid,text) to authenticated;
grant execute on function public.acolitos_candidatar_vaga(uuid,text,text) to authenticated;
grant execute on function public.acolitos_troca_responder(uuid,boolean) to authenticated;
grant execute on function public.acolitos_solicitacao_cancelar(uuid) to authenticated;
grant execute on function public.acolitos_solicitacao_reenviar(uuid,uuid) to authenticated;
grant execute on function public.acolitos_solicitacoes_membro() to authenticated;
grant execute on function public.acolitos_vagas_abertas_membro() to authenticated;

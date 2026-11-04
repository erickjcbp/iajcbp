begin;
create table public.acolitos_motor_config(id boolean primary key default true check(id),geracao_ativa boolean not null default false,distribuicao_desde date,capacidades jsonb not null default '{}'::jsonb,atualizado_em timestamptz not null default now());
insert into public.acolitos_motor_config(id) values(true);
create table public.acolitos_motor_fontes(id text primary key,versao int not null default 1,tipo text not null,conteudo text not null check(length(conteudo)<=10000),proveniencia jsonb not null default '{}',estado text not null check(estado in ('ativa','arquivada')));
create table public.acolitos_motor_lotes(id uuid primary key,ator uuid,estado text not null default 'gerando',origem text not null default 'manual',metricas jsonb not null default '{}',erro text,criado_em timestamptz not null default now());
create table public.acolitos_motor_uso(dia date primary key,chamadas int not null default 0 check(chamadas between 0 and 8));
create table public.acolitos_motor_versoes(id uuid primary key default gen_random_uuid(),lote_id uuid references public.acolitos_motor_lotes(id),revisao int not null default 1,estado text not null default 'rascunho' check(estado in ('rascunho','aprovada','arquivada')),conteudo jsonb not null,publico jsonb not null,alertas jsonb not null default '[]',aprovado_por uuid,aprovado_em timestamptz,criado_em timestamptz not null default now());
create table public.acolitos_motor_semanas(semana date primary key,estado text not null check(estado in ('publicada','rascunho')),criado_em timestamptz not null default now());
create table public.acolitos_motor_atribuicoes(id uuid primary key default gen_random_uuid(),membro_id uuid not null references public.acolitos_membros(id),semana date not null references public.acolitos_motor_semanas(semana),slot int not null check(slot between 0 and 7),versao_id uuid not null references public.acolitos_motor_versoes(id),missao_id uuid not null references public.acolitos_missoes(id),estado text not null default 'pendente' check(estado in ('pendente','iniciada','em_analise','revisao','concluida','arquivada')),iniciado_em timestamptz,ultimo_avanco timestamptz,prazo timestamptz,troca_usada boolean not null default false,unique(membro_id,semana,slot),unique(membro_id,missao_id));
create table public.acolitos_motor_historico(id bigint generated always as identity primary key,membro_id uuid not null,semana date not null,versao_id uuid not null,objetivo_chave text not null,missao_id uuid not null,concluida boolean not null default false,trocada boolean not null default false,unique(membro_id,missao_id));
create table public.acolitos_motor_recompensas(membro_id uuid not null,objetivo_chave text not null,missao_id uuid not null,criado_em timestamptz not null default now(),primary key(membro_id,objetivo_chave));
do $private$ declare t text;begin foreach t in array array['config','fontes','lotes','uso','versoes','semanas','atribuicoes','historico','recompensas'] loop execute format('alter table public.acolitos_motor_%I enable row level security',t);execute format('revoke all on public.acolitos_motor_%I from public,anon,authenticated',t);execute format('grant all on public.acolitos_motor_%I to service_role',t);end loop;end $private$;
grant usage,select on sequence public.acolitos_motor_historico_id_seq to service_role;
create function public.acolitos_motor_reservar_geracao(p_pedido uuid,p_ator uuid,p_dia date,p_limite int default 8) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('motor-quota',0));
 if exists(select 1 from acolitos_motor_lotes where id=p_pedido) then return jsonb_build_object('reservado',false,'lote_id',p_pedido);end if;
 if p_dia<>(now() at time zone 'America/Sao_Paulo')::date or p_limite<>8 then raise exception 'Quota inválida.';end if;
 insert into acolitos_motor_uso(dia) values(p_dia) on conflict do nothing;
 -- Reservam-se as duas chamadas: geração + revisão. Sem retries invisíveis.
 update acolitos_motor_uso set chamadas=chamadas+2 where dia=p_dia and chamadas<=6;
 if not found then raise exception 'Limite diário de oito chamadas atingido.';end if;
 insert into acolitos_motor_lotes(id,ator) values(p_pedido,p_ator);
 return jsonb_build_object('reservado',true,'lote_id',p_pedido);
end $$;
create function public.acolitos_motor_salvar_versao(p_id uuid,p_revisao int,p_conteudo jsonb,p_publico jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v acolitos_motor_versoes;
begin
 update acolitos_motor_versoes set conteudo=p_conteudo,publico=p_publico,revisao=revisao+1 where id=p_id and revisao=p_revisao and estado='rascunho' returning * into v;
 if v.id is null then raise exception 'Conflito de revisão: recarregue o rascunho. Versões aprovadas são imutáveis.';end if;
 return to_jsonb(v);
end $$;
create function public.acolitos_motor_aprovar(p_id uuid,p_revisao int,p_ator uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v acolitos_motor_versoes;ref jsonb;
begin
 select * into v from acolitos_motor_versoes where id=p_id and revisao=p_revisao and estado='rascunho' for update;
 if v.id is null then raise exception 'Conflito de revisão.';end if;
 if jsonb_array_length(v.conteudo->'fontes')<1 then raise exception 'Fonte obrigatória.';end if;
 for ref in select value from jsonb_array_elements(v.conteudo->'fontes') loop
  if not exists(select 1 from acolitos_motor_fontes f where f.id=ref->>'id' and f.versao=(ref->>'versao')::int and f.estado='ativa' and length(ref->>'trecho')>0 and position(ref->>'trecho' in f.conteudo)>0) then raise exception 'Fonte alterada ou não confirmada.';end if;
 end loop;
 update acolitos_motor_versoes set estado='aprovada',aprovado_por=p_ator,aprovado_em=now(),revisao=revisao+1 where id=p_id returning * into v;
 return to_jsonb(v);
end $$;
revoke all on function public.acolitos_motor_reservar_geracao(uuid,uuid,date,int),public.acolitos_motor_salvar_versao(uuid,int,jsonb,jsonb),public.acolitos_motor_aprovar(uuid,int,uuid) from public,anon,authenticated;
grant execute on function public.acolitos_motor_reservar_geracao(uuid,uuid,date,int),public.acolitos_motor_salvar_versao(uuid,int,jsonb,jsonb),public.acolitos_motor_aprovar(uuid,int,uuid) to service_role;
commit;

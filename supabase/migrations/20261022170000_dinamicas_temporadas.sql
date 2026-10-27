begin;
alter table public.acolitos_gincanas add column retiro_id uuid references public.acolitos_retiro_areas(id);
alter table public.acolitos_gincanas add column conducao jsonb not null default '{"versao":0}';
create unique index acolitos_temporada_por_retiro on public.acolitos_gincanas(retiro_id) where retiro_id is not null;
-- A base anterior continua privada. Preserva todas as regras e o histórico já publicado.
alter function public.quiz_operar(text,jsonb) rename to quiz_operar_base;
revoke all on function public.quiz_operar_base(text,jsonb) from public,anon,authenticated;
create function public.quiz_operar(p_acao text,p_dados jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; gid uuid; rid uuid; qid uuid; retiro uuid; g public.acolitos_gincanas; a public.acolitos_retiro_areas; resposta jsonb; c jsonb; versao integer; revelar integer;
begin
 select id into m from public.pastoral_modules where slug='acolitos' and ativo;
 if not coalesce(public.quiz_pode_gerir(m),false) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_dados is null or jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>180000 then raise exception 'Dados inválidos'; end if;
 if p_acao='listar_retiros' then
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'tipo',tipo,'descricao',descricao,'local',local,'data_inicio',data_inicio,'data_fim',data_fim,'status',status) order by data_inicio desc nulls last,id),'[]'::jsonb) from public.acolitos_retiro_areas where tipo='retiro');
 elsif p_acao='iniciar_temporada' then
 retiro:=(p_dados->>'retiro_id')::uuid;
 select * into a from public.acolitos_retiro_areas where id=retiro and tipo='retiro';
 if not found then raise exception 'Retiro não encontrado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(retiro::text,2));
 select id into gid from public.acolitos_gincanas where retiro_id=retiro and module_id=m;
 if gid is null then
 insert into public.acolitos_gincanas(module_id,retiro_id,nome,descricao,data,criado_por)
 values(m,retiro,a.nome,coalesce(a.descricao,''),coalesce(a.data_inicio,current_date),auth.uid()) returning id into gid;
 insert into public.acolitos_gincana_casas(gincana_id,origem_id,nome,cor)
 select gid,id,nome,case when cor ~ '^#[0-9a-fA-F]{6}$' then cor else '#cfa34a' end from public.acolitos_casas where tipo='membro' order by ordem limit 30;
 insert into public.acolitos_gincana_auditoria(gincana_id,acao,justificativa,responsavel)
 values(gid,'temporada_criada','Temporada vinculada ao retiro; casas começam com saldo zero.',auth.uid());
 end if;
 return public.quiz_operar_base('estado',jsonb_build_object('gincana_id',gid));
 elsif p_acao='conduzir' then
 gid:=(p_dados->>'gincana_id')::uuid;
 select * into g from public.acolitos_gincanas where id=gid and module_id=m for update;
 if not found then raise exception 'Temporada não encontrada' using errcode='42501'; end if;
 if g.status='encerrada' then raise exception 'Temporada encerrada'; end if;
 versao:=coalesce((g.conducao->>'versao')::int,0);
 if coalesce((p_dados->>'versao')::int,-1)<>versao then raise exception 'A condução mudou em outra tela. Atualize e tente novamente.' using errcode='40001'; end if;
 rid:=(p_dados->>'rodada_id')::uuid; qid:=nullif(p_dados->>'pergunta_id','')::uuid;
 if not exists(select 1 from public.acolitos_gincana_rodadas where id=rid and gincana_id=gid) then raise exception 'Rodada de outra temporada'; end if;
 revelar:=coalesce((p_dados->>'revelacao')::int,0);
 if revelar not between 0 and 2 or (qid is null and revelar<>0) then raise exception 'Etapa inválida'; end if;
 if qid is not null then
 if not exists(select 1 from public.acolitos_gincana_rodadas r cross join lateral jsonb_array_elements(r.perguntas) q where r.id=rid and q->>'id'=qid::text) then raise exception 'Pergunta de outra rodada'; end if;
 if exists(select 1 from public.acolitos_gincana_resultados where rodada_id=rid and pergunta_id=qid) then raise exception 'Esta pergunta já tem resultado. Escolha outra.'; end if;
 if revelar>0 and (g.conducao->>'pergunta_id' is distinct from qid::text or g.conducao->>'rodada_id' is distinct from rid::text) then raise exception 'Escolha a pergunta antes de revelar'; end if;
 end if;
 c:=jsonb_build_object('rodada_id',rid,'pergunta_id',qid,'revelacao',revelar,'versao',versao+1,'atualizado_em',now());
 update public.acolitos_gincanas set conducao=c where id=gid;
 return c;
 end if;
 resposta:=public.quiz_operar_base(p_acao,p_dados);
 if p_acao='lancar' and p_dados->>'rodada_id' is not null and not coalesce((resposta->>'repetido')::boolean,false) then
 update public.acolitos_gincanas set conducao=jsonb_build_object('versao',coalesce((conducao->>'versao')::int,0)+1,'rodada_id',p_dados->>'rodada_id','pergunta_id',null,'revelacao',0,'atualizado_em',now())
 where id=(p_dados->>'gincana_id')::uuid and conducao->>'rodada_id'=p_dados->>'rodada_id' and conducao->>'pergunta_id'=p_dados->>'pergunta_id';
 end if;
 return resposta;
end $$;
revoke all on function public.quiz_operar(text,jsonb) from public,anon;
grant execute on function public.quiz_operar(text,jsonb) to authenticated;
commit;

-- Quiz e gincanas: escopo atual é o módulo paroquial acolitos (não há tenancy por comunidade no cadastro).
-- Escritas somente por RPC; totais nunca são recebidos do cliente. Histórico é imutável.
begin;
create table public.acolitos_quizzes (
 id uuid primary key default gen_random_uuid(), module_id uuid not null references public.pastoral_modules(id),
 config jsonb not null, perguntas jsonb not null default '[]', status text not null default 'rascunho' check(status in ('rascunho','pronto')),
 versao integer not null default 1, criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table public.acolitos_gincanas (
 id uuid primary key default gen_random_uuid(), module_id uuid not null references public.pastoral_modules(id),
 nome text not null check(length(trim(nome)) between 1 and 120), descricao text not null default '' check(length(descricao)<=2000), data date not null,
 status text not null default 'preparacao' check(status in ('preparacao','em_andamento','encerrada')),
 regras jsonb not null default '{"facil":10,"medio":20,"dificil":30,"erro":0}', versao integer not null default 1,
 criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now()
);
create table public.acolitos_gincana_casas (
 id uuid primary key default gen_random_uuid(), gincana_id uuid not null references public.acolitos_gincanas(id),
 origem_id uuid references public.acolitos_casas(id) on delete set null,
 nome text not null check(length(trim(nome)) between 1 and 100), cor text not null check(cor ~ '^#[0-9a-fA-F]{6}$'),
 imagem text not null default '' check(length(imagem)<=1000 and (imagem='' or imagem ~ '^https://')),
 unique(gincana_id,id)
);
create table public.acolitos_gincana_rodadas (
 id uuid primary key default gen_random_uuid(), gincana_id uuid not null references public.acolitos_gincanas(id),
 quiz_id uuid references public.acolitos_quizzes(id) on delete set null, titulo text not null, perguntas jsonb not null,
 criado_em timestamptz not null default now(), unique(gincana_id,id)
);
create table public.acolitos_gincana_lancamentos (
 id uuid primary key default gen_random_uuid(), gincana_id uuid not null references public.acolitos_gincanas(id),
 casa_id uuid, rodada_id uuid, pergunta_id uuid, valor integer not null check(valor between -10000 and 10000),
 resultado text check(resultado in ('acerto','erro','anulada','sem_pontos')), justificativa text not null check(length(trim(justificativa)) between 1 and 1000),
 estorno_de uuid unique references public.acolitos_gincana_lancamentos(id),
 pedido_id uuid not null unique, responsavel uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 foreign key(gincana_id,casa_id) references public.acolitos_gincana_casas(gincana_id,id),
 foreign key(gincana_id,rodada_id) references public.acolitos_gincana_rodadas(gincana_id,id)
);
-- Resultado ativo separado do livro de lançamentos, para permitir estorno e reaplicação auditáveis.
create table public.acolitos_gincana_resultados (
 rodada_id uuid not null references public.acolitos_gincana_rodadas(id), pergunta_id uuid not null,
 lancamento_id uuid not null unique references public.acolitos_gincana_lancamentos(id), primary key(rodada_id,pergunta_id)
);
create table public.acolitos_gincana_auditoria (
 id uuid primary key default gen_random_uuid(), gincana_id uuid not null references public.acolitos_gincanas(id),
 acao text not null, justificativa text not null, responsavel uuid not null references auth.users(id), criado_em timestamptz not null default now()
);
create table public.acolitos_quiz_ia_uso (
 pedido_id uuid primary key, module_id uuid not null references public.pastoral_modules(id), responsavel uuid not null references auth.users(id),
 quantidade integer not null check(quantidade between 1 and 24), criado_em timestamptz not null default now()
);
create index on public.acolitos_gincana_lancamentos(gincana_id,criado_em);
create index on public.acolitos_quiz_ia_uso(module_id,criado_em);
create index on public.acolitos_quizzes(module_id,atualizado_em);

create function public.quiz_pode_gerir(p_module uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.pastoral_members m join public.pastoral_modules p on p.id=m.module_id
 where m.user_id=auth.uid() and m.module_id=p_module and p.slug='acolitos' and p.ativo and m.role in ('coord_admin','subadmin','membro_equipe'));
$$;
revoke all on function public.quiz_pode_gerir(uuid) from public;
grant execute on function public.quiz_pode_gerir(uuid) to authenticated;

do $$ declare t text; begin
 foreach t in array array['acolitos_quizzes','acolitos_gincanas','acolitos_gincana_casas','acolitos_gincana_rodadas','acolitos_gincana_lancamentos','acolitos_gincana_resultados','acolitos_gincana_auditoria','acolitos_quiz_ia_uso'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.acolitos_quizzes, public.acolitos_gincanas, public.acolitos_gincana_casas, public.acolitos_gincana_rodadas, public.acolitos_gincana_lancamentos, public.acolitos_gincana_auditoria to authenticated;
create policy quiz_leitura on public.acolitos_quizzes for select to authenticated using(public.quiz_pode_gerir(module_id));
create policy gincana_leitura on public.acolitos_gincanas for select to authenticated using(public.quiz_pode_gerir(module_id));
do $$ declare t text; begin
 foreach t in array array['acolitos_gincana_casas','acolitos_gincana_rodadas','acolitos_gincana_lancamentos','acolitos_gincana_auditoria'] loop
 execute format('create policy equipe_leitura on public.%I for select to authenticated using(exists(select 1 from public.acolitos_gincanas g where g.id=gincana_id and public.quiz_pode_gerir(g.module_id)))',t);
 end loop;
end $$;

create function public.quiz_validar(c jsonb, qs jsonb, pronto boolean) returns void language plpgsql set search_path='' as $$
declare q jsonb; a jsonb; ids text[] := '{}'; textos text[] := '{}'; t text; n integer; total integer := 0; temas text[] := array['Bíblia','Vida de Jesus','Nossa Senhora','Santos','Sacramentos','Liturgia e Santa Missa','Objetos, vestes e espaços litúrgicos','Serviço dos coroinhas','Calendário e tempos litúrgicos','Conhecimentos gerais da fé católica'];
begin
 if c is null or jsonb_typeof(c)<>'object' or jsonb_typeof(c->'titulo') is distinct from 'string' or length(trim(c->>'titulo')) not between 1 and 120
 or coalesce(c->>'faixa','') not in ('criancas','adolescentes','misto') or coalesce(c->>'alternativas','') not in ('3','4')
 or jsonb_typeof(c->'temas') is distinct from 'array' or jsonb_typeof(c->'observacoes') is distinct from 'string' or length(c->>'observacoes')>1500 then raise exception 'Configuração inválida'; end if;
 if jsonb_array_length(c->'temas') not between 1 and 10 or exists(select 1 from jsonb_array_elements_text(c->'temas') x where not(x=any(temas))) then raise exception 'Temas inválidos'; end if;
 foreach t in array array['facil','medio','dificil'] loop
 if coalesce(c->'quantidades'->>t,'') !~ '^(0|[1-9]|10)$' then raise exception 'Quantidade inválida'; end if;
 total:=total+(c->'quantidades'->>t)::int;
 end loop;
 if total not between 1 and 24 then raise exception 'Gere entre 1 e 24 perguntas'; end if;
 if jsonb_typeof(qs) is distinct from 'array' then raise exception 'Perguntas inválidas'; end if;
 if jsonb_array_length(qs)>60 or (pronto and jsonb_array_length(qs)=0) then raise exception 'Quantidade de perguntas inválida'; end if;
 n:=(c->>'alternativas')::integer;
 for q in select * from jsonb_array_elements(qs) loop
 if jsonb_typeof(q)<>'object' or coalesce(q->>'id','') !~ '^[0-9a-fA-F-]{36}$' or (q->>'id')=any(ids)
 or coalesce(q->>'dificuldade','') not in ('facil','medio','dificil') or not(coalesce(q->>'tema','')=any(temas))
 or jsonb_typeof(q->'enunciado') is distinct from 'string' or length(q->>'enunciado')>1000
 or jsonb_typeof(q->'explicacao') is distinct from 'string' or length(q->>'explicacao')>1500
 or jsonb_typeof(q->'referencia') is distinct from 'string' or length(q->>'referencia')>500
 or jsonb_typeof(q->'revisada') is distinct from 'boolean'
 or coalesce(q->>'correta','') !~ '^[0-3]$' then raise exception 'Estrutura da pergunta inválida'; end if;
 perform (q->>'id')::uuid;
 if jsonb_typeof(q->'alternativas') is distinct from 'array' then raise exception 'Alternativas inválidas'; end if;
 if jsonb_array_length(q->'alternativas')<>n or (q->>'correta')::int>=n then raise exception 'Alternativas inválidas'; end if;
 for a in select * from jsonb_array_elements(q->'alternativas') loop
 if jsonb_typeof(a)<>'string' or length(a#>>'{}')>400 then raise exception 'Alternativa inválida'; end if;
 end loop;
 t:=lower(regexp_replace(trim(q->>'enunciado'),'\s+',' ','g'));
 if t<>'' and t=any(textos) then raise exception 'Perguntas repetidas'; end if;
 textos:=array_append(textos,t); ids:=array_append(ids,q->>'id');
 if pronto or (q->>'revisada')::boolean then
 if not (q->>'revisada')::boolean or trim(q->>'enunciado')='' or trim(q->>'explicacao')=''
 or exists(select 1 from jsonb_array_elements_text(q->'alternativas') x where trim(x)='')
 or (select count(distinct lower(trim(x))) from jsonb_array_elements_text(q->'alternativas') x)<>n then raise exception 'Revise e complete todas as perguntas'; end if;
 end if;
 end loop;
end $$;
revoke all on function public.quiz_validar(jsonb,jsonb,boolean) from public;

create function public.quiz_operar(p_acao text, p_dados jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; gid uuid; qid uuid; rid uuid; cid uuid; pid uuid; lid uuid; alvo uuid; v integer; n integer; cfg jsonb; qs jsonb; q jsonb; oq jsonb; novo jsonb; resposta jsonb; g public.acolitos_gincanas; quiz public.acolitos_quizzes; l public.acolitos_gincana_lancamentos; motivo text; resultado text; soma bigint; regra text;
begin
 select id into m from public.pastoral_modules where slug='acolitos' and ativo;
 if not coalesce(public.quiz_pode_gerir(m),false) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_dados is null or jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>180000 then raise exception 'Dados inválidos'; end if;
 if p_acao='salvar_quiz' then
 qid:=nullif(p_dados->>'id','')::uuid; cfg:=p_dados->'config'; qs:=p_dados->'perguntas';
 if coalesce(p_dados->>'status','') not in ('rascunho','pronto') then raise exception 'Status inválido'; end if;
 if qid is not null then
 select * into quiz from public.acolitos_quizzes where id=qid and module_id=m for update;
 if not found then raise exception 'Quiz não encontrado' using errcode='42501'; end if;
 if quiz.versao<>coalesce((p_dados->>'versao')::int,0) then raise exception 'Outra tela alterou este quiz. Reabra antes de salvar.' using errcode='40001'; end if;
 -- Mudar um conteúdo já revisado exige outra revisão depois de persistir a mudança.
 novo:='[]';
 for q in select * from jsonb_array_elements(qs) loop
 select x into oq from jsonb_array_elements(quiz.perguntas) x where x->>'id'=q->>'id';
 if oq is not null and (oq->>'revisada')::boolean and (oq-'revisada'-'alerta') is distinct from (q-'revisada'-'alerta') then q:=jsonb_set(q,'{revisada}','false'); end if;
 novo:=novo||jsonb_build_array(q);
 end loop; qs:=novo;
 end if;
 perform public.quiz_validar(cfg,qs,p_dados->>'status'='pronto');
 if qid is null then
 insert into public.acolitos_quizzes(module_id,config,perguntas,status,criado_por) values(m,cfg,qs,p_dados->>'status',auth.uid()) returning * into quiz;
 else
 update public.acolitos_quizzes set config=cfg,perguntas=qs,status=p_dados->>'status',versao=versao+1,atualizado_em=now() where id=qid returning * into quiz;
 end if;
 return to_jsonb(quiz);
 elsif p_acao='duplicar_quiz' then
 select * into quiz from public.acolitos_quizzes where id=(p_dados->>'id')::uuid and module_id=m;
 if not found then raise exception 'Quiz não encontrado' using errcode='42501'; end if;
 qs:='[]'; for q in select * from jsonb_array_elements(quiz.perguntas) loop qs:=qs||jsonb_build_array(q||jsonb_build_object('id',gen_random_uuid(),'revisada',false)); end loop;
 insert into public.acolitos_quizzes(module_id,config,perguntas,criado_por) values(m,jsonb_set(quiz.config,'{titulo}',to_jsonb(left(quiz.config->>'titulo',110)||' (cópia)')),qs,auth.uid()) returning * into quiz;
 return to_jsonb(quiz);
 elsif p_acao='excluir_quiz' then
 delete from public.acolitos_quizzes where id=(p_dados->>'id')::uuid and module_id=m;
 if not found then raise exception 'Quiz não encontrado' using errcode='42501'; end if;
 return '{"ok":true}';
 elsif p_acao='reservar_ia' then
 pid:=(p_dados->>'pedido_id')::uuid; n:=(p_dados->>'quantidade')::int;
 if n is null or n not between 1 and 24 or pid is null then raise exception 'Quantidade inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(m::text,1));
 if exists(select 1 from public.acolitos_quiz_ia_uso where pedido_id=pid) then raise exception 'Este pedido já foi recebido. Aguarde o resultado.' using errcode='23505'; end if;
 if (select count(*) from public.acolitos_quiz_ia_uso where responsavel=auth.uid() and criado_em>now()-interval '1 hour')>=10
 or (select coalesce(sum(quantidade),0) from public.acolitos_quiz_ia_uso where module_id=m and criado_em>now()-interval '24 hours')+n>240 then raise exception 'Limite de geração atingido. Tente mais tarde.' using errcode='54000'; end if;
 insert into public.acolitos_quiz_ia_uso values(pid,m,auth.uid(),n,now()); return '{"ok":true}';
 elsif p_acao='salvar_gincana' then
 gid:=nullif(p_dados->>'id','')::uuid;
 cfg:=p_dados->'regras';
 foreach regra in array array['facil','medio','dificil','erro'] loop
 if coalesce(cfg->>regra,'') !~ '^-?[0-9]{1,4}$' then raise exception 'Use pontos inteiros até 9999'; end if;
 if regra<>'erro' and (cfg->>regra)::int<0 or regra='erro' and (cfg->>regra)::int>0 then raise exception 'Pontos de acerto positivos; erro zero ou desconto'; end if;
 end loop;
 if gid is null then
 insert into public.acolitos_gincanas(module_id,nome,descricao,data,regras,criado_por) values(m,p_dados->>'nome',coalesce(p_dados->>'descricao',''),(p_dados->>'data')::date,cfg,auth.uid()) returning * into g;
 else
 select * into g from public.acolitos_gincanas where id=gid and module_id=m for update;
 if not found then raise exception 'Gincana não encontrada' using errcode='42501'; end if;
 if g.status='encerrada' then raise exception 'Gincana encerrada'; end if;
 if g.versao<>coalesce((p_dados->>'versao')::int,0) then raise exception 'Outra tela alterou a gincana. Reabra.' using errcode='40001'; end if;
 update public.acolitos_gincanas set nome=p_dados->>'nome',descricao=coalesce(p_dados->>'descricao',''),data=(p_dados->>'data')::date,regras=cfg,versao=versao+1 where id=gid returning * into g;
 insert into public.acolitos_gincana_auditoria(gincana_id,acao,justificativa,responsavel) values(gid,'configuracao','Nome, data ou regras atualizados; pontos anteriores preservados.',auth.uid());
 end if;
 return to_jsonb(g);
 end if;
 gid:=(p_dados->>'gincana_id')::uuid;
 select * into g from public.acolitos_gincanas where id=gid and module_id=m for update;
 if not found then raise exception 'Gincana não encontrada' using errcode='42501'; end if;
 motivo:=trim(coalesce(p_dados->>'justificativa',''));
 if p_acao='estado' then
 return jsonb_build_object('gincana',to_jsonb(g),'casas',coalesce((select jsonb_agg(to_jsonb(c)) from public.acolitos_gincana_casas c where c.gincana_id=gid),'[]'::jsonb),
 'rodadas',coalesce((select jsonb_agg(to_jsonb(r) order by r.criado_em) from public.acolitos_gincana_rodadas r where r.gincana_id=gid),'[]'::jsonb),
 'lancamentos',coalesce((select jsonb_agg(to_jsonb(ll) order by ll.criado_em) from public.acolitos_gincana_lancamentos ll where ll.gincana_id=gid),'[]'::jsonb),
 'auditoria',coalesce((select jsonb_agg(to_jsonb(a) order by a.criado_em) from public.acolitos_gincana_auditoria a where a.gincana_id=gid),'[]'::jsonb));
 elsif p_acao='status' then
 if length(motivo) not between 1 and 1000 then raise exception 'Justifique a alteração'; end if;
 if (g.status='preparacao' and p_dados->>'status' not in ('em_andamento','encerrada')) or (g.status='em_andamento' and p_dados->>'status'<>'encerrada') or (g.status='encerrada' and p_dados->>'status'<>'em_andamento') then raise exception 'Transição de status inválida'; end if;
 update public.acolitos_gincanas set status=p_dados->>'status',versao=versao+1 where id=gid;
 insert into public.acolitos_gincana_auditoria(gincana_id,acao,justificativa,responsavel) values(gid,p_dados->>'status',motivo,auth.uid());
 return '{"ok":true}';
 end if;
 if g.status='encerrada' then raise exception 'Gincana encerrada. Reabra com justificativa.'; end if;
 if p_acao='adicionar_casa' then
 if (select count(*) from public.acolitos_gincana_casas where gincana_id=gid)>=30 then raise exception 'Limite de 30 casas'; end if;
 cid:=nullif(p_dados->>'origem_id','')::uuid;
 if cid is not null then
 if exists(select 1 from public.acolitos_gincana_casas where gincana_id=gid and origem_id=cid) then raise exception 'Casa já participa'; end if;
 select jsonb_build_object('nome',nome,'cor',cor) into cfg from public.acolitos_casas where id=cid;
 if cfg is null then raise exception 'Casa não encontrada'; end if;
 else cfg:=p_dados;
 end if;
 insert into public.acolitos_gincana_casas(gincana_id,origem_id,nome,cor,imagem) values(gid,cid,cfg->>'nome',coalesce(nullif(cfg->>'cor',''),'#cfa34a'),coalesce(p_dados->>'imagem','')) returning id into cid;
 return jsonb_build_object('id',cid);
 elsif p_acao='criar_rodada' then
 select * into quiz from public.acolitos_quizzes where id=(p_dados->>'quiz_id')::uuid and module_id=m and status='pronto';
 if not found then raise exception 'Escolha um quiz pronto deste módulo'; end if;
 perform public.quiz_validar(quiz.config,quiz.perguntas,true);
 insert into public.acolitos_gincana_rodadas(gincana_id,quiz_id,titulo,perguntas) values(gid,quiz.id,quiz.config->>'titulo',quiz.perguntas) returning id into rid;
 return jsonb_build_object('id',rid);
 elsif p_acao in ('lancar','estornar') then
 if g.status<>'em_andamento' then raise exception 'Inicie a gincana antes de lançar pontos'; end if;
 pid:=(p_dados->>'pedido_id')::uuid;
 if pid is null or length(motivo) not between 1 and 1000 then raise exception 'Pedido e justificativa obrigatórios'; end if;
 select * into l from public.acolitos_gincana_lancamentos where pedido_id=pid;
 if found then
 if l.gincana_id<>gid or l.responsavel<>auth.uid() then raise exception 'Pedido já utilizado'; end if;
 return jsonb_build_object('id',l.id,'repetido',true);
 end if;
 if p_acao='estornar' then
 select * into l from public.acolitos_gincana_lancamentos where id=(p_dados->>'lancamento_id')::uuid and gincana_id=gid;
 if not found or l.estorno_de is not null then raise exception 'Lançamento não encontrado ou é um estorno'; end if;
 if exists(select 1 from public.acolitos_gincana_lancamentos where estorno_de=l.id) then raise exception 'Lançamento já estornado' using errcode='23505'; end if;
 insert into public.acolitos_gincana_lancamentos(gincana_id,casa_id,rodada_id,pergunta_id,valor,justificativa,estorno_de,pedido_id,responsavel)
 values(gid,l.casa_id,l.rodada_id,l.pergunta_id,-l.valor,motivo,l.id,pid,auth.uid()) returning id into lid;
 delete from public.acolitos_gincana_resultados where lancamento_id=l.id;
 else
 cid:=nullif(p_dados->>'casa_id','')::uuid; rid:=nullif(p_dados->>'rodada_id','')::uuid; qid:=nullif(p_dados->>'pergunta_id','')::uuid;
 resultado:=nullif(p_dados->>'resultado','');
 if cid is not null and not exists(select 1 from public.acolitos_gincana_casas where id=cid and gincana_id=gid) then raise exception 'Casa de outra gincana'; end if;
 if rid is not null then
 select x into q from public.acolitos_gincana_rodadas r cross join lateral jsonb_array_elements(r.perguntas) x where r.id=rid and r.gincana_id=gid and x->>'id'=qid::text;
 if q is null then raise exception 'Pergunta ou rodada de outra gincana'; end if;
 if resultado is null or resultado not in ('acerto','erro','anulada','sem_pontos') or (cid is null and resultado in ('acerto','erro')) then raise exception 'Selecione casa e resultado'; end if;
 v:=case resultado when 'acerto' then (g.regras->>(q->>'dificuldade'))::int when 'erro' then (g.regras->>'erro')::int else 0 end;
 else
 if qid is not null or resultado is not null or cid is null then raise exception 'Atividade avulsa exige casa'; end if;
 if coalesce(p_dados->>'valor','') !~ '^-?[0-9]{1,5}$' then raise exception 'Use pontos inteiros'; end if;
 v:=(p_dados->>'valor')::int;
 end if;
 insert into public.acolitos_gincana_lancamentos(gincana_id,casa_id,rodada_id,pergunta_id,valor,resultado,justificativa,pedido_id,responsavel)
 values(gid,cid,rid,qid,v,resultado,motivo,pid,auth.uid()) returning id into lid;
 if rid is not null then insert into public.acolitos_gincana_resultados values(rid,qid,lid); end if;
 end if;
 return jsonb_build_object('id',lid);
 end if;
 raise exception 'Ação desconhecida';
end $$;
revoke all on function public.quiz_operar(text,jsonb) from public;
grant execute on function public.quiz_operar(text,jsonb) to authenticated;
commit;

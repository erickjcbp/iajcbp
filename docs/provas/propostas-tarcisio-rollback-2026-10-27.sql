-- Prova (com ROLLBACK) da migração 117: túnica recebida vira PROPOSTA; só a coordenação decide; conta comum não decide.
begin;
do $$
declare m uuid;c uuid;pid uuid;r jsonb;n int;st text;
begin
 insert into public.acolitos_membros(nome,status,serve,data_nascimento) values('PROVA Proposta (rollback)','em_integracao',true,current_date-interval '9 years') returning id into m;
 insert into public.acolitos_crm(membro_id,etapa) values(m,'tunica');
 insert into public.tarcisio_acolhida(membro_id,acolhido_em) values(m,now()-interval '2 days');
 insert into public.tarcisio_mensagens(id,numero,direcao,texto,respondida) values(gen_random_uuid(),'5519900000001','entrada','Já recebi a túnica',true) returning id into c;
 perform set_config('request.jwt.claim.role','service_role',true);
 r:=public.tarcisio_acolhida_registrar(m,'5519900000001',c,'tunica_recebida');
 select etapa into st from public.acolitos_crm where membro_id=m;
 if st<>'disponivel_escala' then raise exception 'esperava parar em disponivel_escala, achei %',st;end if;
 select id into pid from public.tarcisio_acolhida_propostas where membro_id=m and acao='integrado' and estado='pendente';
 if pid is null then raise exception 'proposta não criada';end if;
 select count(*) into n from public.tarcisio_pendencias where estado='aberta' and dados @> jsonb_build_object('proposta_id',pid);
 if n<>1 then raise exception 'pendência da proposta: %',n;end if;
 -- repetir o fato não duplica a proposta
 r:=public.tarcisio_acolhida_registrar(m,'5519900000001',c,'tunica_recebida');
 select count(*) into n from public.tarcisio_acolhida_propostas where membro_id=m;if n<>1 then raise exception 'proposta duplicada';end if;
 -- conta comum (authenticated sem permissão) NÃO decide
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin perform public.tarcisio_acolhida_decidir(pid,true);raise exception 'conta comum conseguiu decidir';exception when sqlstate '42501' then null;end;
 perform set_config('request.jwt.claim.role','service_role',true);
 select etapa into st from public.acolitos_crm where membro_id=m;if st<>'disponivel_escala' then raise exception 'etapa mudou sem decisão: %',st;end if;
 -- coordenação (service_role vale como coord) confirma: sai da CRM
 r:=public.tarcisio_acolhida_decidir(pid,true);
 select etapa into st from public.acolitos_crm where membro_id=m;if st<>'integrado' then raise exception 'não integrou: %',st;end if;
 select status into st from public.acolitos_membros where id=m;if st<>'ativo' then raise exception 'status %',st;end if;
 if not exists(select 1 from public.acolitos_habilitacoes where membro_id=m and funcao='apoio' and proficiencia='apto') then raise exception 'sem Apoio apto';end if;
 select nivel into st from public.acolitos_membros where id=m;if st is distinct from 'aspirante' then raise exception 'nível %',st;end if;
 -- decidir de novo não repete
 r:=public.tarcisio_acolhida_decidir(pid,true);if (r->>'ok')::boolean then raise exception 'decisão repetida aceita';end if;
 raise notice 'PROVA OK: proposta criada, conta comum barrada, coordenação integra, nível+Apoio pelo gatilho';
end $$;
rollback;

-- Dez medalhas aprovadas pelo dono em 31/10/2026: reconhecimento manual, sem XP.
-- Não são requisitos de nível nem tarefas semanais. Não concede medalhas a ninguém.
with novas(id,label,descricao,icone,ordem) as (values
('ae02cb81-c38b-59ec-a46c-2b912e8f5436'::uuid,'Bom Samaritano','Participar de uma ação solidária e servir quem precisa.','samaritano',1000),
('0e6fa658-90e8-54cd-ab96-5cc4fe0091a7'::uuid,'Coração Acolhedor','Receber e acompanhar novos membros nos primeiros encontros.','acolhedor',1001),
('a188d83c-07db-5c1f-867e-257b9be8940a'::uuid,'Servo dos Bastidores','Ajudar na preparação e organização antes e depois das celebrações.','bastidores',1002),
('ffddc9fa-ceb9-57a1-a533-1cbff8aac446'::uuid,'Ponte da Paz','Ajudar a resolver um desentendimento com respeito e diálogo.','ponte_paz',1003),
('2fbbe92b-3ce1-5bbc-82d9-7b03e985c5c5'::uuid,'Guardião da Criação','Cuidar dos recursos da pastoral, promovendo reutilização e evitando desperdícios.','criacao',1004),
('64faf676-5d46-59c1-9b42-30e8d3fc7d21'::uuid,'Escuta que Transforma','Acolher uma orientação e demonstrar melhora concreta na prática.','escuta',1005),
('e3e89247-dbe8-5d0c-9490-9fef78462626'::uuid,'Coragem de Recomeçar','Retomar o serviço com responsabilidade após uma dificuldade.','recomecar',1006),
('501749da-47ba-524c-b843-3342317d9434'::uuid,'Semeador da Palavra','Preparar e partilhar uma reflexão do Evangelho na formação.','palavra_semeada',1007),
('48c81656-d6db-5d56-a1f2-ca0301200696'::uuid,'Amigo de Todos','Incluir ativamente quem estava isolado nas atividades.','amigo_todos',1008),
('a4bdff49-ed32-519a-b3af-55458abec35d'::uuid,'Memória Viva','Organizar e preservar materiais e aprendizados para as próximas equipes.','memoria',1009)
)
insert into public.acolitos_missoes(id,titulo,descricao,tipo,validacao,xp,nivel_alvo,aplica_de,criterio,concede_badge,badge_icone,badge_label,badge_desc,badge_tier,ativo,ordem,capitulo,obrigatoria,recorrente,exclusiva)
select id,label,descricao,'bonus','avaliada',0,null,'__coordenacao__',null,true,icone,label,descricao,'ouro',true,ordem,null,false,false,false from novas
on conflict(id) do nothing;

-- O catálogo passa de 50 medalhas; permite selecionar todo o catálogo em um lote.
create or replace function public.acolitos_medalhas_multiplas(p_medalhas uuid[],p_membros uuid[],p_motivo text default '',p_confirmar boolean default false) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare medalhas uuid[];membros uuid[];medalha uuid;r jsonb;itens jsonb:='[]'::jsonb;novas integer:=0;existentes integer:=0;motivo text;
begin
 if coalesce(public.acolitos_get_role(auth.uid()),'') not in ('coord_admin','subadmin') then raise exception 'Só a coordenação pode conceder medalhas' using errcode='42501';end if;
 if p_confirmar is null then raise exception 'Confirmação inválida';end if;
 if coalesce(cardinality(p_medalhas),0)=0 or cardinality(p_medalhas)>100 or array_position(p_medalhas,null) is not null then raise exception 'Selecione de 1 a 100 medalhas';end if;
 if coalesce(cardinality(p_membros),0)=0 or cardinality(p_membros)>500 or array_position(p_membros,null) is not null then raise exception 'Selecione de 1 a 500 membros';end if;
 if length(coalesce(p_motivo,''))>500 then raise exception 'Motivo com no máximo 500 caracteres';end if;
 select array_agg(distinct x order by x) into medalhas from unnest(p_medalhas) x;
 select array_agg(distinct x order by x) into membros from unnest(p_membros) x;
 motivo:=coalesce(nullif(btrim(p_motivo),''),'Reconhecimento da coordenação');
 if length(motivo)<3 then motivo:='Reconhecimento: '||motivo;end if;
 -- Adquire todos os locks antes das escritas para evitar ordem invertida entre lotes.
 perform pg_advisory_xact_lock(hashtextextended('missao:'||b::text||':'||m::text,0)) from unnest(medalhas) b cross join unnest(membros) m order by b,m;
 foreach medalha in array medalhas loop
  r:=public.acolitos_medalhas_lote(medalha,membros,motivo,p_confirmar);
  novas:=novas+(r->>'novas')::integer;existentes:=existentes+(r->>'existentes')::integer;
  itens:=itens||jsonb_build_array(jsonb_build_object('medalha_id',medalha,'label',(select badge_label from public.acolitos_missoes where id=medalha),'novas',(r->>'novas')::integer,'existentes',(r->>'existentes')::integer,'membros',r->'membros'));
 end loop;
 return jsonb_build_object('ok',true,'confirmado',p_confirmar,'total_membros',cardinality(membros),'total_medalhas',cardinality(medalhas),'novas',novas,'existentes',existentes,'itens',itens);
end $$;
revoke all on function public.acolitos_medalhas_multiplas(uuid[],uuid[],text,boolean) from public,anon,authenticated;
grant execute on function public.acolitos_medalhas_multiplas(uuid[],uuid[],text,boolean) to authenticated;
notify pgrst,'reload schema';

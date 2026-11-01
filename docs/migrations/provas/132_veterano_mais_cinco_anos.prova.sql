-- Executar após132 em transação com ROLLBACK.
do $$declare f uuid;mi public.acolitos_missoes;hoje date:=(now() at time zone 'America/Sao_Paulo')::date;inicio date;begin
 select id into strict f from acolitos_membros where status='ativo' and serve is true limit 1;
 select * into strict mi from acolitos_missoes where badge_icone='tempo_veterano';
 assert mi.criterio->>'apos_marco'='true';assert mi.criterio->>'nivel_min'='cerimoniario_aspirante';assert mi.xp=100;
 assert public._acolitos_medalha_detalhes(mi)->>'requisito' like '%mais de 5 anos%';
 inicio:=(hoje-interval '5 years')::date;
 update acolitos_membros set nivel='cerimoniario_aspirante',servindo_desde=inicio where id=f;
 assert not acolitos_badge_cumpre(f,mi.criterio),'Exatamente5anos ganhou Veterano';
 assert acolitos_badge_cumpre(f,'{"fonte":"tenure","meses":60}'),'Coluna do Altar perdeu limite inclusivo';
 update acolitos_membros set servindo_desde=inicio+1 where id=f;
 assert not acolitos_badge_cumpre(f,mi.criterio),'Menos5anos ganhou';
 update acolitos_membros set servindo_desde=inicio-1 where id=f;
 assert acolitos_badge_cumpre(f,mi.criterio),'Mais5anos não ganhou';
 assert _badge_data_ganho(f,mi.criterio)=(hoje::timestamp at time zone 'America/Sao_Paulo'),'Data não é o dia seguinte ao marco';
 update acolitos_membros set nivel='aspirante_cerimoniario' where id=f;
 assert not acolitos_badge_cumpre(f,mi.criterio),'Aspirante a Cerimoniário ganhou';
end $$;
select '132: antes/exato/depois de5anos, Coluna inclusiva, nível e data OK';

create temp table avatar132_fixture as select id,user_id from acolitos_membros where user_id is not null and status='ativo' and acolitos_get_role(user_id) is not null limit 1;
grant select on avatar132_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from avatar132_fixture),true);
set local role authenticated;
do $$declare f record;r jsonb;begin
 select * into strict f from avatar132_fixture;r:=acolitos_avatares_identidade_lote(array[f.id]);
 assert (r->f.id::text)->>'id'=f.id::text,'Membro não consulta perfil visual';
 assert not exists(select 1 from jsonb_object_keys(r->f.id::text) k where k not in('id','foto_url','nivel','casa_id','casa_slug')),'Perfil visual expõe dados extras';
 begin perform acolitos_avatares_identidade_lote(array_fill(f.id,array[501]));raise exception 'Aceita mais500';exception when raise_exception then assert sqlerrm='Lista de membros inválida';end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
set local role authenticated;
do $$begin begin perform acolitos_avatares_identidade_lote('{}'::uuid[]);raise exception 'Conta sem vínculo acessa';exception when insufficient_privilege then null;end;end $$;
reset role;
set local role anon;
do $$begin begin perform acolitos_avatares_identidade_lote('{}'::uuid[]);raise exception 'Anon acessa';exception when insufficient_privilege then null;end;end $$;
reset role;
select '132: perfil visual limitado, membro/sem vínculo/anon e limite500 OK';

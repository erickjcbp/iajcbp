-- Sempre em BEGIN/ROLLBACK, após131. Nenhuma ficha de prova deve persistir.
do $$declare f uuid;mi public.acolitos_missoes;slug text;i integer:=0;r jsonb;begin
 select id into strict f from acolitos_membros where status='ativo' and serve is true limit 1;
 select * into strict mi from acolitos_missoes where badge_icone='tempo_veterano';
 assert mi.criterio->>'nivel_min'='cerimoniario_aspirante','Veterano ainda aceita Acólitos';
 assert mi.xp=100 and (mi.criterio->>'meses')::int=60,'Alterou XP ou tempo';
 assert public._acolitos_medalha_detalhes(mi)->>'requisito' like '%Cerimoniário Aspirante ou superior%','Texto não corresponde ao critério';
 update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '6 years')::date where id=f;
 foreach slug in array array['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'] loop
  i:=i+1;update acolitos_membros set nivel=slug where id=f;
  assert public.acolitos_badge_cumpre(f,mi.criterio)=(i>=7),'Nível indevido: '||slug;
 end loop;
 update acolitos_membros set servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '4 years')::date where id=f;
 assert not public.acolitos_badge_cumpre(f,mi.criterio),'Mor com menos de5anos ganhou';
 delete from acolitos_missao_progresso where membro_id=f and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
 delete from acolitos_badge_ganhos where membro_id=f and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
 delete from acolitos_medalhas_manuais where membro_id=f and missao_id in(select id from acolitos_missoes where criterio->>'fonte' in('tenure','tenure_nivel'));
 update acolitos_membros set nivel='acolito_sentinela',servindo_desde=((now() at time zone 'America/Sao_Paulo')::date-interval '6 years')::date where id=f;
 r:=public.acolitos_tempo_processar(f);assert (r->>'novas')::int=4,'Sentinela deve ganhar só1/2/3/5anos';
 update acolitos_membros set nivel='aspirante_cerimoniario' where id=f;
 assert (public.acolitos_tempo_processar(f)->>'novas')::int=0,'Aspirante a Cerimoniário ganhou Veterano';
 update acolitos_membros set nivel='cerimoniario_aspirante' where id=f;
 assert (public.acolitos_tempo_processar(f)->>'novas')::int=1,'Cerimoniário não ganhou Veterano';
 assert (select xp_ganho from acolitos_missao_progresso where membro_id=f and missao_id=mi.id)=100,'XP Veterano incorreto';
 assert (public.acolitos_tempo_processar(f)->>'novas')::int=0,'Duplicou Veterano';
end $$;
select '131: dez níveis, limite5anos, texto, concessão e XP único OK';

-- Aplicada e conferida no Supabase Coroinhas em 10/10/2026.
-- Aplicar depois de db/seguranca/014_novena_local_e_outras_comunidades.sql.
-- Mantém o registro das 8h30 e usa o modelo de outras comunidades já criado pelo dono.
-- O modelo especial com dez apoios vale só para 7h/11h.
begin;

do $$
declare v_n integer; v_h integer;
begin
  perform pg_advisory_xact_lock(hashtext('acolitos_aparecida_2026_10_12'));
  select count(*) into v_n from public.acolitos_celebracoes
    where data = '2026-10-12' and minutos = 510;
  if v_n <> 1 then
    raise exception 'Esperava uma única missa de 12/10 às 8h30; encontrei %. Conferir antes de alterar.', v_n;
  end if;
  if not exists (select 1 from public.acolitos_modelos where tipo='solene' and comunidade='outras_comunidades' and quantidade>0) then
    raise exception 'Modelo de outras comunidades não encontrado.';
  end if;
  if exists (select 1 from public.acolitos_escalas e join public.acolitos_celebracoes c on c.id=e.celebracao_id
             where c.data='2026-10-12' and c.minutos=510 and e.status='escalado'
               and not exists (select 1 from public.acolitos_modelos mo where mo.tipo=c.tipo and mo.comunidade='outras_comunidades' and mo.funcao=e.funcao and mo.quantidade>0)) then
    raise exception 'Há inscrição das 8h30 incompatível com o modelo de outras comunidades.';
  end if;
  foreach v_h in array array[420,660] loop
    select count(*) into v_n from public.acolitos_celebracoes
      where data = '2026-10-12' and minutos = v_h and comunidade = 'matriz';
    if v_n > 1 then raise exception 'Há missas duplicadas às % minutos; conferir cadastro.', v_h; end if;
  end loop;
end $$;

insert into public.acolitos_listas(tipo,valor,label)
values ('tipo_celebracao','aparecida_12_outubro','Nossa Senhora Aparecida — 12/10')
on conflict (tipo,valor) do nothing;

insert into public.acolitos_modelos(tipo,comunidade,funcao,quantidade,ordem)
select 'aparecida_12_outubro','matriz',funcao,quantidade,ordem
from (values
  ('cred_altar',1,1), ('cred_credencia',1,2), ('turibulo',1,3), ('naveta',1,4),
  ('altar',3,5), ('missal',1,6), ('sinao',1,7), ('sineta',1,8),
  ('cruz',1,9), ('vela',2,10), ('apoio',10,11)
) as vagas(funcao,quantidade,ordem)
on conflict (tipo,comunidade,funcao)
do update set quantidade = excluded.quantidade, ordem = excluded.ordem;

insert into public.acolitos_celebracoes(data,horario,comunidade,tipo,observacoes)
select '2026-10-12',horario,'matriz','aparecida_12_outubro',
       'Novena — Nossa Senhora Aparecida — 12/10'
from (values ('7h',420),('11h',660)) as missas(horario,minutos)
where not exists (
  select 1 from public.acolitos_celebracoes c
  where c.data = '2026-10-12' and c.minutos = missas.minutos and c.comunidade = 'matriz'
);

update public.acolitos_celebracoes
set tipo = 'aparecida_12_outubro',
    observacoes = case when observacoes ilike 'Novena%' then observacoes
      else concat_ws(E'\n','Novena — Nossa Senhora Aparecida — 12/10',nullif(observacoes,'')) end
where data = '2026-10-12' and minutos in (420,660) and comunidade = 'matriz';

-- Corrige a comunidade das 8h30 para o modelo já cadastrado. Nenhuma escala é alterada.
update public.acolitos_celebracoes
set comunidade = 'outras_comunidades', observacoes = concat_ws(E'\n',
      case when observacoes ilike 'Novena%' then
        nullif(btrim(regexp_replace(observacoes,E'(^|\n)Local: [^\r\n]*','','g')),'')
      else concat_ws(E'\n','Novena — Nossa Senhora Aparecida — 12/10',nullif(observacoes,'')) end,
      'Local: Morro Alto')
where data = '2026-10-12' and minutos = 510;

-- Revisar as três linhas e o modelo antes de confirmar aplicação.
select id,data,horario,comunidade,tipo,observacoes
from public.acolitos_celebracoes where data = '2026-10-12' order by minutos;
select funcao,quantidade from public.acolitos_modelos
where tipo = 'aparecida_12_outubro' and comunidade = 'matriz' order by ordem;

commit;

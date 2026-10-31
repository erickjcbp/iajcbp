-- 126 — Link universal (/novena) passa a servir a Liturgia de Finados (2026-10-31)
-- Domingo 01/11 (7h, 9h, 19h, matriz): escala já montada; o link só oferece turíbulo e naveta.
-- Segunda 02/11 às 8h (matriz): cerimoniários completos + cruz + velas + turíbulo + naveta.
-- A novena de Aparecida já passou (o link só lista data >= hoje); nenhuma escala existente é alterada.
begin;

do $$
declare v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('acolitos_finados_2026'));
  select count(*) into v_n from public.acolitos_celebracoes
    where data = '2026-11-01' and comunidade = 'matriz' and minutos in (420,540,1140);
  if v_n <> 3 then
    raise exception 'Esperava 3 missas de 01/11 (7h, 9h, 19h) na matriz; encontrei %.', v_n;
  end if;
  if exists (select 1 from public.acolitos_celebracoes where data = '2026-11-02' and minutos = 480 and comunidade = 'matriz') then
    raise exception 'A missa de 02/11 às 8h já existe; conferir antes de duplicar.';
  end if;
end $$;

insert into public.acolitos_listas(tipo,valor,label) values
  ('tipo_celebracao','finados_domingo','Liturgia de Finados — domingo 01/11'),
  ('tipo_celebracao','finados_segunda','Liturgia de Finados — segunda 02/11')
on conflict (tipo,valor) do nothing;

-- Domingo: mesmo modelo da missa comum (escalados atuais continuam válidos) + turíbulo e naveta
insert into public.acolitos_modelos(tipo,comunidade,funcao,quantidade,ordem)
select 'finados_domingo', comunidade, funcao,
       case when funcao in ('turibulo','naveta') then 1 else quantidade end, ordem
from public.acolitos_modelos where tipo = 'missa_comum' and comunidade = 'matriz'
on conflict (tipo,comunidade,funcao) do update set quantidade = excluded.quantidade, ordem = excluded.ordem;

-- Segunda 8h: só o que o dono pediu
insert into public.acolitos_modelos(tipo,comunidade,funcao,quantidade,ordem)
select 'finados_segunda','matriz',funcao,quantidade,ordem
from (values
  ('cred_altar',1,1), ('cred_credencia',1,2), ('missal',1,3), ('cruz',1,4), ('vela',2,5),
  ('turibulo',1,6), ('naveta',1,7),
  ('altar',3,8), ('sineta',0,9), ('sinao',0,10), ('apoio',10,11), ('mitra',0,12), ('baculo',0,13)
) as v(funcao,quantidade,ordem)
on conflict (tipo,comunidade,funcao) do update set quantidade = excluded.quantidade, ordem = excluded.ordem;

update public.acolitos_celebracoes
set tipo = 'finados_domingo', novena_publica = true,
    observacoes = concat_ws(E'\n','Liturgia de Finados — domingo 01/11', nullif(observacoes,''))
where data = '2026-11-01' and comunidade = 'matriz' and minutos in (420,540,1140);

insert into public.acolitos_celebracoes(data,horario,comunidade,tipo,observacoes,novena_publica)
values ('2026-11-02','8h','matriz','finados_segunda','Liturgia de Finados — segunda 02/11',true);

select id,data,horario,comunidade,tipo,novena_publica from public.acolitos_celebracoes where data in ('2026-11-01','2026-11-02') order by data,minutos;
commit;

-- Somente leitura. Consultar em produção para validar a recorrência.
select chave,valor,updated_at from public.acolitos_config
where chave = 'celebracoes_geradas_ate';

-- Marca atual é evidência de execução do abastecimento; logs da Vercel confirmam
-- se a execução foi agendada. Não rodar cron-crm manualmente: ele também envia avisos.
with grade(dia,horario,comunidade) as (
  values (6,'17h','matriz'),(6,'18h30','santo_antonio'),
         (0,'7h','matriz'),(0,'9h','matriz'),(0,'19h','matriz')
), esperadas as (
  select d::date as data,g.horario,g.comunidade
  from generate_series(current_date::timestamp,(current_date+56)::timestamp,interval '1 day') d
  join grade g on g.dia = extract(dow from d)
)
select e.data,e.horario,e.comunidade
from esperadas e left join public.acolitos_celebracoes c
  on c.data=e.data and c.minutos=public.acolitos_minutos_do_horario(e.horario)
  and c.comunidade=e.comunidade
where c.id is null order by e.data,e.horario;
-- Lacunas podem ser exclusões manuais intencionais. Não recriar automaticamente.

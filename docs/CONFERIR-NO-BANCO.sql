-- ============================================================
-- ACÓLITOS — conferir se as migrations 052, 053 e 054 pegaram
--
-- Cole tudo e clique em Run. É SÓ LEITURA: não grava, não apaga, não muda nada.
-- Cada linha do resultado diz "OK" ou "FALTA". Me mande o que aparecer.
-- ============================================================

select '2. dá para ser responsável sem eh_equipe (053)' as conferencia,
       case when not exists (
              select 1 from pg_proc
              where proname = 'acolitos_responsaveis_de_tarefa'
                and pg_get_functiondef(oid) ilike '%eh_equipe%')
            then 'OK — a regra é só estar num time'
            else 'FALTA — a função ainda exige eh_equipe' end as resultado
union all
select '3. aprovar candidatura confere a vaga (052)',
       case when exists (
              select 1 from pg_proc
              where proname = 'acolitos_solicitacao_decidir'
                and pg_get_functiondef(oid) ilike '%vaga_cheia%')
            then 'OK — recusa quando a função já está completa'
            else 'FALTA — ainda insere sem conferir' end
union all
select '4. a recorrente sabe de onde nasceu (054)',
       case when exists (
              select 1 from information_schema.columns
              where table_name = 'acolitos_tarefas' and column_name = 'origem_id')
            then 'OK — coluna origem_id existe'
            else 'FALTA — sem origem_id' end
union all
select '5. quantas pessoas podem ser responsáveis agora',
       (select count(*)::text from public.acolitos_responsaveis_de_tarefa())
       || ' pessoa(s) — se der 4 ou menos, o problema é que quase ninguém está num time'
union all
select '6. quantas pessoas estão em algum time',
       (select count(*)::text from public.acolitos_membros
        where status = 'ativo' and setores is not null and array_length(setores,1) > 0)
       || ' pessoa(s) — este é o número que a 053 destrava'
order by 1;

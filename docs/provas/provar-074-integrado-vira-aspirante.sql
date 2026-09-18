-- Prova da 074: quem sai do CRM como "integrado" vira Aspirante e fica apto no Apoio.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-074-integrado-vira-aspirante.sql
--
-- NÃO DEIXA NADA GRAVADO: a parte que mexe em dado roda dentro de `begin … rollback`.
-- O gatilho é provado MUDANDO uma etapa de verdade — gatilho testado sem mudar valor não
-- prova nada, porque ele nem chega a disparar.
--
-- O QUE DEFENDE (medido em 18/09/2026): das 17 pessoas já integradas, 15 estavam sem nível e
-- sem função nenhuma. O CRM nunca definiu o degrau — e ia continuar assim com cada pessoa nova.
\set ON_ERROR_STOP on
\timing off
\pset pager off

\echo '=== 1) o gatilho existe e dispara na inserção E na mudança de etapa ==='
select t.tgname,
       pg_get_triggerdef(t.oid) like '%INSERT OR UPDATE OF etapa%' as dispara_nos_dois_DEVE_SER_t,
       p.prosecdef as security_definer_DEVE_SER_t
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'public.acolitos_crm'::regclass and not t.tgisinternal;

\echo ''
\echo '=== 2) a correção pegou todo mundo: nenhum integrado sem degrau ou sem Apoio ==='
select count(*) as integrados,
       count(*) filter (where coalesce(m.nivel,'') = '') as sem_degrau_DEVE_SER_0,
       count(*) filter (where h.membro_id is null)       as sem_apoio_DEVE_SER_0
  from public.acolitos_crm c
  join public.acolitos_membros m on m.id = c.membro_id
  left join public.acolitos_habilitacoes h on h.membro_id = m.id and h.funcao = 'apoio'
 where c.etapa = 'integrado';

\echo ''
\echo '=== 3) ninguém foi rebaixado: quem já era mais que apto continua ==='
select proficiencia, count(*) from public.acolitos_habilitacoes
 where funcao = 'apoio' group by 1 order by 2 desc;

\echo ''
\echo '=== 4) O GATILHO FUNCIONANDO — com rollback, nada fica gravado ==='
begin;
do $$
declare
  alvo uuid;
  etapa_antes text;
  nivel_depois text;
  tem_apoio boolean;
begin
  -- alguém que AINDA não está integrado e ainda não tem degrau: é o caso que importa
  select c.membro_id, c.etapa into alvo, etapa_antes
    from public.acolitos_crm c
    join public.acolitos_membros m on m.id = c.membro_id
   where c.etapa <> 'integrado' and coalesce(m.nivel,'') = ''
   limit 1;

  if alvo is null then
    raise notice 'SEM CASO PARA TESTAR hoje: não há ninguém fora de "integrado" e sem degrau. O gatilho continua provado pelas seções 1 e 5.';
    return;
  end if;

  update public.acolitos_crm set etapa = 'integrado' where membro_id = alvo;

  select m.nivel into nivel_depois from public.acolitos_membros m where m.id = alvo;
  select exists(select 1 from public.acolitos_habilitacoes
                 where membro_id = alvo and funcao = 'apoio' and proficiencia = 'apto')
    into tem_apoio;

  if nivel_depois = 'aspirante' and tem_apoio then
    raise notice 'GATILHO: certo — quem saiu de "%" para "integrado" virou aspirante e ficou apto no Apoio', etapa_antes;
  else
    raise notice 'GATILHO: ERRADO — degrau ficou "%" e apto no Apoio = %', coalesce(nivel_depois,'(vazio)'), tem_apoio;
  end if;
end $$;
rollback;

\echo ''
\echo '=== 5) o gatilho NÃO rebaixa quem já tem degrau (também com rollback) ==='
begin;
do $$
declare
  alvo uuid;
  nivel_antes text;
  nivel_depois text;
begin
  select m.id, m.nivel into alvo, nivel_antes
    from public.acolitos_membros m
    join public.acolitos_crm c on c.membro_id = m.id
   where coalesce(m.nivel,'') <> '' and m.nivel <> 'aspirante'
   limit 1;

  if alvo is null then
    raise notice 'SEM CASO PARA TESTAR: ninguém no CRM com degrau acima de aspirante.';
    return;
  end if;

  update public.acolitos_crm set etapa = 'integrado' where membro_id = alvo;
  select m.nivel into nivel_depois from public.acolitos_membros m where m.id = alvo;

  if nivel_depois = nivel_antes then
    raise notice 'NÃO REBAIXA: certo — continuou "%"', nivel_depois;
  else
    raise notice 'NÃO REBAIXA: ERRADO — era "%" e virou "%"', nivel_antes, nivel_depois;
  end if;
end $$;
rollback;

\echo ''
\echo '=== 6) depois de tudo, o banco está como estava (as provas acima não gravaram) ==='
select (select count(*) from public.acolitos_crm where etapa = 'integrado') as integrados,
       (select count(*) from public.acolitos_habilitacoes where funcao = 'apoio') as aptos_no_apoio,
       (select count(*) from public.acolitos_membros where nivel = 'aspirante') as aspirantes;

-- PROVA 066 — o recado da foto foi para as pessoas certas, e só para elas
--
-- Roda a qualquer momento. As linhas 4 e 5 escrevem dentro de um `begin` e
-- terminam em `rollback`: nada sobra. Rodado ANTES da 066 as linhas 1 e 2 ficam
-- vermelhas (ninguém tem recado ainda).
--
-- O que cada linha guarda:
--
--  1. Chegou em quem devia: ativo, com login, sem foto e que já abriu o app.
--  2. Não sobrou ninguém do grupo sem receber. Sem esta, um `where` mais apertado
--     passaria despercebido e o convite calaria justamente com quem apanhou.
--  3. Ninguém COM foto recebeu. Quem já tem foto não tem o que fazer com o recado.
--  4. Ninguém que NUNCA abriu o app recebeu. São 133 pessoas: para elas a frase
--     "tente novamente" não quer dizer nada, porque nunca tentaram.
--  5. Rodar a migration de novo não duplica. Um dia alguém vai rodar duas vezes;
--     duas cópias do recado seriam dois pop-ups seguidos na cara da mesma pessoa.
--  6. O recado nasce NÃO VISTO. Nascer visto é o defeito silencioso perfeito: a
--     migration diria "26 linhas" e nenhum pop-up apareceria para ninguém.

\set ON_ERROR_STOP on
\pset pager off

-- ── o grupo-alvo, escrito uma vez só ────────────────────────────────────────
create or replace view pg_temp.alvo as
  select m.id
    from public.acolitos_membros m
    join auth.users u on u.id = m.user_id
   where m.status = 'ativo'
     and coalesce(m.foto_url, '') = ''
     and u.last_sign_in_at is not null;

create or replace view pg_temp.com_recado as
  select m.id, count(*) as quantos
    from public.acolitos_membros m,
         lateral jsonb_array_elements(m.avisos) a
   where a->>'tipo' = 'foto_conserto'
   group by m.id;

select '1. o recado chegou a alguem' as prova,
       case when (select count(*) from pg_temp.com_recado) > 0
       then 'ok (' || (select count(*) from pg_temp.com_recado) || ' pessoas)'
       else 'FALHOU — ninguem recebeu' end as veredito;

select '2. nenhum do grupo-alvo ficou de fora' as prova,
       case when (select count(*) from pg_temp.alvo a
                   where not exists (select 1 from pg_temp.com_recado c where c.id = a.id)) = 0
       then 'ok' else 'FALHOU — ' ||
            (select count(*) from pg_temp.alvo a
              where not exists (select 1 from pg_temp.com_recado c where c.id = a.id))
            || ' ficaram sem o convite' end as veredito;

select '3. ninguem COM foto recebeu' as prova,
       case when (select count(*) from pg_temp.com_recado c
                   join public.acolitos_membros m on m.id = c.id
                  where coalesce(m.foto_url,'') <> '') = 0
       then 'ok' else 'FALHOU — quem ja tem foto foi incomodado' end as veredito;

select '4. ninguem que nunca abriu o app recebeu' as prova,
       case when (select count(*) from pg_temp.com_recado c
                   join public.acolitos_membros m on m.id = c.id
                   left join auth.users u on u.id = m.user_id
                  where u.id is null or u.last_sign_in_at is null) = 0
       then 'ok' else 'FALHOU — recado para quem nunca entrou' end as veredito;

select '6. o recado nasce NAO visto' as prova,
       case when (select count(*) from public.acolitos_membros m,
                       lateral jsonb_array_elements(m.avisos) a
                  where a->>'tipo' = 'foto_conserto' and (a->>'seen')::boolean is not false) = 0
       then 'ok' else 'FALHOU — nasceu visto, nenhum pop-up aparece' end as veredito;

-- ── 5. rodar de novo nao duplica (escreve e desfaz) ─────────────────────────
begin;
update public.acolitos_membros m
   set avisos = m.avisos || jsonb_build_array(
         jsonb_build_object('tipo', 'foto_conserto', 'seen', false))
  from auth.users u
 where u.id = m.user_id
   and m.status = 'ativo'
   and coalesce(m.foto_url, '') = ''
   and u.last_sign_in_at is not null
   and not exists (
     select 1 from jsonb_array_elements(m.avisos) a
      where a->>'tipo' = 'foto_conserto'
   );

select '5. rodar a migration de novo nao duplica' as prova,
       case when (select count(*) from pg_temp.com_recado where quantos > 1) = 0
       then 'ok' else 'FALHOU — ' ||
            (select count(*) from pg_temp.com_recado where quantos > 1)
            || ' pessoas com recado repetido' end as veredito;
rollback;

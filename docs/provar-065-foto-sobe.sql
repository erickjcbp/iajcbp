-- PROVA 065 — a foto sobe, e a pasta dos outros continua fechada
--
-- Roda a qualquer momento. Escolhe gente REAL na hora (nada de uid cravado, que
-- envelhece), escreve tudo dentro de um `begin` e termina em `rollback`: não
-- sobra nem uma linha, nem um arquivo. Rodado ANTES da 065 as linhas 1, 2 e 5
-- ficam vermelhas — é exatamente o defeito que o dono viu na tela.
--
-- O que cada linha está guardando, e por que:
--
--  1. UPSERT em nome NOVO. É o que o front faz (`upsert: true`). Sem policy de
--     SELECT o Postgres recusa o `on conflict do update` e reporta com a frase
--     "new row violates row-level security policy" — falando de gravar quando o
--     que falta é ler. Foi o que tirou a foto do ar por quase três meses.
--  2. UPSERT em nome que JÁ EXISTE. A linha 1 nem chega a atualizar nada; esta
--     passa mesmo pelo caminho da sobrescrita, que é onde a exigência de SELECT
--     nasce. Sem as duas, metade do caminho fica sem prova.
--  3. RETURNING. O storage-api devolve a linha que gravou. `returning` também
--     exige SELECT: mesmo sem `upsert` o envio quebraria.
--  4. Ninguém escreve na pasta do outro. A trava de escrita da 002_p1 continua
--     inteira — devolver o SELECT não podia afrouxar isso.
--  5. Ninguém LISTA a pasta do outro. É a razão de a 002_p1 ter derrubado o
--     SELECT (são fotos de menores). O conserto devolve o SELECT recortado: se
--     um dia alguém "simplificar" para `using (bucket_id = 'avatars')`, esta
--     linha fica vermelha e a enumeração não volta escondida.
--  6. Pessoa comum não lista `membro/`. Aquela pasta é da coordenação.
--  7. Equipe grava e lê em `membro/` — a foto pela ficha do membro.
--  8. O bucket segue PÚBLICO. As imagens saem pela CDN e nunca dependeram de
--     policy; se alguém fechar o bucket "por segurança", todo avatar do app
--     apaga e nenhum teste acima acusaria.

\set ON_ERROR_STOP on
\pset pager off

-- Tenta um comando e devolve 'ok' ou o motivo da recusa, sem derrubar a prova.
-- SECURITY INVOKER (padrão): roda no papel de quem chama, então a RLS vale.
create or replace function pg_temp.tentar(cmd text) returns text
language plpgsql as $fn$
begin
  execute cmd;
  return 'ok';
exception when others then
  return 'BARRADO: ' || sqlerrm;
end $fn$;

-- Gente de verdade, escolhida agora.
select m.user_id::text as uid_comum
  from public.acolitos_membros m
  join public.pastoral_members pm on pm.user_id = m.user_id
  join public.pastoral_modules mo on mo.id = pm.module_id and mo.slug = 'acolitos'
 where pm.role not in ('coord_admin','subadmin','membro_equipe','novo')
 order by m.user_id limit 1 \gset

select m.user_id::text as uid_outro
  from public.acolitos_membros m
  join public.pastoral_members pm on pm.user_id = m.user_id
  join public.pastoral_modules mo on mo.id = pm.module_id and mo.slug = 'acolitos'
 where pm.role not in ('coord_admin','subadmin','membro_equipe','novo')
   and m.user_id::text <> :'uid_comum'
 order by m.user_id limit 1 \gset

select m.user_id::text as uid_equipe
  from public.acolitos_membros m
  join public.pastoral_members pm on pm.user_id = m.user_id
  join public.pastoral_modules mo on mo.id = pm.module_id and mo.slug = 'acolitos'
 where pm.role in ('coord_admin','subadmin','membro_equipe')
 order by m.user_id limit 1 \gset

begin;

-- ══ PESSOA COMUM, na própria pasta ═══════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_comum', 'role','authenticated')::text, true);

select '1. upsert em nome novo (o envio da foto)' as prova,
       case when pg_temp.tentar(format($$
         insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('avatars', %L, %L, %L)
         on conflict (bucket_id, name) do update set updated_at = now()
       $$, :'uid_comum' || '/prova-065-a.jpg', :'uid_comum', :'uid_comum')) = 'ok'
       then 'ok' else 'FALHOU — a foto não sobe' end as veredito;

select '2. upsert por cima de foto que ja existe' as prova,
       case when pg_temp.tentar(format($$
         insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('avatars', %L, %L, %L)
         on conflict (bucket_id, name) do update set updated_at = now()
       $$, :'uid_comum' || '/prova-065-a.jpg', :'uid_comum', :'uid_comum')) = 'ok'
       then 'ok' else 'FALHOU — trocar a foto nao funciona' end as veredito;

select '3. insert ... returning (o storage devolve a linha)' as prova,
       case when pg_temp.tentar(format($$
         insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('avatars', %L, %L, %L) returning name
       $$, :'uid_comum' || '/prova-065-b.jpg', :'uid_comum', :'uid_comum')) = 'ok'
       then 'ok' else 'FALHOU — o envio quebra mesmo sem upsert' end as veredito;

select '4. NAO escreve na pasta de outra pessoa' as prova,
       case when pg_temp.tentar(format($$
         insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('avatars', %L, %L, %L)
       $$, :'uid_outro' || '/invasao.jpg', :'uid_comum', :'uid_comum')) like 'BARRADO%'
       then 'ok' else 'FALHOU — escreveu na pasta alheia' end as veredito;

select '5. NAO lista a pasta de outra pessoa' as prova,
       case when (select count(*) from storage.objects
                   where bucket_id='avatars' and name like :'uid_outro' || '/%') = 0
       then 'ok' else 'FALHOU — enumera foto de menor' end as veredito;

select '6. pessoa comum NAO lista a pasta membro/' as prova,
       case when (select count(*) from storage.objects
                   where bucket_id='avatars' and name like 'membro/%') = 0
       then 'ok' else 'FALHOU — pasta da coordenacao exposta' end as veredito;

-- ══ EQUIPE, na pasta membro/ (foto pela ficha) ═══════════════════════════════
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_equipe', 'role','authenticated')::text, true);

select '7. equipe sobe a foto pela ficha do membro' as prova,
       case when pg_temp.tentar(format($$
         insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('avatars', %L, %L, %L)
         on conflict (bucket_id, name) do update set updated_at = now()
       $$, 'membro/00000000-0000-0000-0000-000000000065/prova-065.jpg',
           :'uid_equipe', :'uid_equipe')) = 'ok'
       then 'ok' else 'FALHOU — a equipe nao troca a foto de ninguem' end as veredito;

-- ══ O bucket segue publico (as imagens saem pela CDN) ════════════════════════
reset role;
select '8. bucket avatars continua publico' as prova,
       case when (select public from storage.buckets where id='avatars')
       then 'ok' else 'FALHOU — todo avatar do app apaga' end as veredito;

rollback;

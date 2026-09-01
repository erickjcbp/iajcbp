-- Acólitos 065 — a foto volta a subir
--
-- SINTOMA: "Não foi possível enviar a foto. new row violates row-level security
-- policy". Vale para TODO MUNDO desde 09/06/2026 — a última foto que entrou no
-- bucket é de 07/06, dois dias antes do endurecimento.
--
-- CAUSA: a `002_p1_storage_searchpath` derrubou a policy de SELECT do bucket
-- `avatars` (com razão: qualquer logado LISTAVA a foto de todo mundo, e são
-- fotos de menores) e não pôs nenhuma no lugar. Só que quem grava a foto
-- precisa poder LER a linha que acabou de gravar:
--
--   · o front sobe com `upsert: true`, que no banco vira
--     `insert ... on conflict do update` — e o Postgres exige policy de SELECT
--     para o `on conflict do update`;
--   · o próprio storage-api devolve a linha gravada (`returning`), e `returning`
--     também exige SELECT.
--
-- Sem policy de SELECT os dois estouram, e o Postgres reporta as duas coisas com
-- a MESMA frase: "new row violates row-level security policy". Por isso o erro
-- fala de gravar quando o que falta é ler. A migration 009 já tinha tropeçado
-- nisto e deixou o aviso escrito; a 002_p1 refez o buraco sem ver o aviso.
--
-- CONSERTO: devolver o SELECT, mas RECORTADO no mesmo desenho das policies de
-- escrita — cada um enxerga a própria pasta `{uid}/`, e a equipe enxerga
-- `membro/`. Ninguém volta a listar a pasta dos outros, então a enumeração que
-- a 002_p1 fechou continua fechada. As imagens em si nunca dependeram disto:
-- o bucket é público e elas saem pela CDN.

drop policy if exists "avatars dono ou equipe seleciona" on storage.objects;

create policy "avatars dono ou equipe seleciona" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ( (storage.foldername(name))[1] = 'membro'
           and public.acolitos_get_role(auth.uid()) = any(array['coord_admin','subadmin','membro_equipe']) )
    )
  );

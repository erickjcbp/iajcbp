-- Acólitos — fix do upload de foto (erro de segurança no Storage)
-- Simplifica as policies do bucket 'avatars': qualquer usuário autenticado
-- gerencia objetos do bucket. Avatares são públicos por natureza, e o foto_url
-- em acolitos_membros continua protegido pela RLS daquela tabela.
-- Re-adiciona SELECT (removido no hardening 004b) — o upload com upsert precisa.

drop policy if exists "Avatars insere equipe ou dono" on storage.objects;
drop policy if exists "Avatars atualiza equipe ou dono" on storage.objects;
drop policy if exists "Avatars remove equipe ou dono" on storage.objects;
drop policy if exists "Avatars leitura publica" on storage.objects;

create policy "Avatars autenticado seleciona" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy "Avatars autenticado insere" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
create policy "Avatars autenticado atualiza" on storage.objects
  for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
create policy "Avatars autenticado remove" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

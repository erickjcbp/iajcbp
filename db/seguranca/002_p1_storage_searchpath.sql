-- P1 — Endurecimento Acólitos (2026-06-09)

-- P1.1 — search_path fixo (remove mutabilidade; corpos já são schema-qualified)
alter function public._prof_rank(text) set search_path = '';
alter function public.handle_new_user() set search_path = '';

-- P1.2 — bucket avatars (fotos de menores):
--  problema: policies só checavam bucket_id -> qualquer logado LISTAVA, sobrescrevia
--  e APAGAVA foto de qualquer um. Front nunca usa .list(); imagens públicas seguem
--  pela CDN (bucket public). Removemos o SELECT amplo (mata enumeração) e
--  restringimos escrita/remoção ao dono ({uid}/...) ou à equipe (membro/{id}/...).
drop policy if exists "Avatars autenticado seleciona" on storage.objects;
drop policy if exists "Avatars autenticado insere"   on storage.objects;
drop policy if exists "Avatars autenticado atualiza"  on storage.objects;
drop policy if exists "Avatars autenticado remove"    on storage.objects;

create policy "avatars dono ou equipe insere" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ( (storage.foldername(name))[1] = 'membro'
           and public.acolitos_get_role(auth.uid()) = any(array['coord_admin','subadmin','membro_equipe']) )
    )
  );

create policy "avatars dono ou equipe atualiza" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ( (storage.foldername(name))[1] = 'membro'
           and public.acolitos_get_role(auth.uid()) = any(array['coord_admin','subadmin','membro_equipe']) )
    )
  );

create policy "avatars dono ou equipe remove" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ( (storage.foldername(name))[1] = 'membro'
           and public.acolitos_get_role(auth.uid()) = any(array['coord_admin','subadmin','membro_equipe']) )
    )
  );

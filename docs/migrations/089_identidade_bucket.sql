-- Acólitos 089 — upload do logo/brasão da Identidade (Config)
--
-- PEDIDO DO DONO (02/10/2026): "permita que eu faça upload de imagem ao invés de colar só o
-- link". O logo agora sobe para um bucket PRÓPRIO e PÚBLICO (`identidade`): o endereço do
-- arquivo precisa abrir sem login, porque é a imagem que aparece no cabeçalho do app e a
-- tela de login nunca tem sessão.
--
-- Quem escreve: só a coordenação (coord_admin/subadmin) — a mesma gente que mexe na Identidade.
-- Leitura: o bucket é público, não precisa de política. Limite de 2 MB e só imagem raster
-- (png/jpeg/webp): SVG pode carregar script, e este arquivo é servido do nosso domínio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identidade', 'identidade', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "identidade coordenacao insere" on storage.objects;
drop policy if exists "identidade coordenacao atualiza" on storage.objects;
drop policy if exists "identidade coordenacao remove" on storage.objects;
create policy "identidade coordenacao insere" on storage.objects for insert to authenticated
  with check (bucket_id = 'identidade' and public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
create policy "identidade coordenacao atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'identidade' and public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));
create policy "identidade coordenacao remove" on storage.objects for delete to authenticated
  using (bucket_id = 'identidade' and public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin'));

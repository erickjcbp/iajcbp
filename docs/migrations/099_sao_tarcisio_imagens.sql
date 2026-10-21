-- 099 — Pasta das imagens dos avisos do São Tarcísio (2026-10-20)
-- Pública para LEITURA: a Evolution baixa a imagem pelo link na hora de enviar.
-- Gravar, trocar e apagar: só coord_admin/subadmin (mesma trava das tabelas tarcisio_*).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tarcisio', 'tarcisio', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "Tarcisio coordenacao envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'tarcisio' and public.tarcisio_pode_gerir());
create policy "Tarcisio coordenacao troca" on storage.objects for update to authenticated
  using (bucket_id = 'tarcisio' and public.tarcisio_pode_gerir());
create policy "Tarcisio coordenacao apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'tarcisio' and public.tarcisio_pode_gerir());

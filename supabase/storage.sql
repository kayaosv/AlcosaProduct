-- ============================================================
-- Vapers Alcosa — Storage: bucket product-images
-- ============================================================
--
-- Ejecutar en el SQL Editor de Supabase.
-- Crea el bucket público y configura las policies para que solo
-- los admins puedan subir/borrar.

-- 1) Crear bucket público
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- 2) Policies sobre storage.objects para este bucket
--    (la helper is_admin() viene de schema.sql)

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and is_admin());

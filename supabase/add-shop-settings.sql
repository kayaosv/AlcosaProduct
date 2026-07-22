-- ============================================================
-- Ajustes globales de la tienda (fila única) — hoy solo el banner
-- de envío gratis; pensado para sumar más flags sueltos acá en vez
-- de crear una tabla nueva por cada ajuste chico.
-- ============================================================

create table if not exists shop_settings (
  id                        boolean primary key default true,
  free_shipping_enabled     boolean not null default false,
  free_shipping_threshold   numeric(10, 2),
  constraint shop_settings_singleton check (id)
);

insert into shop_settings (id, free_shipping_enabled, free_shipping_threshold)
values (true, false, null)
on conflict (id) do nothing;

alter table shop_settings enable row level security;

drop policy if exists "shop_settings_select_public" on shop_settings;
create policy "shop_settings_select_public" on shop_settings
  for select using (true);

drop policy if exists "shop_settings_admin_all" on shop_settings;
create policy "shop_settings_admin_all" on shop_settings
  for all using (is_admin()) with check (is_admin());

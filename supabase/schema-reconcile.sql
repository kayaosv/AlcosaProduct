-- ============================================================
-- Vapers Alcosa — Reconciliar schema.sql con producción
-- ============================================================
--
-- Estas tablas/columnas ya existen en el proyecto Supabase real
-- (se crearon a mano desde el SQL Editor en algún momento) pero
-- nunca se guardaron en schema.sql. Este archivo lo pone al día:
-- es idempotente, así que correrlo sobre producción es un no-op,
-- y un despliegue nuevo desde cero queda consistente con lo real.

alter table products add column if not exists axis_config jsonb;
alter table products add column if not exists images jsonb not null default '[]'::jsonb;

create table if not exists product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  label           text not null,
  hex             text,
  image_url       text,
  stock           int not null default 0,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  is_primary      boolean not null default false,
  price           numeric(10, 2),
  sale_price      numeric(10, 2),
  wholesale_price numeric(10, 2),
  axis_values     jsonb,
  created_at      timestamptz not null default now()
);

alter table product_variants enable row level security;

drop policy if exists "variants_select_public" on product_variants;
create policy "variants_select_public" on product_variants
  for select using (is_active = true or is_admin());

drop policy if exists "variants_admin_all" on product_variants;
create policy "variants_admin_all" on product_variants
  for all using (is_admin()) with check (is_admin());

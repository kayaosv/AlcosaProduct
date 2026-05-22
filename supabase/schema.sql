-- ============================================================
-- Vapers Alcosa — Supabase schema
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  sort_order  int  not null default 0
);

create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  brand           text,
  category_id     uuid references categories(id) on delete set null,
  details         jsonb not null default '{}'::jsonb,
  price           numeric(10, 2),
  sale_price      numeric(10, 2),
  is_on_sale      boolean not null default false,
  wholesale_price numeric(10, 2),
  stock           int not null default 0,
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  customer_address text,
  status           text not null default 'pending',
  total            numeric(10, 2),
  notes            text,
  created_at       timestamptz not null default now()
);

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text,
  product_price numeric(10, 2),
  quantity      int not null
);

create table if not exists profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
);

-- ============================================================
-- updated_at trigger on products
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
before update on products
for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table categories  enable row level security;
alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table profiles    enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- categories: public read, admin write
drop policy if exists "categories_select_public" on categories;
create policy "categories_select_public" on categories
  for select using (true);

drop policy if exists "categories_admin_all" on categories;
create policy "categories_admin_all" on categories
  for all using (is_admin()) with check (is_admin());

-- products: public read of active products, admin sees/writes all
drop policy if exists "products_select_public" on products;
create policy "products_select_public" on products
  for select using (is_active = true or is_admin());

drop policy if exists "products_admin_all" on products;
create policy "products_admin_all" on products
  for all using (is_admin()) with check (is_admin());

-- orders: admin only (public checkout uses service role / edge function later)
drop policy if exists "orders_admin_all" on orders;
create policy "orders_admin_all" on orders
  for all using (is_admin()) with check (is_admin());

-- order_items: admin only
drop policy if exists "order_items_admin_all" on order_items;
create policy "order_items_admin_all" on order_items
  for all using (is_admin()) with check (is_admin());

-- profiles: user reads own row, admin reads all
drop policy if exists "profiles_select_self" on profiles;
create policy "profiles_select_self" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- Seed: initial categories
-- ============================================================

insert into categories (name, slug, sort_order) values
  ('Sales de Nicotina',    'sales-de-nicotina',    10),
  ('Longfill',             'longfill',             20),
  ('Vapers',               'vapers',               30),
  ('Vapers Desechables',   'vapers-desechables',   40),
  ('Accesorios',           'accesorios',           50),
  ('Alquimia',             'alquimia',             60)
on conflict (slug) do nothing;

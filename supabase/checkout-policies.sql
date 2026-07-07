-- ⚠️ SUPERADO por create-order-rpc.sql — NO aplicar. Ver AUDIT-2026-07.md.

-- ============================================================
-- Vapers Alcosa — Phase 4: public checkout policies
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Allow anonymous (anon) users to create orders via the public site.
-- We keep SELECT/UPDATE/DELETE admin-only — only INSERT is public.

drop policy if exists "orders_insert_public" on orders;
create policy "orders_insert_public" on orders
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and total is not null
    and total >= 0
  );

drop policy if exists "order_items_insert_public" on order_items;
create policy "order_items_insert_public" on order_items
  for insert to anon, authenticated
  with check (
    quantity > 0
    and product_price is not null
    and exists (
      select 1 from orders o
      where o.id = order_id
        and o.status = 'pending'
        and o.created_at > now() - interval '5 minutes'
    )
  );

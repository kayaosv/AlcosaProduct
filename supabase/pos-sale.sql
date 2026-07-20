-- ============================================================
-- Vapers Alcosa — TPV físico (venta presencial en mostrador)
-- ============================================================
-- El stock/catálogo siguen viviendo 100% en esta base (igual que
-- create_order()/create_paid_order()) — Odoo NO es la fuente de
-- verdad de inventario, solo procesa la factura legal (Verifactu)
-- por detrás vía la Edge Function odoo-sync, de forma desacoplada:
-- la venta se confirma siempre aunque Odoo esté caído o sin
-- credenciales todavía (ver odoo_sync_status).

alter table orders add column if not exists odoo_invoice_id text;
alter table orders add column if not exists odoo_sync_status text not null default 'pending';
alter table orders add column if not exists odoo_sync_error text;

comment on column orders.odoo_sync_status is '''pending'' (no intentado o esperando), ''synced'' (factura creada en Odoo), ''error'' (fallo la sync, ver odoo_sync_error) — solo aplica a pedidos payment_method LIKE ''pos_%''.';

-- Variante de create_order() (variant-checkout.sql) para venta
-- presencial desde el TPV del admin: a diferencia de create_order()
-- (cliente anonimo, "reserva y paga en tienda") y create_paid_order()
-- (service role, tras confirmar Stripe), esta la llama un admin
-- logueado y el pago ya esta cobrado en el momento (efectivo/datafono
-- fisico) — por eso status='delivered' y payment_status='paid' de
-- entrada, sin estado intermedio. Sin datos de cliente obligatorios
-- (venta de mostrador anonima).
create or replace function public.create_pos_sale(
  p_items jsonb, -- [{ "product_id": "...", "quantity": 2, "variant_id": "..."|null }]
  p_payment_type text -- 'efectivo' | 'tarjeta'
)
returns table (order_id uuid, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total    numeric := 0;
  v_item     record;
  v_product  record;
  v_price    numeric;
  v_label    text;
  v_variant_stock int;
  v_variant_active boolean;
  v_variant_label text;
  v_variant_own_price numeric;
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'No autorizado';
  end if;

  if p_payment_type not in ('efectivo', 'tarjeta') then
    raise exception 'Método de pago inválido';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  create temp table _pos_sale_lines (
    product_id    uuid,
    variant_id    uuid,
    variant_label text,
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int, variant_id uuid)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Línea de pedido inválida';
    end if;

    select id, name, is_active, stock, price, sale_price, is_on_sale
      into v_product
      from products
     where id = v_item.product_id
     for update;

    if not found then
      raise exception 'Producto no encontrado';
    end if;
    if not v_product.is_active then
      raise exception 'El producto "%" ya no está disponible', v_product.name;
    end if;

    v_label := null;

    if v_item.variant_id is not null then
      select stock, is_active, label, coalesce(sale_price, price)
        into v_variant_stock, v_variant_active, v_variant_label, v_variant_own_price
        from product_variants
       where id = v_item.variant_id and product_id = v_item.product_id
       for update;

      if not found then
        raise exception 'Variante no encontrada para "%"', v_product.name;
      end if;
      if not v_variant_active then
        raise exception 'La variante "%" de "%" ya no está disponible', v_variant_label, v_product.name;
      end if;
      if v_variant_stock < v_item.quantity then
        raise exception 'Solo quedan % unidades de "%" (%)', v_variant_stock, v_product.name, v_variant_label;
      end if;

      update product_variants set stock = stock - v_item.quantity where id = v_item.variant_id;

      if v_variant_own_price is not null then
        v_price := v_variant_own_price;
      else
        select coalesce(sale_price, price)
          into v_price
          from product_variants
         where product_id = v_item.product_id and is_primary = true
         limit 1;

        if v_price is null then
          v_price := case when v_product.is_on_sale and v_product.sale_price is not null
                          then v_product.sale_price
                          else v_product.price end;
        end if;
      end if;

      v_label := v_variant_label;
    else
      if v_product.stock < v_item.quantity then
        raise exception 'Solo quedan % unidades de "%"', v_product.stock, v_product.name;
      end if;

      update products set stock = stock - v_item.quantity where id = v_item.product_id;

      v_price := case when v_product.is_on_sale and v_product.sale_price is not null
                      then v_product.sale_price
                      else v_product.price end;
    end if;

    v_total := v_total + (v_price * v_item.quantity);

    insert into _pos_sale_lines (product_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  insert into orders (
    status, total, payment_method, payment_status
  )
  values (
    'delivered', v_total, 'pos_' || p_payment_type, 'paid'
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, product_name, product_price, quantity from _pos_sale_lines;

  return query select v_order_id, v_total;
end;
$$;

-- El guard de auth.uid()+role='admin' de adentro es la autorización
-- real — el grant a "authenticated" (no "anon") es solo la primera
-- barrera (hoy solo hay cuentas admin en este proyecto, pero si en el
-- futuro hay clientes con login, el guard interno sigue protegiendo).
revoke all on function public.create_pos_sale(jsonb, text) from public;
grant execute on function public.create_pos_sale(jsonb, text) to authenticated;

-- Este proyecto tiene default privileges que otorgan EXECUTE directo a
-- anon/authenticated en funciones nuevas del schema public (aparte del
-- rol pseudo "public") — "revoke all ... from public" de arriba no
-- alcanza para quitarle el acceso a anon. Se revoca explícito. El guard
-- interno (auth.uid()+role='admin') ya bloqueaba esto en la práctica,
-- esto es para que el grant refleje la intención real.
revoke execute on function public.create_pos_sale(jsonb, text) from anon;

-- ============================================================
-- Vapers Alcosa — Checkout público seguro: create_order()
-- ============================================================
--
-- Sustituye al enfoque de checkout-policies.sql (nunca aplicado en
-- producción; ver supabase/README.md). En vez de abrir INSERT público
-- en orders/order_items sin validar nada, exponemos una única función
-- RPC que:
--   1) Bloquea cada fila de producto (FOR UPDATE) para evitar carreras
--      entre dos checkouts simultáneos por el mismo stock.
--   2) Rechaza el pedido si el producto está inactivo o no hay stock.
--   3) Descuenta el stock atómicamente en la misma transacción.
--   4) Crea el pedido y sus líneas con el precio resuelto en servidor
--      (nunca confía en el precio que manda el cliente).
--
-- orders/order_items siguen siendo admin-only para acceso directo a
-- la tabla (RLS sin cambios); solo esta función permite crear pedidos
-- desde el front público.

create or replace function public.create_order(
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_address text,
  p_notes text,
  p_items jsonb -- [{ "product_id": "...", "quantity": 2 }, ...]
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
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  create temp table _order_lines (
    product_id    uuid,
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
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
    if v_product.stock < v_item.quantity then
      raise exception 'Solo quedan % unidades de "%"', v_product.stock, v_product.name;
    end if;

    update products
       set stock = stock - v_item.quantity
     where id = v_item.product_id;

    v_price := case when v_product.is_on_sale and v_product.sale_price is not null
                    then v_product.sale_price
                    else v_product.price end;

    v_total := v_total + (v_price * v_item.quantity);

    insert into _order_lines (product_id, quantity, product_name, product_price)
    values (v_item.product_id, v_item.quantity, v_product.name, v_price);
  end loop;

  insert into orders (customer_name, customer_email, customer_phone, customer_address, notes, status, total)
  values (p_customer_name, p_customer_email, p_customer_phone, p_customer_address, p_notes, 'pending', v_total)
  returning id into v_order_id;

  insert into order_items (order_id, product_id, product_name, product_price, quantity)
  select v_order_id, product_id, product_name, product_price, quantity from _order_lines;

  return query select v_order_id, v_total;
end;
$$;

revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to anon, authenticated;

-- ============================================================
-- Hardening menor detectado por el linter de Supabase (get_advisors)
-- ============================================================
alter function public.set_updated_at() set search_path = public;
alter function public.is_admin() set search_path = public;

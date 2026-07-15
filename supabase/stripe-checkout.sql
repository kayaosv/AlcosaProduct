-- ============================================================
-- Vapers Alcosa — pago online con Stripe (coexiste con la reserva)
-- ============================================================
-- Decision del cliente (2026-07-15): el pago online NO reemplaza la
-- reserva-y-pago-en-tienda que ya existe (create_order() en
-- variant-checkout.sql sigue intacta, sin tocar) - el checkout ofrece
-- las dos opciones. Y el stock de un pedido pagado online SOLO se
-- descuenta cuando Stripe confirma el pago (webhook), nunca antes -
-- por eso el pedido en si no se crea hasta ese momento (a diferencia
-- de create_order(), que crea+descuenta juntos porque ahi la "reserva"
-- ES el compromiso, sin pago de por medio).
--
-- Flujo:
--  1. Checkout.jsx -> Edge Function create-checkout-session: valida
--     precios/stock reales (nunca confia en el precio que manda el
--     cliente), guarda el carrito en checkout_drafts, crea una Stripe
--     Checkout Session con metadata.draft_id, devuelve la url de Stripe.
--  2. Cliente paga en la pagina de Stripe (no en este sitio - nunca
--     tocamos datos de tarjeta).
--  3. Stripe llama al webhook -> Edge Function stripe-webhook: verifica
--     la firma, lee checkout_drafts por metadata.draft_id, llama a
--     create_paid_order(...) (decrementa stock ahi mismo, atomico,
--     igual que create_order() pero disparado por el pago confirmado
--     en vez de por el envio del formulario).
--
-- Por que checkout_drafts y no meter el carrito en metadata de Stripe
-- directamente: metadata de Stripe tiene limites de tamaño (500
-- caracteres por valor) que un carrito con varios productos supera
-- facil. Un draft es mas facil de depurar tambien (se puede ver en
-- Supabase mientras se prueba).

create table if not exists checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  customer_address text,
  notes            text,
  items            jsonb not null,
  created_at       timestamptz not null default now(),
  consumed_at      timestamptz
);

-- Nadie fuera del service role (las Edge Functions) toca esta tabla
-- directamente - no lleva RLS de cliente porque no se expone via
-- PostgREST a anon/authenticated.
alter table checkout_drafts enable row level security;

alter table orders add column if not exists payment_method text not null default 'pickup';
alter table orders add column if not exists payment_status text not null default 'not_required';
alter table orders add column if not exists stripe_session_id text;
alter table orders add constraint orders_stripe_session_id_key unique (stripe_session_id);

comment on column orders.payment_method is '''pickup'' (reserva, paga en tienda) o ''stripe'' (pagado online). create_order() sigue creando solo pedidos ''pickup'' via los defaults de columna, sin tocar esa funcion.';
comment on column orders.payment_status is '''not_required'' para pickup, ''paid'' para stripe (create_paid_order solo inserta pedidos ya pagados, no hay estado ''pending'' persistido en orders - ver checkout_drafts para eso).';

-- Variante de create_order() (variant-checkout.sql) que SOLO debe
-- llamarse desde el webhook de Stripe, tras confirmar el pago - por
-- eso el descuento de stock ocurre aqui y no antes. Misma logica de
-- validacion/bloqueo de filas (FOR UPDATE) y precio de variantes que
-- create_order(), duplicada a proposito en vez de parametrizar la
-- original: son dos caminos de confianza distinta (uno lo llama
-- cualquier visitante anonimo, el otro solo el service role) y mezclar
-- ambos en una funcion con flags habria sido mas fragil que un
-- duplicado corto y legible.
create or replace function public.create_paid_order(
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_address text,
  p_notes text,
  p_items jsonb, -- [{ "product_id": "...", "quantity": 2, "variant_id": "..."|null }]
  p_stripe_session_id text
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
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  create temp table _paid_order_lines (
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

    insert into _paid_order_lines (product_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  insert into orders (
    customer_name, customer_email, customer_phone, customer_address, notes,
    status, total, payment_method, payment_status, stripe_session_id
  )
  values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address, p_notes,
    'pending', v_total, 'stripe', 'paid', p_stripe_session_id
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, product_name, product_price, quantity from _paid_order_lines;

  return query select v_order_id, v_total;
end;
$$;

-- A diferencia de create_order(), esta funcion NO se concede a
-- anon/authenticated - solo el service role (Edge Function del
-- webhook) puede ejecutarla. Un cliente anonimo nunca debe poder
-- marcar un pedido como "pagado" sin haber pagado de verdad.
revoke all on function public.create_paid_order(text, text, text, text, text, jsonb, text) from public;

-- Lectura minima y segura para CheckoutSuccess.jsx tras volver de
-- Stripe: el session_id de Stripe funciona como token no adivinable
-- (es un valor largo y aleatorio), asi que exponer estos campos solo
-- cuando se conoce el session_id exacto es seguro sin necesitar login.
create or replace function public.get_order_by_session(p_session_id text)
returns table (order_id uuid, total numeric, customer_name text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, total, customer_name, created_at
  from orders
  where stripe_session_id = p_session_id;
$$;

revoke all on function public.get_order_by_session(text) from public;
grant execute on function public.get_order_by_session(text) to anon, authenticated;

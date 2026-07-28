-- ============================================================
-- Vapers Alcosa — limite de reservas por IP en create_order()
-- ============================================================
-- Hallazgo de la auditoria de seguridad 2026-07-28: create_order()
-- (reserva "paga en tienda") es ejecutable por anon, descuenta stock
-- real de inmediato y no exige pago ni verificacion alguna - sin
-- limite, un script podria crear decenas de reservas falsas seguidas
-- con datos inventados y dejar un producto "agotado" para clientes
-- reales sin gastar nada. El admin ya puede identificar y cancelar
-- estas reservas a mano en /admin/pedidos (la columna "Pago" distingue
-- claramente "Paga en tienda" de un pago real, y cancelar ya repone
-- stock via cancel_order()), pero eso no evita el abuso en el momento -
-- este limite si.
--
-- No se usa reposicion automatica por tiempo (decision explicita del
-- cliente, 2026-07-28) - solo limitar cuantas reservas puede crear una
-- misma IP en una ventana corta.
--
-- La IP real del cliente llega via el header `x-forwarded-for`, que
-- pone el proxy de Supabase/PostgREST (nunca el propio navegador) -
-- PostgREST expone los headers de la request como el GUC
-- `request.headers` (json), patron documentado de Supabase para leer
-- datos de la request dentro de una funcion.

create table if not exists public.order_rate_limits (
  ip             text primary key,
  window_start   timestamptz not null default now(),
  attempt_count  int not null default 0
);

-- Sin politicas RLS de cliente: esta tabla solo la toca create_order()
-- desde dentro (SECURITY DEFINER, no pasa por RLS como su dueño) - no
-- se expone via PostgREST a anon/authenticated, mismo criterio que
-- checkout_drafts.
alter table public.order_rate_limits enable row level security;

create or replace function public.create_order(
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_address text,
  p_notes text,
  p_items jsonb
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
  v_client_ip text;
  v_rate_window interval := interval '10 minutes';
  v_rate_max int := 5;
  v_attempts int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  -- Limite de reservas por IP - ver comentario de cabecera. Se cuenta
  -- ANTES de tocar stock/crear nada, para que un intento bloqueado no
  -- deje ningun rastro en orders.
  v_client_ip := coalesce(
    nullif(split_part(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1), ''),
    'unknown'
  );

  insert into order_rate_limits as orl (ip, window_start, attempt_count)
  values (v_client_ip, now(), 1)
  on conflict (ip) do update set
    attempt_count = case when orl.window_start < now() - v_rate_window then 1 else orl.attempt_count + 1 end,
    window_start  = case when orl.window_start < now() - v_rate_window then now() else orl.window_start end
  returning attempt_count into v_attempts;

  if v_attempts > v_rate_max then
    raise exception 'Demasiadas reservas seguidas desde tu conexión — esperá unos minutos e inténtalo de nuevo';
  end if;

  create temp table _order_lines (
    line_no       serial,
    product_id    uuid,
    category_id   uuid,
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

    select id, name, is_active, stock, price, sale_price, is_on_sale, category_id
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

    insert into _order_lines (product_id, category_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_product.category_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  -- Ajuste por tramo de volumen (desechables) — unica fuente de verdad
  -- en apply_desechables_tier(), no se repite la logica a mano.
  update _order_lines l
  set product_price = adj.final_price
  from (
    select (a->>'idx')::int as line_no, (a->>'final_price')::numeric as final_price
    from jsonb_array_elements(
      apply_desechables_tier(
        (select jsonb_agg(jsonb_build_object(
            'idx', line_no, 'category_id', category_id, 'quantity', quantity, 'unit_price', product_price
          )) from _order_lines)
      )
    ) as a
  ) adj
  where adj.line_no = l.line_no;

  select coalesce(sum(product_price * quantity), 0) into v_total from _order_lines;

  insert into orders (customer_name, customer_email, customer_phone, customer_address, notes, status, total)
  values (p_customer_name, p_customer_email, p_customer_phone, p_customer_address, p_notes, 'pending', v_total)
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, product_name, product_price, quantity from _order_lines;

  return query select v_order_id, v_total;
end;
$$;

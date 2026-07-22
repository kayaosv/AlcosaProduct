-- ============================================================
-- Promociones por volumen para Vapers Desechables (Fase 2)
-- ============================================================
-- Hasta 3 tramos {min_qty, unit_price} guardados en categories.promo_tiers,
-- editables solo cuando la categoria es de kind 'desechables'. El
-- calculo del tramo vive en UNA sola funcion (apply_desechables_tier)
-- para no repetir la logica 3 veces a mano entre create_order/
-- create_paid_order/create_pos_sale y que se desincronicen. El nucleo
-- de esas 3 funciones (FOR UPDATE + descuento de stock) NO se toca -
-- solo se agrega un paso al final que ajusta el precio ya resuelto.

alter table categories add column if not exists promo_tiers jsonb;

-- ============================================================
-- apply_desechables_tier: unica fuente de verdad del calculo de tramo
-- ============================================================
-- p_lines: [{ "idx": 0, "category_id": "...", "quantity": 2, "unit_price": 4.9 }, ...]
-- Devuelve: [{ "idx": 0, "final_price": 4.5 }, ...]
-- El precio final nunca es peor para el cliente que el precio ya
-- resuelto (variante/oferta) - si esa oferta ya es mas barata que el
-- tramo, gana la oferta.
create or replace function public.apply_desechables_tier(p_lines jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  with input as (
    select
      (l->>'idx')::int as idx,
      (l->>'category_id')::uuid as category_id,
      (l->>'quantity')::int as quantity,
      (l->>'unit_price')::numeric as unit_price
    from jsonb_array_elements(p_lines) as l
  ),
  cat_totals as (
    select i.category_id, sum(i.quantity) as total_qty
    from input i
    join categories c on c.id = i.category_id and c.kind = 'desechables'
    group by i.category_id
  ),
  tier_pick as (
    select ct.category_id,
      (
        select (t->>'unit_price')::numeric
        from jsonb_array_elements(c.promo_tiers) as t
        where (t->>'min_qty')::int <= ct.total_qty
        order by (t->>'min_qty')::int desc
        limit 1
      ) as tier_price
    from cat_totals ct
    join categories c on c.id = ct.category_id
    where c.promo_tiers is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'idx', i.idx,
        'final_price', case
          when tp.tier_price is not null then least(i.unit_price, tp.tier_price)
          else i.unit_price
        end
      )
    ),
    '[]'::jsonb
  )
  from input i
  left join tier_pick tp on tp.category_id = i.category_id;
$$;

-- Solo se llama internamente desde las funciones de checkout/TPV
-- (SECURITY DEFINER) - no tiene que ser publica.
revoke all on function public.apply_desechables_tier(jsonb) from public, anon, authenticated;

-- ============================================================
-- create_order — agrega category_id + ajuste de tramo al final
-- ============================================================
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
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
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

-- Grants sin tocar: CREATE OR REPLACE con la misma firma no los
-- resetea, y ya estaban correctos (anon+authenticated+service_role).

-- ============================================================
-- create_paid_order — mismo agregado que create_order
-- ============================================================
create or replace function public.create_paid_order(
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_address text,
  p_notes text,
  p_items jsonb,
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

    insert into _paid_order_lines (product_id, category_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_product.category_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  update _paid_order_lines l
  set product_price = adj.final_price
  from (
    select (a->>'idx')::int as line_no, (a->>'final_price')::numeric as final_price
    from jsonb_array_elements(
      apply_desechables_tier(
        (select jsonb_agg(jsonb_build_object(
            'idx', line_no, 'category_id', category_id, 'quantity', quantity, 'unit_price', product_price
          )) from _paid_order_lines)
      )
    ) as a
  ) adj
  where adj.line_no = l.line_no;

  select coalesce(sum(product_price * quantity), 0) into v_total from _paid_order_lines;

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

-- Grants sin tocar: ya solo era ejecutable por postgres/service_role
-- (la llama stripe-webhook con la service role key), correcto tal cual.

-- ============================================================
-- create_pos_sale — mismo agregado que create_order
-- ============================================================
create or replace function public.create_pos_sale(
  p_items jsonb,
  p_payment_type text
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

    insert into _pos_sale_lines (product_id, category_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_product.category_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  update _pos_sale_lines l
  set product_price = adj.final_price
  from (
    select (a->>'idx')::int as line_no, (a->>'final_price')::numeric as final_price
    from jsonb_array_elements(
      apply_desechables_tier(
        (select jsonb_agg(jsonb_build_object(
            'idx', line_no, 'category_id', category_id, 'quantity', quantity, 'unit_price', product_price
          )) from _pos_sale_lines)
      )
    ) as a
  ) adj
  where adj.line_no = l.line_no;

  select coalesce(sum(product_price * quantity), 0) into v_total from _pos_sale_lines;

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

-- Grants sin tocar: ya estaban correctos (authenticated+service_role,
-- guard interno de admin sin cambios).

-- ============================================================
-- get_checkout_lines — preview del carrito completo (reemplaza el
-- loop linea-por-linea de get_checkout_line en create-checkout-session,
-- que no podia ver el resto del carrito para calcular el tramo)
-- ============================================================
-- NOTA: dos correcciones aplicadas tras probar contra la base real
-- (no visibles solo leyendo el codigo, saltaron recien al ejecutar):
-- (a) no puede ser STABLE porque hace CREATE TEMP TABLE (DDL, requiere
--     VOLATILE); (b) "idx"/"product_id"/"variant_id" como columnas de
--     salida (RETURNS TABLE) quedan en scope como variables PL/pgSQL
--     dentro de la funcion, asi que cualquier referencia SIN alias a
--     esas mismas columnas en una tabla real (product_variants,
--     _preview_lines) es ambigua — se resolvio aliasing todo y sacando
--     product_id/variant_id del RETURNS TABLE (el caller no los usa,
--     empareja por "idx").
create or replace function public.get_checkout_lines(p_items jsonb)
returns table(
  idx int,
  product_name text,
  variant_label text,
  unit_price numeric,
  available_stock int,
  is_available boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product record;
  v_variant record;
  v_idx int := -1;
begin
  create temp table _preview_lines (
    idx int, product_id uuid, variant_id uuid, category_id uuid, quantity int,
    product_name text, variant_label text, unit_price numeric,
    available_stock int, is_available boolean
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity int)
  loop
    v_idx := v_idx + 1;

    select id, name, is_active, stock, price, sale_price, is_on_sale, category_id
      into v_product from products where id = v_item.product_id;

    if not found then
      insert into _preview_lines values (v_idx, v_item.product_id, v_item.variant_id, null, v_item.quantity, null, null, null, 0, false);
      continue;
    end if;

    if v_item.variant_id is not null then
      select pv.stock, pv.is_active, pv.label, coalesce(pv.sale_price, pv.price) as own_price
        into v_variant from product_variants pv
        where pv.id = v_item.variant_id and pv.product_id = v_item.product_id;

      if not found then
        insert into _preview_lines values (v_idx, v_product.id, v_item.variant_id, v_product.category_id, v_item.quantity, v_product.name, null, null, 0, false);
        continue;
      end if;

      insert into _preview_lines values (
        v_idx, v_product.id, v_item.variant_id, v_product.category_id, v_item.quantity, v_product.name, v_variant.label,
        coalesce(
          v_variant.own_price,
          (select coalesce(pv2.sale_price, pv2.price) from product_variants pv2 where pv2.product_id = v_product.id and pv2.is_primary = true limit 1),
          case when v_product.is_on_sale and v_product.sale_price is not null then v_product.sale_price else v_product.price end
        ),
        v_variant.stock, v_product.is_active and v_variant.is_active
      );
    else
      insert into _preview_lines values (
        v_idx, v_product.id, null, v_product.category_id, v_item.quantity, v_product.name, null,
        case when v_product.is_on_sale and v_product.sale_price is not null then v_product.sale_price else v_product.price end,
        v_product.stock, v_product.is_active
      );
    end if;
  end loop;

  update _preview_lines l
  set unit_price = adj.final_price
  from (
    select (a->>'idx')::int as adj_idx, (a->>'final_price')::numeric as final_price
    from jsonb_array_elements(
      apply_desechables_tier(
        (select jsonb_agg(jsonb_build_object(
            'idx', pl.idx, 'category_id', pl.category_id, 'quantity', pl.quantity, 'unit_price', pl.unit_price
          )) from _preview_lines pl where pl.is_available)
      )
    ) as a
  ) adj
  where adj.adj_idx = l.idx;

  return query
    select p.idx, p.product_name, p.variant_label, p.unit_price, p.available_stock, p.is_available
    from _preview_lines p
    order by p.idx;
end;
$$;

-- Solo la llama create-checkout-session, que usa la service role key
-- (bypassea grants) - no hace falta exponerla a anon/authenticated.
revoke all on function public.get_checkout_lines(jsonb) from public, anon, authenticated;

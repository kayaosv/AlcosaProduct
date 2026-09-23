-- ============================================================
-- Vapers Alcosa — permitir vender en el TPV un producto de "venta
-- rápida" (is_active:false, category_id:null — ver Tpv.jsx/
-- specs/tpv-venta-rapida.md). create_pos_sale rechazaba CUALQUIER
-- producto inactivo, incluido este caso a propósito: un producto
-- deshabilitado desde /admin/products siempre tiene category_id (el
-- editor lo exige), así que "inactivo + sin categoría" identifica sin
-- ambigüedad a un producto de venta rápida, nunca a uno deshabilitado
-- de verdad — el resto de la validación (stock, cantidad) no cambia.
-- ============================================================
create or replace function public.create_pos_sale(
  p_items jsonb, -- [{ product_id, quantity, variant_id?, pack_id?, manual_price? }]
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
  v_pack     record;
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
    pack_id       uuid,
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int, variant_id uuid, pack_id uuid, manual_price numeric)
  loop
    if v_item.pack_id is not null then
      if v_item.quantity is null or v_item.quantity <= 0 then
        raise exception 'Línea de pedido inválida';
      end if;
      select * into v_pack from consume_pack_stock(v_item.pack_id, v_item.quantity);
      insert into _pos_sale_lines (product_id, category_id, variant_id, variant_label, pack_id, quantity, product_name, product_price)
      values (null, null, null, null, v_item.pack_id, v_item.quantity, v_pack.pack_name, v_pack.unit_price);
      continue;
    end if;

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
    if not v_product.is_active and v_product.category_id is not null then
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

    -- Descuento manual del vendedor: solo se acepta si es <= al precio
    -- real que esta funcion acaba de resolver (nunca confia en un
    -- "precio de catalogo" que mande el cliente, solo compara el manual
    -- contra el propio) y nunca negativo.
    if v_item.manual_price is not null then
      if v_item.manual_price < 0 or v_item.manual_price > v_price then
        raise exception 'Precio manual inválido para "%"', v_product.name;
      end if;
      v_price := v_item.manual_price;
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
          )) from _pos_sale_lines where category_id is not null)
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

  insert into order_items (order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity from _pos_sale_lines;

  return query select v_order_id, v_total;
end;
$$;

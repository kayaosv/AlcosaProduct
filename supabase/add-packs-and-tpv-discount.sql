-- ============================================================
-- Vapers Alcosa — Packs/combos + descuento manual en el TPV
-- ============================================================
-- Ver specs/packs-combos.md y specs/tpv-descuento-manual.md.

-- ============================================================
-- Packs: producto compuesto vendido a un precio fijo elegido a mano
-- (no calculado) — el stock real vendido es el de cada componente.
-- ============================================================
create table if not exists packs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  price       numeric(10, 2) not null check (price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists pack_items (
  id         uuid primary key default gen_random_uuid(),
  pack_id    uuid not null references packs(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  variant_id uuid references product_variants(id) on delete restrict,
  quantity   int not null default 1 check (quantity > 0),
  sort_order int not null default 0
);

alter table order_items add column if not exists pack_id uuid references packs(id) on delete set null;

alter table packs enable row level security;
alter table pack_items enable row level security;

drop policy if exists "packs_select_public" on packs;
create policy "packs_select_public" on packs
  for select using (is_active = true or is_admin());

drop policy if exists "packs_admin_all" on packs;
create policy "packs_admin_all" on packs
  for all using (is_admin()) with check (is_admin());

-- pack_items no tiene su propio is_active — se lee junto con su pack,
-- visible si el pack es visible (mismo criterio que product_variants
-- heredando del is_active del producto no aplicaría acá porque el
-- filtro real es sobre el pack, no sobre el producto componente).
drop policy if exists "pack_items_select_public" on pack_items;
create policy "pack_items_select_public" on pack_items
  for select using (
    is_admin() or exists (select 1 from packs p where p.id = pack_items.pack_id and p.is_active)
  );

drop policy if exists "pack_items_admin_all" on pack_items;
create policy "pack_items_admin_all" on pack_items
  for all using (is_admin()) with check (is_admin());

drop trigger if exists packs_set_updated_at on packs;
create trigger packs_set_updated_at
  before update on packs
  for each row execute function set_updated_at();

-- ============================================================
-- consume_pack_stock — única fuente de verdad para vender un pack:
-- bloquea (FOR UPDATE) y descuenta el stock real de cada componente,
-- atómico con el resto de la venta que la llama. Nunca se expone a
-- anon/authenticated — mismo patrón que apply_desechables_tier, solo
-- la llaman internamente las 4 funciones de venta (todas
-- SECURITY DEFINER, mismo rol de ejecución).
-- ============================================================
create or replace function public.consume_pack_stock(p_pack_id uuid, p_quantity int)
returns table (pack_name text, unit_price numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack   record;
  v_item   record;
  v_needed int;
  v_stock  int;
  v_active boolean;
  v_label  text;
begin
  select id, name, price, is_active into v_pack from packs where id = p_pack_id for update;
  if not found then
    raise exception 'Pack no encontrado';
  end if;
  if not v_pack.is_active then
    raise exception 'El pack "%" ya no está disponible', v_pack.name;
  end if;

  for v_item in
    select pi.product_id, pi.variant_id, pi.quantity, p.name as product_name
    from pack_items pi
    join products p on p.id = pi.product_id
    where pi.pack_id = p_pack_id
  loop
    v_needed := v_item.quantity * p_quantity;

    if v_item.variant_id is not null then
      select stock, is_active, label into v_stock, v_active, v_label
        from product_variants where id = v_item.variant_id for update;

      if not found or not v_active then
        raise exception 'Un componente del pack "%" ya no está disponible (%)', v_pack.name, v_item.product_name;
      end if;
      if v_stock < v_needed then
        raise exception 'Sin stock suficiente para el pack "%" — solo quedan % de "%" (%)', v_pack.name, v_stock, v_item.product_name, v_label;
      end if;

      update product_variants set stock = stock - v_needed where id = v_item.variant_id;
    else
      select stock into v_stock from products where id = v_item.product_id for update;

      if v_stock < v_needed then
        raise exception 'Sin stock suficiente para el pack "%" — solo quedan % de "%"', v_pack.name, v_stock, v_item.product_name;
      end if;

      update products set stock = stock - v_needed where id = v_item.product_id;
    end if;
  end loop;

  return query select v_pack.name, v_pack.price;
end;
$$;

revoke all on function public.consume_pack_stock(uuid, int) from public, anon, authenticated;

-- ============================================================
-- pack_available_units — cuántos packs completos se pueden armar HOY
-- con el stock real de cada componente. Solo lectura, la usa el
-- storefront (catálogo, "llevalos juntos") y get_checkout_lines.
-- ============================================================
create or replace function public.pack_available_units(p_pack_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(min(
    floor(coalesce(pv.stock, p.stock, 0)::numeric / pi.quantity)
  ), 0)::int
  from pack_items pi
  join products p on p.id = pi.product_id
  left join product_variants pv on pv.id = pi.variant_id
  where pi.pack_id = p_pack_id;
$$;

revoke all on function public.pack_available_units(uuid) from public;
grant execute on function public.pack_available_units(uuid) to anon, authenticated;

-- ============================================================
-- create_order — agrega renglones de pack ({ pack_id, quantity })
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
  v_pack     record;
  v_client_ip text;
  v_rate_window interval := interval '10 minutes';
  v_rate_max int := 5;
  v_attempts int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

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
    pack_id       uuid,
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int, variant_id uuid, pack_id uuid)
  loop
    if v_item.pack_id is not null then
      if v_item.quantity is null or v_item.quantity <= 0 then
        raise exception 'Línea de pedido inválida';
      end if;
      select * into v_pack from consume_pack_stock(v_item.pack_id, v_item.quantity);
      insert into _order_lines (product_id, category_id, variant_id, variant_label, pack_id, quantity, product_name, product_price)
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

  update _order_lines l
  set product_price = adj.final_price
  from (
    select (a->>'idx')::int as line_no, (a->>'final_price')::numeric as final_price
    from jsonb_array_elements(
      apply_desechables_tier(
        (select jsonb_agg(jsonb_build_object(
            'idx', line_no, 'category_id', category_id, 'quantity', quantity, 'unit_price', product_price
          )) from _order_lines where category_id is not null)
      )
    ) as a
  ) adj
  where adj.line_no = l.line_no;

  select coalesce(sum(product_price * quantity), 0) into v_total from _order_lines;

  insert into orders (customer_name, customer_email, customer_phone, customer_address, notes, status, total)
  values (p_customer_name, p_customer_email, p_customer_phone, p_customer_address, p_notes, 'pending', v_total)
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity from _order_lines;

  return query select v_order_id, v_total;
end;
$$;

-- ============================================================
-- create_pos_sale — agrega renglones de pack + precio manual por línea
-- (descuento del vendedor, nunca mayor al precio real resuelto).
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

-- ============================================================
-- get_checkout_lines — agrega preview de renglones de pack (no
-- descuenta stock, solo informa si hay packs armables suficientes).
-- ============================================================
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
  v_pack record;
  v_pack_units int;
  v_idx int := -1;
begin
  create temp table _preview_lines (
    idx int, product_id uuid, variant_id uuid, category_id uuid, quantity int,
    product_name text, variant_label text, unit_price numeric,
    available_stock int, is_available boolean
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity int, pack_id uuid)
  loop
    v_idx := v_idx + 1;

    if v_item.pack_id is not null then
      select id, name, price, is_active into v_pack from packs where id = v_item.pack_id;
      if not found or not v_pack.is_active then
        insert into _preview_lines values (v_idx, null, null, null, v_item.quantity, coalesce(v_pack.name, 'Pack'), null, null, 0, false);
        continue;
      end if;
      v_pack_units := pack_available_units(v_item.pack_id);
      insert into _preview_lines values (
        v_idx, null, null, null, v_item.quantity, v_pack.name, null, v_pack.price,
        v_pack_units, v_pack_units >= v_item.quantity
      );
      continue;
    end if;

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
          )) from _preview_lines pl where pl.is_available and pl.category_id is not null)
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

-- ============================================================
-- confirm_payment_draft — agrega soporte de pack_id en el snapshot del
-- borrador (create_payment_draft ya lo guarda ahí via get_checkout_lines
-- de arriba, ver el jsonb_build_object agregado más abajo en este mismo
-- archivo). NOTA aparte, sin tocar acá: esta función no aplica
-- apply_desechables_tier al confirmar (gap preexistente, ver
-- specs/packs-combos.md "Fuera de alcance") — las líneas de pack no se
-- ven afectadas por eso de todas formas, porque su precio ya es fijo.
-- ============================================================
create or replace function public.confirm_payment_draft(p_draft_id uuid)
returns table (order_id uuid, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft   record;
  v_item    record;
  v_product record;
  v_price   numeric;
  v_label   text;
  v_variant_stock     int;
  v_variant_active    boolean;
  v_variant_label     text;
  v_variant_own_price numeric;
  v_pack     record;
  v_order_id uuid;
  v_total    numeric := 0;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'No autorizado';
  end if;

  select * into v_draft from checkout_drafts where id = p_draft_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_draft.consumed_at is not null then
    raise exception 'Este pedido ya fue confirmado';
  end if;

  create temp table _transfer_lines (
    product_id    uuid,
    variant_id    uuid,
    variant_label text,
    pack_id       uuid,
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(v_draft.items) as x(product_id uuid, variant_id uuid, quantity int, pack_id uuid)
  loop
    if v_item.pack_id is not null then
      select * into v_pack from consume_pack_stock(v_item.pack_id, v_item.quantity);
      insert into _transfer_lines (product_id, variant_id, variant_label, pack_id, quantity, product_name, product_price)
      values (null, null, null, v_item.pack_id, v_item.quantity, v_pack.pack_name, v_pack.unit_price);
      continue;
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

    insert into _transfer_lines (product_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  select coalesce(sum(product_price * quantity), 0) into v_total from _transfer_lines;

  insert into orders (
    customer_name, customer_email, customer_phone, customer_address, notes,
    status, total, payment_method, payment_status
  )
  values (
    v_draft.customer_name, v_draft.customer_email, v_draft.customer_phone, v_draft.customer_address, v_draft.notes,
    'pending', v_total, 'transferencia', 'paid'
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, pack_id, product_name, product_price, quantity from _transfer_lines;

  update checkout_drafts set consumed_at = now() where id = p_draft_id;

  return query select v_order_id, v_total;
end;
$$;

-- ============================================================
-- create_payment_draft — el snapshot de items ahora conserva pack_id
-- cuando la línea es un pack (get_checkout_lines de arriba ya calcula
-- su unit_price/disponibilidad).
-- ============================================================
create or replace function public.create_payment_draft(
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text,
  p_customer_address text,
  p_notes            text,
  p_items            jsonb
)
returns table (draft_id uuid, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line   record;
  v_qty    int;
  v_total  numeric := 0;
  v_items  jsonb := '[]'::jsonb;
  v_draft  uuid;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  for v_line in select * from get_checkout_lines(p_items) order by idx loop
    v_qty := (p_items -> v_line.idx ->> 'quantity')::int;

    if not v_line.is_available then
      raise exception '"%" ya no está disponible', coalesce(v_line.product_name, 'Producto');
    end if;
    if v_line.available_stock < v_qty then
      raise exception 'Solo quedan % unidades de "%"', v_line.available_stock, v_line.product_name;
    end if;

    v_total := v_total + (v_line.unit_price * v_qty);

    v_items := v_items || jsonb_build_object(
      'product_id', p_items -> v_line.idx ->> 'product_id',
      'variant_id', p_items -> v_line.idx ->> 'variant_id',
      'pack_id', p_items -> v_line.idx ->> 'pack_id',
      'product_name', v_line.product_name,
      'variant_label', v_line.variant_label,
      'quantity', v_qty,
      'unit_price', v_line.unit_price
    );
  end loop;

  insert into checkout_drafts (
    customer_name, customer_email, customer_phone, customer_address, notes, items, total
  )
  values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address, p_notes, v_items, v_total
  )
  returning id into v_draft;

  return query select v_draft, v_total;
end;
$$;

-- ============================================================
-- Vapers Alcosa — pago propio por transferencia/Bizum (reemplaza a
-- Stripe) + confirmacion manual por WhatsApp
-- ============================================================
-- Ver specs/pago-transferencia-whatsapp.md para el flujo completo.
-- checkout_drafts ya existia (creada para Stripe en
-- supabase/stripe-checkout.sql, ahora retirado - ver nota al inicio de
-- ese archivo) - se reutiliza tal cual, solo se le agrega "total" para
-- poder mostrar el resumen en /pago/:draftId sin tener que recalcular
-- nada del lado del cliente.

alter table checkout_drafts add column if not exists total numeric not null default 0;

comment on table checkout_drafts is 'Carrito + datos de cliente antes de confirmar un pago (transferencia/Bizum). Antes tambien la usaba Stripe (retirado) - el mecanismo de borrador+consumed_at es el mismo.';

-- Los borradores pendientes se listan en /admin/pending-payments via
-- select directo (no un RPC aparte) - mismo criterio que orders/
-- order_items, que ya tienen su propia policy "*_admin_all".
drop policy if exists "checkout_drafts_admin_select" on checkout_drafts;
create policy "checkout_drafts_admin_select" on checkout_drafts
  for select using (is_admin());

-- ============================================================
-- Datos de cobro editables desde /admin/settings (sin tocar codigo)
-- ============================================================
alter table shop_settings add column if not exists payment_iban text;
alter table shop_settings add column if not exists payment_bizum_phone text;
alter table shop_settings add column if not exists payment_whatsapp_phone text not null default '34682725780';
alter table shop_settings add column if not exists payment_timer_minutes int not null default 15;

comment on column shop_settings.payment_iban is 'IBAN mostrado en /pago/:draftId para transferencia. NULL = no se muestra ese medio.';
comment on column shop_settings.payment_bizum_phone is 'Numero de Bizum mostrado en /pago/:draftId. NULL = no se muestra ese medio.';
comment on column shop_settings.payment_whatsapp_phone is 'Numero de WhatsApp (formato wa.me, sin +) al que llega el "Ya pague" del cliente. Default = el mismo numero que ya usaba CheckoutSuccess.jsx para envios.';
comment on column shop_settings.payment_timer_minutes is 'Duracion del timer ficticio en /pago/:draftId - puramente cosmetico, no expira ni bloquea nada real.';

-- ============================================================
-- create_payment_draft() — reemplaza al primer paso de Stripe
-- (create-checkout-session). Valida precio/stock reales via
-- get_checkout_lines() (ya existia, resuelve el carrito completo
-- incluyendo promociones por volumen de desechables) y guarda el
-- borrador. NO crea el pedido ni descuenta stock — eso pasa recien en
-- confirm_payment_draft(), a mano, desde el admin.
-- ============================================================
create or replace function public.create_payment_draft(
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text,
  p_customer_address text,
  p_notes            text,
  p_items            jsonb -- [{ "product_id": "...", "variant_id": "..."|null, "quantity": n }]
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

revoke all on function public.create_payment_draft(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_payment_draft(text, text, text, text, text, jsonb) to anon, authenticated;

-- ============================================================
-- get_payment_draft() — lectura publica para /pago/:draftId. Seguro sin
-- login por el mismo motivo que get_order_by_session: el uuid del
-- borrador no es adivinable (entropia criptografica de gen_random_uuid).
-- ============================================================
create or replace function public.get_payment_draft(p_draft_id uuid)
returns table (
  draft_id    uuid,
  customer_name text,
  total       numeric,
  items       jsonb,
  consumed_at timestamptz,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select id, customer_name, total, items, consumed_at, created_at
  from checkout_drafts
  where id = p_draft_id;
$$;

revoke all on function public.get_payment_draft(uuid) from public;
grant execute on function public.get_payment_draft(uuid) to anon, authenticated;

-- ============================================================
-- confirm_payment_draft() — SOLO admin. Revalida stock EN VIVO (nunca
-- confia en el snapshot de precios del borrador, que pudo quedar viejo
-- mientras el cliente tardaba en transferir) y recien aqui crea el
-- pedido real + descuenta stock, atomico (FOR UPDATE), mismo patron que
-- create_paid_order()/create_pos_sale() (duplicado a proposito en vez
-- de parametrizar - ver razonamiento en stripe-checkout.sql, son
-- caminos de confianza distinta).
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
    quantity      int,
    product_name  text,
    product_price numeric
  ) on commit drop;

  for v_item in
    select * from jsonb_to_recordset(v_draft.items) as x(product_id uuid, variant_id uuid, quantity int)
  loop
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

    insert into _transfer_lines (product_id, variant_id, variant_label, quantity, product_name, product_price)
    values (v_item.product_id, v_item.variant_id, v_label, v_item.quantity, v_product.name, v_price);
  end loop;

  insert into orders (
    customer_name, customer_email, customer_phone, customer_address, notes,
    status, total, payment_method, payment_status
  )
  values (
    v_draft.customer_name, v_draft.customer_email, v_draft.customer_phone, v_draft.customer_address, v_draft.notes,
    'pending', v_total, 'transferencia', 'paid'
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, variant_id, variant_label, product_name, product_price, quantity)
  select v_order_id, product_id, variant_id, variant_label, product_name, product_price, quantity from _transfer_lines;

  update checkout_drafts set consumed_at = now() where id = p_draft_id;

  return query select v_order_id, v_total;
end;
$$;

-- Igual que create_pos_sale/cancel_order: "revoke ... from public" NO
-- le saca el EXECUTE a anon en este proyecto (default privileges se lo
-- otorgan aparte) - hace falta el revoke explicito a anon tambien.
revoke all on function public.confirm_payment_draft(uuid) from public;
revoke execute on function public.confirm_payment_draft(uuid) from anon;
grant execute on function public.confirm_payment_draft(uuid) to authenticated;

-- ============================================================
-- Limpieza: funciones que solo usaba el flujo de Stripe, retirado.
-- No se toca orders.stripe_session_id ni los 2 pedidos historicos con
-- payment_method='stripe' - solo se borra el codigo que ya no se llama.
-- ============================================================
drop function if exists public.create_paid_order(text, text, text, text, text, jsonb, text);
drop function if exists public.get_order_by_session(text);
drop function if exists public.get_checkout_line(uuid, uuid);

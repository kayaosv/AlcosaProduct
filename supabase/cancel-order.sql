-- ============================================================
-- Vapers Alcosa — cancelar pedido repone stock
-- ============================================================
-- Bug encontrado tras activar el TPV (aunque afecta a TODOS los
-- pedidos, no solo los del mostrador): cambiar orders.status a
-- 'cancelled' desde /admin/orders o /admin/orders/:id era un UPDATE
-- plano (updateOrderStatus en useAdminOrders.js) sin ningún efecto
-- sobre el stock — create_order()/create_paid_order()/create_pos_sale()
-- descuentan al crear el pedido, pero cancelar nunca lo devolvía.
-- Idempotente: si el pedido ya estaba cancelado, no hace nada (evita
-- reponer stock dos veces si alguien cancela dos veces seguidas).

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_item   record;
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'No autorizado';
  end if;

  select status into v_status from orders where id = p_order_id for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  for v_item in
    select product_id, variant_id, quantity from order_items where order_id = p_order_id
  loop
    if v_item.variant_id is not null then
      update product_variants set stock = stock + v_item.quantity where id = v_item.variant_id;
    elsif v_item.product_id is not null then
      update products set stock = stock + v_item.quantity where id = v_item.product_id;
    end if;
  end loop;

  update orders set status = 'cancelled' where id = p_order_id;
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;
-- Este proyecto otorga EXECUTE directo a anon vía default privileges al
-- crear una función nueva (ver comentario en pos-sale.sql) — se revoca
-- explícito, el guard interno ya la protege de todos modos.
revoke execute on function public.cancel_order(uuid) from anon;

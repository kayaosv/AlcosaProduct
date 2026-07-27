-- ============================================================
-- Vapers Alcosa — nota de credito Odoo al cancelar un pedido
-- ============================================================
-- Verifactu (RD 1007/2023, Ley 11/2021 antifraude) prohibe modificar o
-- borrar una factura ya emitida/registrada - la cadena de hash exige
-- que quede intacta. La unica forma legal de reflejar un pedido
-- cancelado que ya tenia factura real en Odoo es una factura
-- rectificativa (nota de credito) que REFERENCIA a la original, nunca
-- la toca. Hasta ahora cancel_order() (ver cancel-order.sql) repone
-- stock y marca el pedido cancelado en Supabase, pero no existia
-- ningun mecanismo que reflejara la cancelacion del lado de Odoo -
-- si un pedido ya facturado se cancelaba, la factura en Odoo se
-- quedaba como si la venta siguiera en pie.
--
-- Estas columnas siguen el mismo patron que odoo_invoice_id/
-- odoo_sync_status/odoo_sync_error (ya existentes), pero para el
-- estado de la nota de credito en vez de la factura original.
-- 'not_required': el pedido nunca tuvo una factura Odoo sincronizada
--   que revertir (se cancelo antes de facturar, o Odoo no estaba
--   configurado en ese momento) - no hace falta nada.
-- 'pending': cancelado, esperando que se cree la nota de credito.
-- 'synced': nota de credito creada en Odoo (ver odoo_credit_note_id).
-- 'error': fallo la creacion, ver odoo_credit_note_error.

alter table orders
  add column if not exists odoo_credit_note_id text,
  add column if not exists odoo_credit_note_status text not null default 'not_required',
  add column if not exists odoo_credit_note_error text;

comment on column orders.odoo_credit_note_id is 'ID en Odoo de la nota de credito (account.move, move_type=out_refund) creada al cancelar un pedido que ya tenia factura sincronizada.';
comment on column orders.odoo_credit_note_status is '''not_required'' (nunca hubo factura real que revertir), ''pending'', ''synced'' o ''error'' — ver odoo_credit_note_error.';

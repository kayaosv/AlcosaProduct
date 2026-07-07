# Supabase — orden de aplicación

Aplicar en este orden en el **SQL Editor** del proyecto Supabase de producción:

1. **`schema.sql`** — tablas base, RLS, helper `is_admin()`. Aplicar UNA sola vez al crear el proyecto.
2. **`schema-reconcile.sql`** — reconcilia columnas/tablas (`product_variants`, `axis_config`, `images`…) que en el proyecto real se crearon a mano y no estaban documentadas aquí. Idempotente.
3. **`create-order-rpc.sql`** — función `create_order()` que permite el checkout público con validación y descuento atómico de stock. **Sustituye a `checkout-policies.sql`** (ver abajo).
4. **`storage.sql`** — bucket `product-images` + policies de upload (admin) y lectura pública.
5. **`admin-user.sql`** — NO es ejecutable directo: contiene instrucciones para crear el usuario admin en Auth → Users y luego insertar su `profile` con `role='admin'`.

Ver `AUDIT-2026-07.md` para el contexto completo de por qué se hizo este reordenamiento.

## ⚠️ Archivo superado

- **`checkout-policies.sql`** — enfoque original (INSERT público directo en
  `orders`/`order_items`, sin bloqueo de fila ni descuento de stock). Nunca
  llegó a aplicarse en producción. Se mantiene por historial pero **no se
  debe aplicar**: usar `create-order-rpc.sql` en su lugar.

## ❌ NO aplicar en producción

- **`seed-products.sql`** — son 30 productos de prueba para desarrollo. El cliente debe meter su catálogo real desde el panel `/admin/products`.

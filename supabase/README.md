# Supabase — orden de aplicación

Aplicar en este orden en el **SQL Editor** del proyecto Supabase de producción:

1. **`schema.sql`** — tablas base, RLS, helper `is_admin()`. Aplicar UNA sola vez al crear el proyecto.
2. **`schema-reconcile.sql`** — reconcilia columnas/tablas (`product_variants`, `axis_config`, `images`…) que en el proyecto real se crearon a mano y no estaban documentadas aquí. Idempotente.
3. **`create-order-rpc.sql`** — función `create_order()` que permite el checkout público con validación y descuento atómico de stock. **Sustituye a `checkout-policies.sql`** (ver abajo).
4. **`variant-checkout.sql`** — extiende `create_order()` para validar y descontar el stock de la **variante** elegida (`product_variants.stock`), no solo el del producto base. Necesario porque el admin oculta precio/stock del producto cuando tiene variantes — ese stock vive solo en la variante. Añade `order_items.variant_id` / `variant_label`.
5. **`add-barcode.sql`** — columna `products.barcode` (único) + índice, para el escáner de stock (`/admin/stock-scanner`).
6. **`add-variant-barcode-and-category-template.sql`** — columna `product_variants.barcode` (único, para escanear la variante exacta y no solo el producto padre) y columnas `categories.kind`/`categories.variant_type` (mueve el "molde" de categoría — qué especificaciones y qué tipo de variante acepta — de estar hardcodeado en `src/lib/productSpecs.js` a ser editable desde `/admin/categories`; incluye backfill de las 12 categorías existentes con los valores que ya tenían hardcodeados, sin cambiar comportamiento).
7. **`storage.sql`** — bucket `product-images` + policies de upload (admin) y lectura pública.
8. **`admin-user.sql`** — NO es ejecutable directo: contiene instrucciones para crear el usuario admin en Auth → Users y luego insertar su `profile` con `role='admin'`.
9. **`telegram-order-notify.sql`** — trigger que avisa por Telegram al vendedor cuando entra un pedido. Necesita dos secretos en Supabase Vault (`telegram_bot_token`, `telegram_chat_id`) que este archivo NO crea — ver instrucciones dentro del propio archivo. Sin esos secretos el trigger no hace nada; si Telegram falla, tampoco rompe el pedido (excepción atrapada a propósito).

Ver `AUDIT-2026-07.md` para el contexto completo de por qué se hizo este reordenamiento.

## ⚠️ Archivo superado

- **`checkout-policies.sql`** — enfoque original (INSERT público directo en
  `orders`/`order_items`, sin bloqueo de fila ni descuento de stock). Nunca
  llegó a aplicarse en producción. Se mantiene por historial pero **no se
  debe aplicar**: usar `create-order-rpc.sql` + `variant-checkout.sql` en su lugar.

## ❌ NO aplicar en producción

- **`seed-products.sql`** — son 30 productos de prueba para desarrollo. El cliente debe meter su catálogo real desde el panel `/admin/products`.

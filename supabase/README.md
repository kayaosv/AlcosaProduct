# Supabase — orden de aplicación

Aplicar en este orden en el **SQL Editor** del proyecto Supabase de producción:

1. **`schema.sql`** — tablas base, RLS, helper `is_admin()`. Aplicar UNA sola vez al crear el proyecto.
2. **`checkout-policies.sql`** — políticas para que el checkout anónimo pueda insertar pedidos.
3. **`storage.sql`** — bucket `product-images` + policies de upload (admin) y lectura pública.
4. **`admin-user.sql`** — NO es ejecutable directo: contiene instrucciones para crear el usuario admin en Auth → Users y luego insertar su `profile` con `role='admin'`.

## ❌ NO aplicar en producción

- **`seed-products.sql`** — son 30 productos de prueba para desarrollo. El cliente debe meter su catálogo real desde el panel `/admin/products`.

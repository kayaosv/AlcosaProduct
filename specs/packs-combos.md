# Packs / combos de productos con precio de oferta

## Objetivo

Permitir armar "packs" (ej. dispositivo + líquido + resistencia) a partir
de productos/variantes ya cargados, con un precio de oferta fijo elegido
a mano (un número cerrado, más barato que la suma de los componentes por
separado) — vendibles en la web y en el TPV, y que el motor de
sugerencias ("llévalos juntos") detecte cuando al carrito le falta un
producto para completar un pack y lo ofrezca por ese precio.

## Modelo de datos

- `packs` (id, name, slug, description, image_url, price numeric,
  is_active, created_at, updated_at) — el precio es el número final que
  paga el cliente por el pack completo, cargado a mano por el admin (no
  se calcula solo). `image_url` opcional — si no se carga, la vidriera
  usa la foto del primer componente.
- `pack_items` (id, pack_id, product_id, variant_id nullable, quantity,
  sort_order) — un pack puede fijar una variante concreta (ej. "este
  sabor") o dejarlo en el producto base cuando no aplica.
- `order_items.pack_id` (nullable, FK a `packs`) — una venta de pack
  genera **una sola línea** en `order_items` (`product_id = null,
  pack_id = <id>, product_name = <nombre del pack>, product_price =
  <precio del pack>`), igual que hoy una línea normal — no una fila por
  componente. El picking/preparación de qué entregar sale de juntar esa
  línea con `pack_items` (mismo criterio que hoy con `variant_label`).

## Precio y stock — dónde vive el cálculo

Único lugar donde se resuelve/descuenta stock de un pack:
`consume_pack_stock(pack_id, quantity)` (SQL, `SECURITY DEFINER`,
revocada de `anon`/`authenticated` — solo la llaman internamente las
funciones de venta, mismo patrón que `apply_desechables_tier`). Bloquea
(`FOR UPDATE`) cada componente, descuenta `pack_item.quantity *
quantity` de cada uno, y devuelve el precio fijo del pack. Si a algún
componente le falta stock, se corta toda la venta (atómico) con un
mensaje que dice cuál.

Los 4 puntos donde hoy se fija un precio de cobro ganan soporte para una
línea de pack (`{ pack_id, quantity }` en vez de `{ product_id,
variant_id, quantity }`):

- `create_order()` (reserva y paga en tienda)
- `create_payment_draft()` / `get_checkout_lines()` (pago online
  transferencia/Bizum — el draft; el preview de `get_checkout_lines` NO
  descuenta stock, solo informa cuántos packs se pueden armar hoy)
- `confirm_payment_draft()` (confirmación manual del pago)
- `create_pos_sale()` (TPV)

Ninguna de las 4 se reescribe por dentro — mismo criterio que las
promociones por volumen de desechables (`apply_desechables_tier`): se
agrega una rama al loop existente que, si la línea trae `pack_id`,
llama a `consume_pack_stock` en vez de resolver producto/variante, y
sigue. Las líneas de pack quedan con `category_id = null`, así que
`apply_desechables_tier` las ignora solas (no hace falta excluirlas a
mano).

## Criterios de aceptación

- [ ] `/admin/packs` (nueva sección del sidebar): listar, crear, editar,
      activar/desactivar packs. Al armar uno: buscador de productos
      (reutiliza el patrón `ilike` ya usado en TPV/Escáner), elegir
      variante si el producto tiene, cantidad por componente, y un
      campo de precio final con la suma de precios actuales de los
      componentes mostrada al lado como referencia (no bloquea el
      número que el admin decida poner).
- [ ] El pack aparece en el catálogo web (tarjeta propia, con precio de
      oferta) y se puede agregar directo al carrito.
- [ ] El pack se puede vender desde el TPV (buscador por nombre, igual
      que un producto) — una sola línea a su precio fijo.
- [ ] Vender un pack (web o TPV) descuenta el stock real de cada
      componente; si no alcanza, la venta completa se rechaza con un
      mensaje que dice qué componente falta.
- [ ] "Llévalos juntos" detecta packs incompletos: si el carrito ya
      tiene todos los componentes de un pack activo menos uno, se
      sugiere agregar ese producto para completar el pack al precio de
      oferta (mostrando el ahorro vs. comprarlo suelto).
- [ ] `OrderDetail.jsx`/ticket del TPV muestran, para una línea de pack,
      qué productos/variantes lo componen (no solo el nombre del pack).
- [ ] `npm run build` y `npm test` pasan. Funciones SQL probadas contra
      la base real (crear un pack de prueba, vender, verificar stock
      descontado en cada componente, revertir datos de prueba) —
      mismo criterio que Stripe/Odoo/promo tiers en sesiones previas.

## Fuera de alcance

- No se toca el gap encontrado de paso (`confirm_payment_draft` no
  aplica `apply_desechables_tier` al confirmar un pago por
  transferencia, a diferencia de `create_order`/`create_pos_sale`) —
  bug preexistente, ajeno a este pedido, señalado para decidir aparte.
- No hay límite de cuántos packs puede tener un mismo producto, ni
  validación de que un producto no se repita en el mismo pack.
- El pack no tiene su propia ficha con specs/galería tipo `Product.jsx`
  — es una tarjeta con nombre/foto/precio/qué incluye, sin motor de SEO
  dedicado (fuera de alcance, se puede sumar después si hace falta).

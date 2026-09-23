# TPV: descuento/precio manual por línea

## Objetivo

El cajero necesita poder rebajarle el precio a una línea del carrito en
una venta física puntual (ej. "te lo dejo en 8€ en vez de 9"), sin tener
que ir a `/admin/products` a bajarle el precio al producto en general.

## Diseño

- `Tpv.jsx`: cada línea del carrito gana un botón "%" (editar precio)
  que abre un editor inline con el precio de catálogo de referencia,
  accesos rápidos de −10/−20/−30% y un campo libre — mismo patrón ya
  probado en `kayaosv/Stylo019` (`abrirDescuento`/`aplicarDescuento`).
  El precio manual nunca puede ser mayor al de catálogo (es un
  descuento, no un recargo) ni negativo.
- El precio manual viaja en el `p_items` de `create_pos_sale` como
  `manual_price` opcional por línea. La función solo lo acepta si es
  `<=` al precio que ella misma resolvió del catálogo (nunca confía en
  el precio "de catálogo" que mande el cliente, solo en si el manual es
  menor o igual al que ella calculó) — así un vendedor no puede
  inflarse un precio por error de cliente ni el descuento queda abierto
  a cualquier número.
- El ticket (`PosTicket.jsx`) y `order_items` muestran el precio
  efectivo cobrado (ya con el descuento aplicado) — no hace falta
  guardar aparte "precio original vs. rebajado", con que el total y el
  ticket reflejen lo cobrado alcanza (igual que cualquier otra venta).

## Criterios de aceptación

- [ ] Botón "%" en cada línea del carrito del TPV abre el editor de
      precio con accesos rápidos −10/−20/−30% + campo libre.
- [ ] No se puede aplicar un precio manual mayor al de catálogo ni
      negativo (UI y también validado server-side en `create_pos_sale`).
- [ ] El total del carrito y el ticket reflejan el precio ya rebajado.
- [ ] `create_pos_sale` sigue validando/descontando stock igual que
      hoy — el descuento no cambia nada de la lógica de stock, solo el
      precio unitario cobrado en esa línea.
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se agrega un PIN/confirmación extra para aplicar el descuento —
  solo hay admin logueado en este panel hoy, mismo criterio que el
  resto del TPV.
- No se aplica esto a pedidos online/reserva — es exclusivo del cobro
  presencial en el TPV.

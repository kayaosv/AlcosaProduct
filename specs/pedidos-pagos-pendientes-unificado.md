# Pagos pendientes como pestaña dentro de Pedidos

## Objetivo

Hoy "Pedidos" y "Pagos pendientes" son dos páginas separadas con su propio
badge en el sidebar. Un borrador de pago (transferencia/Bizum sin
confirmar) no es todavía un pedido real, pero para quien administra la
tienda es el mismo tipo de "cosa pendiente de atender" — separarlo en dos
lugares distintos hace que se pueda pasar por alto. Como ya no existe el
cobro automatizado (Stripe se retiró), no tiene sentido mantener la
separación.

## Criterios de aceptación

- [ ] `/admin/pending-payments` deja de ser una entrada propia del sidebar.
- [ ] `Orders.jsx` gana una pestaña más junto a Todos/Pendiente/Confirmado/
      Listo/Cancelado: **"Pendientes de pago"**, que lista los
      `checkout_drafts` sin confirmar (mismos datos que mostraba
      `PendingPayments.jsx`: cliente, contacto, items, total, fecha) con
      su acción "✅ Confirmar pago recibido" (`confirm_payment_draft` +
      `odoo-sync`, igual que antes).
- [ ] El contador de esa pestaña (`usePendingPaymentDraftsCount`) se ve
      igual que los contadores de los demás estados.
- [ ] El sidebar muestra **un solo** badge rojo en "Pedidos", con la suma
      de pedidos pendientes + pagos pendientes de confirmar.
- [ ] La ruta vieja `/admin/pending-payments` redirige a
      `/admin/orders?tab=pending-payments` (por si quedó algún enlace
      guardado) en vez de dar 404.
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se cambia `confirm_payment_draft()` ni ninguna función SQL — es
  puramente una reorganización de UI/routing, cero cambios de esquema.
- No se fusiona el concepto de "borrador de pago" con "pedido" en la base
  de datos (`checkout_drafts` sigue siendo su propia tabla) — un borrador
  sigue sin reservar stock hasta confirmarse, eso no cambia.

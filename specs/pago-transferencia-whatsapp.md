# Pago propio por transferencia/Bizum + confirmación por WhatsApp

## Objetivo

Vapers Alcosa quiere dejar de depender de una pasarela de pago externa
(Stripe) para el pago online. En su lugar: el cliente ve en la propia web
el IBAN y/o el número de Bizum de la tienda, transfiere el importe por su
cuenta, y confirma el pago apretando un botón que abre WhatsApp con el
pedido ya redactado — así el dueño revisa el pedido + el comprobante que
el cliente adjunta a mano en el chat, y confirma el pedido desde el
admin. Reemplaza al flujo de Stripe (`Checkout.jsx` → `create-checkout-
session` → Stripe → `stripe-webhook`), que se retira por completo del
código en producción.

## Criterios de aceptación

- [x] `Checkout.jsx` ya no ofrece "Pagar online con Stripe" — el botón de
      pago online ahora dice "Pagar por transferencia/Bizum" y no llama a
      Stripe en ningún punto.
- [x] Al enviar el formulario de pago, se valida en el servidor (nunca se
      confía en precio/stock que manda el navegador) y se crea un
      **borrador** (`checkout_drafts`, reutilizada — ya existía para
      Stripe) con el carrito + total resuelto. **No se crea el pedido
      real ni se descuenta stock todavía** (decisión explícita: el stock
      solo se reserva cuando el dueño confirma el comprobante a mano, no
      antes).
- [x] El cliente es enviado a `/pago/:draftId`, una pantalla propia
      (sin salir del sitio) que muestra:
      - El resumen del pedido (items + total).
      - El/los medio(s) de cobro configurados (IBAN y/o Bizum) — leídos
        de `shop_settings`, editables desde `/admin/settings` sin tocar
        código.
      - Un timer descendente **ficticio** (cosmético — no bloquea ni
        expira nada real al llegar a cero, solo agrega urgencia visual).
      - Un botón "Ya pagué — enviar comprobante por WhatsApp" que abre
        `wa.me` con un mensaje prellenado: nº de referencia, cliente,
        items, total, y los datos de cobro usados — mismo patrón que ya
        existía en `CheckoutSuccess.jsx` para el envío a domicilio.
- [x] El dueño ve los borradores pendientes en una pantalla nueva del
      admin (`/admin/pending-payments`), con los datos del pedido y un
      botón "Confirmar pago recibido" que — recién ahí — valida stock en
      vivo (`FOR UPDATE`, mismo patrón atómico que `create_order`/
      `create_paid_order`/`create_pos_sale`), descuenta stock, crea el
      pedido real (`payment_method = 'transferencia'`,
      `payment_status = 'paid'`) y dispara el aviso de Telegram/Odoo
      existentes (mismos triggers/edge functions ya en uso, sin tocar).
- [x] Un borrador ya confirmado no se puede confirmar dos veces
      (`checkout_drafts.consumed_at`, mismo guard que ya usaba Stripe).
- [x] Se corrige de paso un bug ya documentado como pendiente en
      `CLAUDE.md` (#23): los checkboxes obligatorios "acepto privacidad"
      / "confirmo mayoría de edad" ahora sí bloquean el envío del
      formulario (antes solo se deshabilitaban por `loading`).
- [x] `npm run build` limpio y `npm test` en verde tras los cambios.

## Fuera de alcance

- **Adjuntar el comprobante automáticamente al mensaje de WhatsApp**: el
  deep link `wa.me` no soporta adjuntar archivos por URL — el cliente
  adjunta la captura/foto a mano en el chat, como ya asumía el flujo de
  envío a domicilio existente.
- **Verificación automática del pago**: no hay integración bancaria real
  ni lectura de movimientos — la confirmación siempre es manual, apretando
  un botón en `/admin/pending-payments` después de ver el comprobante.
- **Borrar los Edge Functions de Stripe ya desplegados en Supabase**
  (`create-checkout-session`, `stripe-webhook`): se borra su código
  fuente del repo, pero borrar el *deploy* real requiere `supabase login`
  (CLI sin sesión en este entorno) o el dashboard — queda anotado como
  pendiente manual en `STATUS.md`. No representan riesgo mientras tanto
  (JWT/firma de Stripe siguen exigidos, nada los invoca).
- **Datos históricos de Stripe**: los 2 pedidos reales con
  `payment_method = 'stripe'` ya existentes se dejan intactos, igual que
  la columna `orders.stripe_session_id` — no se migra ni se borra nada
  de eso.
- **Elegir entre IBAN o Bizum en el formulario**: se muestran ambos si
  están configurados, no se le pide al cliente elegir uno — es su
  comprobante el que aclara cuál usó.

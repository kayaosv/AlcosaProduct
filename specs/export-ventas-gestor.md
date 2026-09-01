# Export de ventas para el gestor

## Objetivo

Hoy la única forma de sacar un listado de ventas es entrar a Odoo o mirar
`/admin/orders` a mano. El cliente quiere dejar de depender de Odoo para
esto: un botón en el admin que exporte a Excel **todas las ventas** (TPV
físico + pago online Stripe + reservas pagadas en tienda) de un rango de
fechas, en un formato claro para entregarle directo al gestor.

Odoo sigue funcionando exactamente igual que hoy en paralelo (factura legal
vía `odoo-sync`, fire-and-forget) — este export no lo reemplaza ni lo toca,
es una herramienta adicional para no depender de entrar a Odoo cuando lo
único que hace falta es un listado de ventas.

## Criterios de aceptación

- [ ] Página nueva `/admin/reports` (enlazada desde el Sidebar) con selector
      de fecha desde/hasta (por defecto: mes en curso).
- [ ] Filtro opcional por canal: TPV efectivo, TPV tarjeta, Online (Stripe),
      Reserva en tienda — todos activos por defecto.
- [ ] Por defecto excluye pedidos `cancelled`; checkbox "Incluir cancelados"
      para sumarlos igual (marcados como tal en la columna Estado).
- [ ] Antes de exportar, la página muestra un resumen en pantalla (nº de
      pedidos, total del período, desglose por canal) para que el cliente
      verifique el rango antes de bajar el archivo.
- [ ] Botón "Exportar a Excel" descarga un `.xlsx` con dos hojas:
      - **Ventas**: una fila por línea de producto vendido (fecha, hora, nº
        de pedido, canal, estado, producto, variante, cantidad, precio
        unitario, subtotal de línea, total del pedido, forma de pago,
        cliente, estado de sync con Odoo).
      - **Resumen**: totales por canal + gran total + nº de pedidos + ticket
        promedio del período exportado.
- [ ] La librería de export (`xlsx`) se carga con `import()` dinámico —
      nunca debe formar parte del bundle inicial del admin.
- [ ] Los importes coinciden exactamente con los que ya muestra
      `/admin/orders` para el mismo rango (mismo campo `total`, sin
      recalcular nada distinto).
- [ ] Tests unitarios (Vitest) sobre las funciones puras de agregación
      (agrupar por canal, sumar totales, armar filas) — no dependen de red,
      corren contra fixtures de pedidos simulados.

## Fuera de alcance

- No reemplaza ni desactiva `odoo-sync` — coexisten.
- No genera el archivo en el servidor ni lo manda por email/Telegram
  automáticamente (eso quedó descartado, ver decisión del cliente:
  botón on-demand en el admin, no reporte periódico automático).
- No agrega desglose de IVA ni ningún cálculo fiscal — es un listado de
  ventas para que el gestor trabaje con él, no una factura ni una
  declaración.
- No toca `Analytics.jsx` (esa página ya cubre métricas de catálogo/margen,
  este export es específicamente de transacciones).

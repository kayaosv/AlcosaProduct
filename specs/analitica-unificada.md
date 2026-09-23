# Analítica unificada (Catálogo + Ventas), reemplaza Informes como página aparte

## Objetivo

`Analytics.jsx` (margen/capital/distribución de catálogo) e `Informes`
(`Reports.jsx`, ventas por período) son dos páginas separadas que
responden la misma pregunta de fondo ("¿cómo va el negocio?") desde dos
ángulos que nunca se cruzan. Además "Informes" hoy es solo un cajón con
totales por canal en tarjetas, sin desglose en pantalla (el desglose por
línea ya existe, pero solo dentro del Excel exportado). Se unifican en una
sola página "Analítica" con dos pestañas, y se mejora la pestaña de Ventas
para que sirva de verdad como vista de administración de ventas, no solo
de disparador del export.

## Criterios de aceptación

- [ ] `/admin/reports` deja de existir como entrada propia del sidebar;
      `/admin/analytics` pasa a tener dos pestañas: **Catálogo** (todo lo
      que hoy tiene `Analytics.jsx`, sin cambios de contenido) y
      **Ventas** (reemplaza a `Reports.jsx`).
- [ ] Pestaña Ventas:
  - [ ] Selector de rango de fechas (ya existe) + filtro por canal
        (TPV efectivo/tarjeta, transferencia/Bizum, reserva en tienda,
        Stripe histórico) que **realmente filtra la tabla en pantalla**,
        no solo el resumen de tarjetas.
  - [ ] Tabla con el desglose real (no solo tarjetas de totales): una fila
        por pedido como mínimo — fecha, canal, cliente, estado, total,
        sync Odoo — con posibilidad de expandir/ver las líneas de
        producto de ese pedido.
  - [ ] Resumen por canal (lo que ya existe: pedidos + total por canal +
        ticket promedio) se mantiene arriba de la tabla.
  - [ ] Botón "Exportar a Excel" se mantiene, mismo archivo/columnas que
        ya genera `salesExport.js` (fecha, hora, pedido, canal, estado,
        producto, variante, cantidad, precios, cliente, sync Odoo) — no
        se reinventa el export, ya cumple lo que pide un gestor/contable.
  - [ ] Checkbox "incluir cancelados" se mantiene.
- [ ] Los pagos pendientes de confirmar (`checkout_drafts`) NO entran acá
      — son un estado anterior a que exista una venta real, siguen
      viviendo en la pestaña "Pendientes de pago" de Pedidos (ver
      `specs/pedidos-pagos-pendientes-unificado.md`). Analítica de Ventas
      solo mide ventas ya concretadas.
- [ ] Título de página e ítem de sidebar en español: "Analítica" en vez de
      "Analytics" (y de paso, "Panel" en vez de "Dashboard" en
      `Dashboard.jsx`/`Sidebar.jsx`, mismo criterio de idioma único).
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se agregan nuevos tipos de gráfico ni métricas que no existan hoy en
  `Analytics.jsx` o `Reports.jsx` — es una fusión y mejora de superficie
  (filtros que funcionan, desglose visible), no un rediseño analítico
  desde cero.
- No se cambia el formato ni las columnas del Excel exportado.
- No se prueba visualmente en navegador (mismo bloqueo de siempre: SSO de
  Vercel) — verificación visual queda pendiente para el cliente.

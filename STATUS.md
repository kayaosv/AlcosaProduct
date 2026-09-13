# STATUS

Última actualización: 2026-09-13

## Estado actual

E-commerce + TPV físico de Vapers Alcosa (Sevilla). Supabase es la fuente de
verdad operativa de stock/ventas; Odoo recibe fire-and-forget la factura
legal en paralelo (no bloquea ninguna venta). El pago online **ya no usa
Stripe** — es transferencia/Bizum propio, confirmado a mano por WhatsApp
(ver sección de abajo). El historial detallado de cada sesión de trabajo
vive en el propio `CLAUDE.md` del repo (convención previa a este
`STATUS.md` — se mantiene así, no se migra retroactivamente).

## Hecho (verificado)

- **Pago propio por transferencia/Bizum + confirmación por WhatsApp
  (2026-09-13, specs/pago-transferencia-whatsapp.md)** — reemplaza a
  Stripe por completo en el pago online. Flujo: `Checkout.jsx` (botón
  "Pagar por transferencia/Bizum") → `create_payment_draft()` (valida
  precio/stock real, NO crea pedido ni descuenta stock) → `/pago/:draftId`
  (`Pago.jsx`: IBAN/Bizum desde `shop_settings`, timer ficticio cosmético,
  botón "Ya pagué" que abre WhatsApp con el carrito prellenado) → el dueño
  confirma a mano en `/admin/pending-payments` → `confirm_payment_draft()`
  (revalida stock EN VIVO, atómico, recién ahí crea el pedido real y
  descuenta stock, dispara Odoo igual que el TPV).
  - Migración: `supabase/transfer-payment.sql` (aplicada a producción vía
    MCP, `get_advisors` sin hallazgos nuevos — mismos anon-callable
    esperados que `create_order`, mismo guard admin que `cancel_order`/
    `create_pos_sale` en `confirm_payment_draft`).
  - `checkout_drafts`/`shop_settings` reutilizadas (ya existían para
    Stripe/envío gratis) — nuevas columnas: `checkout_drafts.total`,
    `shop_settings.payment_iban/payment_bizum_phone/
    payment_whatsapp_phone/payment_timer_minutes`, editables desde
    `/admin/settings` sin tocar código.
  - Bonus fix (bug ya documentado como pendiente #23 en `CLAUDE.md`):
    los checkboxes "acepto privacidad"/"confirmo mayoría de edad" ahora
    sí bloquean el envío del formulario en `Checkout.jsx`.
  - `npm run build` limpio, `npm test` 9/9 verde (incluye
    `channelLabel('transferencia')` nuevo en `salesExport.test.js`).
  - **Verificado end-to-end contra la base real** (mismo criterio que
    Stripe/Odoo/TPV en sesiones previas, datos de prueba limpiados
    después): `create_payment_draft` con un producto real → borrador con
    total correcto; `get_payment_draft` devuelve el resumen; sin sesión
    admin simulada, `confirm_payment_draft` rechaza con "No autorizado";
    con `request.jwt.claims` simulando el admin real → crea el pedido
    (`payment_method='transferencia'`, `payment_status='paid'`), descuenta
    stock (200→198) y marca el borrador consumido; un segundo
    `confirm_payment_draft` sobre el mismo borrador rechaza con "Este
    pedido ya fue confirmado" (idempotencia). **No verificado**: el flujo
    completo desde el navegador real (`Checkout.jsx` → `Pago.jsx` → botón
    WhatsApp → `/admin/pending-payments`) — la lógica de servidor está
    probada, la UI todavía no se abrió en un browser real.
- Export de ventas para el gestor (specs/export-ventas-gestor.md) —
  `/admin/reports`: filtro por rango de fechas + canal (TPV efectivo/
  tarjeta, Stripe, reserva), resumen en pantalla, descarga `.xlsx` (2 hojas:
  Ventas detalle por línea + Resumen por canal). `xlsx` se carga con
  `import()` dinámico, nunca entra al bundle inicial. Tests unitarios
  (Vitest, recién agregado al proyecto — no existía antes) sobre las
  funciones puras de agregación en `src/lib/salesExport.js`.

## Pendiente / próximos pasos

- [ ] **Cargar el IBAN y/o número de Bizum reales desde `/admin/settings`**
      — hoy están vacíos (`shop_settings.payment_iban`/`payment_bizum_phone`
      = NULL), la pantalla `/pago/:draftId` va a mostrar "todavía no
      cargamos los datos de cobro" hasta que el cliente los cargue. No se
      inventó ningún dato bancario — regla dura de `CLAUDE.md` raíz.
- [ ] Probar el flujo completo en el preview de Vercel: carrito → checkout
      → `/pago/:draftId` (ver IBAN/Bizum, timer, botón WhatsApp) →
      `/admin/pending-payments` → confirmar → pedido real en `/admin/orders`
      con stock descontado y sync a Odoo.
- [ ] Borrar manualmente en el dashboard de Supabase (o `supabase login` +
      `functions delete`) los Edge Functions `create-checkout-session` y
      `stripe-webhook` — se borró su código fuente del repo pero el
      *deploy* sigue activo (sin riesgo real: JWT/firma de Stripe siguen
      exigidos, nada los invoca ya). CLI local sin sesión en este entorno,
      no se pudo hacer desde acá.
- [ ] Fase 2: auditoría de rendimiento/peso de bundle (three.js/gsap ya
      cargan, ver qué se puede diferir o recortar).
- [ ] Fase 3: bot de sugerencias/consultas de productos vía OpenRouter
      (modelo `:free`, grounded en catálogo real de Supabase).
- [ ] Confirmar visualmente en el admin real que `/admin/reports` funciona
      contra datos reales (no verificado en navegador desde acá).

## Decisiones tomadas

- 2026-08-31: Odoo se mantiene en paralelo (no se desactiva `odoo-sync`) —
  decisión explícita del cliente, el export de Excel es una herramienta
  adicional, no un reemplazo.
- 2026-08-31: el export es on-demand (botón en el admin), no un reporte
  automático periódico — decisión explícita del cliente.
- 2026-08-31: bot de productos vía OpenRouter con modelo gratuito
  (`:free`), no un widget de reglas ni un modelo de pago — decisión
  explícita del cliente, ver spec cuando se escriba en Fase 3. Límite real
  del tier free de OpenRouter: 20 req/min, 50/día sin compra previa de
  créditos, 1000/día si en algún momento se compraron $10 (verificado en
  vivo contra la doc de OpenRouter el 2026-08-31, no asumido de memoria).

## No verificado / riesgos conocidos

- **Flujo de transferencia/Bizum**: las 3 funciones RPC (`create_payment_draft`/
  `get_payment_draft`/`confirm_payment_draft`) están verificadas contra la
  base real (ver "Hecho" arriba), pero la UI (`Checkout.jsx`, `Pago.jsx`,
  `/admin/pending-payments`) todavía no se abrió en un navegador real —
  pendiente confirmar visualmente antes de confiar en esto con clientes
  reales. `/pago/:draftId` sin IBAN/Bizum cargados todavía (ver pendiente
  arriba).
- El export nunca se probó contra datos reales en el navegador — solo
  build limpio (`npm run build`, verificado) + 9 tests unitarios pasando
  (`npm test`, verificado) de las funciones de agregación.
- No hay tests end-to-end (Playwright) en el proyecto todavía — el harness
  los pide para flujos críticos (checkout, pagos); fuera de alcance de esta
  sesión, no se tocó el checkout.

## Fase 2 (perf) — en curso, 2026-09-01

**Hecho y verificado:**
- `AdminLayout` (routes.jsx) se importaba **eager** (no `lazy:`, a
  diferencia de todas sus rutas hijas) — cualquier visitante público
  descargaba igual el layout+CSS del panel admin sin usarlo nunca.
  Cambiado al mismo patrón `lazy:` que ya usa el resto del admin.
  Verificado con `npm run build`: el CSS del bundle público bajó de
  **62.94 KB → 22.29 KB** (gzip 12.85 → 5.39 KB, -65%), con
  `AdminLayout-*.css` (40.65 KB) ahora en su propio chunk que solo baja
  quien entra a `/admin`. `npm test` sigue en 9/9. JS principal casi sin
  cambio (~10 KB menos, `useAuth`/`useAdminOrders` también se separaron).

**Hallazgos, sin tocar — necesitan decisión o herramientas que no hay acá:**
- `public/models/vape-hq.glb` — **9.9 MB, no referenciado en ningún
  lado de `src/`** (confirmado por grep, solo `vape.glb` de 232 KB está
  en uso real en `HeroCanvas.jsx`/`ProductDecorCanvas.jsx`). No pega en
  la velocidad real (nadie lo descarga, Vite no empaqueta `public/` sin
  referencia), pero es peso muerto en el repo/deploy. Candidato a
  borrar — **no borrado todavía, confirmar con el cliente** por si es
  un asset a medio preparar para más adelante (coincide con el sandbox
  `ModelVape`/`vapers-playground` que existe justo para preparar estos
  modelos).
- `public/hdri/studio_small_03_1k.hdr` — **1.7 MB**, sí se descarga de
  verdad en cada visita al home con 3D activo (`<Environment>` en
  `HeroCanvas.jsx`). Es peso real de carga. Reducirlo (menor resolución,
  formato comprimido) requiere herramientas de conversión de imágenes
  (`gltf-transform`, ImageMagick, etc.) que **no están instaladas en
  este entorno** (verificado, ningún binario disponible) — no se
  reencodeó nada a ciegas sin poder verificar el resultado visual.
- El bundle JS principal (1.53 MB / 440 KB gzip) casi no bajó con el fix
  de `AdminLayout` — el resto es Home + Nav + CartDrawer + GSAP/
  ScrollTrigger/SplitText + react-router + supabase-js + zustand + lenis,
  todo legítimamente necesario en la home. Bajarlo más de acá requeriría
  diferir secciones dentro de `Home.jsx` (code-splitting a nivel
  sección) — **no encarado todavía**, porque toca directamente el mismo
  patrón `useGSAP`/`ScrollTrigger` que este mismo `CLAUDE.md` marca como
  frágil (ver nota de GSAP arriba, con dos regresiones reales ya
  documentadas) — requiere luz verde explícita antes de tocarlo.

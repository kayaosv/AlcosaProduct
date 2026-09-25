# STATUS

Última actualización: 2026-09-25

## Estado actual

E-commerce + TPV físico de Vapers Alcosa (Sevilla). Supabase es la fuente de
verdad operativa de stock/ventas; Odoo recibe fire-and-forget la factura
legal en paralelo (no bloquea ninguna venta). El pago online **ya no usa
Stripe** — es transferencia/Bizum propio, confirmado a mano por WhatsApp
(ver sección de abajo). El historial detallado de cada sesión de trabajo
vive en el propio `CLAUDE.md` del repo (convención previa a este
`STATUS.md` — se mantiene así, no se migra retroactivamente).

## Hecho (verificado)

- **Fix: el TPV no dejaba elegir variante (2026-09-25,
  specs/tpv-elegir-variante.md)** — el cliente reportó ventas reales
  registradas con la variante equivocada: desde el buscador por nombre
  (y escaneando el código del producto base) se agregaba siempre la
  variante principal (ej. "Shades Dry Shot" → HIGH, aunque existe
  MEDIUM). Ahora, con 2+ variantes activas se abre un selector con foto/
  precio/stock por variante; con 1 sola se agrega directo como antes. Los
  resultados del buscador muestran miniatura. Lógica en
  `src/lib/posVariants.js` (+ test de regresión). `npm test` 18/18,
  `npm run build` OK. **No verificado en navegador** — requiere prueba
  manual en `/admin/tpv`. Las ventas ya registradas mal no se tocaron.

- **Fix: cámara del escáner bloqueada por header de seguridad
  (2026-09-16)** — el cliente probó en su móvil real y reportó "no hay
  permisos, no salta la ventana que los pide". Causa raíz encontrada en
  `vercel.json` (no era el código del escáner): el header
  `Permissions-Policy: camera=()` desactivaba la cámara para **todo el
  sitio** a nivel de navegador — con eso, `getUserMedia` nunca llega a
  mostrar el diálogo nativo de permisos, se rechaza antes. Cambiado a
  `camera=(self)` (mic/geolocation se dejan bloqueados a propósito, no
  se usan). De paso, aprovechando que ya estaba tocando la Content-
  Security-Policy: se sumaron los dominios de GA4
  (`*.google-analytics.com`, `*.analytics.google.com`,
  `googletagmanager.com`) y Meta Pixel (`connect.facebook.net`,
  `facebook.com`) a `script-src`/`connect-src`/`img-src` — sin esto,
  aunque el cliente cargue un ID real de Analytics en `/admin/settings`,
  el CSP los iba a bloquear en silencio con el mismo síntoma que la
  cámara (bug que ya se puede prevenir en vez de repetir).
  **No verificado todavía**: el cliente tiene que volver a probar la
  cámara después de este deploy — si sigue sin pedir permiso, el
  siguiente sospechoso es que el navegador del teléfono ya tenga
  "bloqueado" este sitio guardado de un intento anterior (hay que
  resetear el permiso a mano en la configuración del sitio del
  navegador, no es algo que el código pueda arreglar).

- **CTA flotante de WhatsApp + SEO orgánico + mecanismo de Analytics/Ads
  (2026-09-15, specs/seo-analytics-whatsapp-cta.md)** — puntos 5 y 6 del
  mismo pedido de 7 puntos (ver auditoría abajo).
  - `WhatsAppFab.jsx` (en `RootLayout.jsx`, solo páginas públicas):
    botón flotante bottom-right, mensaje fijo "Hola, quiero hacer una
    consulta 🙂" sin datos de carrito, mismo número que ya usa el pago
    (`shop_settings.payment_whatsapp_phone`). Oculto en `/pago/:draftId`
    (ya tiene su propio CTA con el carrito).
  - `useSeo`/`useJsonLd` (`src/hooks/useSeo.js`, sin dependencia nueva —
    manipula `document.head` directo): `document.title`/meta
    description/Open Graph/Twitter Card dinámicos en `Home.jsx`,
    `Catalog.jsx` (con nombre de categoría) y `Product.jsx` (+ JSON-LD
    `schema.org/Product` con precio/disponibilidad real). `Cart.jsx`/
    `Checkout.jsx`/`Pago.jsx` marcadas `noindex`.
  - `index.html` con defaults estáticos fuertes (title/description/OG) —
    **importante**: los bots de vista previa de WhatsApp/Facebook/
    Twitter leen este HTML crudo sin ejecutar JS, así que **siempre**
    ven estos defaults genéricos, nunca la foto/precio de un producto
    específico compartido (el sitio es una SPA sin SSR/prerender —
    arreglar esto del todo es una decisión de arquitectura más grande,
    no encarada acá, ver spec). Googlebot sí ejecuta JS, así que el
    indexado/rich-results de Google no tiene este problema.
  - `robots.txt` (permite indexar, bloquea `/admin`/`/cart`/`/checkout`/
    `/pago`) + `scripts/generate-sitemap.js` (`postbuild`, lee productos/
    categorías reales de Supabase con la misma anon key del cliente,
    degrada a solo-rutas-estáticas si no hay credenciales — verificado
    en este build local sin `.env`, que efectivamente no las tiene).
  - `AnalyticsLoader.jsx` (en `RootLayout.jsx`): carga gtag.js (GA4) y/o
    el Pixel de Meta **solo si** `shop_settings.seo_ga4_id`/
    `seo_meta_pixel_id` tienen un valor real — nunca se inventó un ID de
    prueba. Editable desde `/admin/settings`, sección nueva "SEO y
    Analytics". Migración `supabase/add-seo-analytics-settings.sql`
    aplicada a producción.
  - `npm run build`/`npm test` verificados, incluido el `postbuild` real
    (generó `dist/sitemap.xml` con las 5 rutas estáticas + advertencia
    clara de que faltan credenciales — comportamiento esperado sin
    `.env` local).
  - **Pendiente real**: IDs de GA4/Meta Pixel (el cliente los tiene que
    pasar), y no probado visualmente en navegador — ni el CTA de
    WhatsApp, ni cómo se ve un link compartido, ni el sitemap generado
    por Vercel con credenciales reales.

- **Auditoría de 7 pedidos del cliente + fix cámara iPhone + buscador por
  nombre en TPV + indicador de código de barras faltante (2026-09-15)** —
  antes de codear nada se auditó el código real contra 7 pedidos del
  cliente (TPV reembolsos/facturación, campos de producto, fotos por
  variante, código faltante, CTA WhatsApp flotante, SEO/Analytics, cámara
  del escáner). Resultado completo en el chat de esta sesión — resumen:
  ya existían (marca/categoría/barcode por variante, fotos por variante,
  Odoo conectado y sincronizando de verdad — 2 ventas reales confirmadas
  el 2026-07-29, no "todavía no" como creía el cliente); no existían CTA
  WhatsApp flotante y SEO/Analytics (quedan pendientes, ver abajo); se
  encaró primero:
  - **Bug real encontrado**: `useBarcodeScanner.js` usaba la API nativa
    `BarcodeDetector` y su propio mensaje de error afirmaba "Safari iOS
    16.4+" — **verificado por búsqueda que es falso**, WebKit/Safari no
    implementa esa API, la cámara fallaba en silencio en todo iPhone.
    Reemplazado por `@zxing/browser` (decodifica en JS/WASM sobre el
    mismo `<video>`, funciona en Chrome/Android y Safari/iOS por igual) —
    mismo hook, misma interfaz pública, así que `Tpv.jsx` y
    `StockScanner.jsx` no necesitaron tocarse para heredar el fix.
  - **Buscador por nombre en el TPV** (`Tpv.jsx`): antes solo se podía
    agregar al carrito escaneando/tipeando el código de barras exacto —
    ahora hay un campo de texto debajo que busca por nombre (`ilike`,
    debounce 250ms, hasta 8 resultados) y agrega la variante principal al
    tocar un resultado, mismo criterio de resolución de precio que ya
    usaba el escaneo (`addProductRecord`, extraído de `lookup()` para
    compartir la lógica en vez de duplicarla).
  - **Indicador de "sin código de barras"** (`/admin/products`): nuevo
    campo calculado `missingBarcode` en `useAdminProducts.js` (si el
    producto tiene variantes, mira cada variante activa; si no, el
    código del producto base) — contador en el subtítulo, filtro "Solo
    sin código de barras", y badge ⚠ junto a la marca en cada fila.
  - `npm run build` y `npm test` (9/9) verificados. **No probado
    visualmente en un iPhone real** — el fix de `BarcodeDetector`→zxing
    se basa en que WebKit nunca implementó la API vieja (fuente:
    búsqueda web, no ejecución real en un dispositivo), no en una prueba
    end-to-end con cámara física desde acá.

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
- **Auditoría de duplicación TPV/Escáner/Pedidos/Analytics + idioma
  (2026-09-23)** — pedido explícito del cliente tras notar que TPV y
  Escáner "comparten lógica que en verdad está duplicada", que Pedidos
  y Pagos pendientes duplican función, y que Analytics/Informes debería
  ser una sola cosa con mejor desglose. Se auditó el código real antes
  de tocar nada (tres specs nuevas en `specs/`), se confirmaron 3
  decisiones de diseño con el cliente antes de implementar, y se
  encaró todo en la misma sesión:
  - **`src/lib/barcodeLookup.js`** (specs/tpv-scanner-lookup-compartido.md):
    la cascada "código → variante (por `barcode`) → si no, producto
    base" estaba copiada casi textual en `Tpv.jsx` y `StockScanner.jsx`
    (la cámara/pistola ya compartían `useBarcodeScanner.js`, eso no
    estaba duplicado). Extraída a una función única
    (`lookupByBarcode(code, { variantSelect, productSelect })`) —
    cada pantalla sigue pidiendo los campos que necesita (TPV quiere
    precio/promos, el escáner quiere stock/imagen), solo se comparte el
    orden de resolución. 4 tests nuevos (Vitest + `vi.mock` del cliente
    de Supabase, primera vez que se mockea en este proyecto).
    De paso, confirmado que el buscador por nombre del TPV (pedido
    original del cliente) **ya existía** desde el 2026-09-15 — si no se
    ve en el sitio real, es un problema de deploy/caché, no de código
    faltante.
  - **Pagos pendientes fusionado en Pedidos**
    (specs/pedidos-pagos-pendientes-unificado.md): `/admin/pending-payments`
    (`PendingPayments.jsx`, borrado) ahora es una pestaña más dentro de
    `Orders.jsx` ("Pendientes de pago", junto a Todos/Pendiente/
    Preparando/Listo/Entregado/Cancelado), con la misma tabla y el mismo
    botón "✅ Confirmar pago recibido" (`confirm_payment_draft` +
    `odoo-sync`, sin tocar). El sidebar (`Sidebar.jsx`) ahora muestra
    **un solo** badge rojo en "Pedidos" (`pendingOrders + pendingPayments`)
    en vez de dos badges separados. El link viejo `/admin/pending-payments`
    redirige a `/admin/orders?tab=pending-payments` (`routes.jsx`,
    `<Navigate replace>`) en vez de dar 404.
  - **Analítica unificada** (specs/analitica-unificada.md): `Analytics.jsx`
    (catálogo/margen/inventario) e "Informes" (`Reports.jsx`, ventas por
    período, borrado) eran dos páginas separadas que nunca se cruzaban.
    Ahora `/admin/analytics` tiene dos pestañas — **Catálogo** (contenido
    idéntico al `Analytics.jsx` de antes, sin cambios de lógica) y
    **Ventas** (lo que era `Reports.jsx`, mismo `salesExport.js` sin
    tocar, con un agregado real: antes solo mostraba tarjetas de totales
    por canal, ahora también una tabla con un pedido por fila —fecha,
    canal, cliente, estado, total, sync Odoo— expandible para ver las
    líneas de producto de ese pedido; el filtro por canal y el checkbox
    "incluir cancelados" ahora sí filtran esa tabla, antes solo influían
    en el Excel). El botón "Exportar a Excel" sigue siendo el mismo
    archivo/columnas de siempre, pensado para el gestor/contabilidad.
    `/admin/reports` redirige a `/admin/analytics?tab=ventas`.
  - **Idioma**: `Sidebar.jsx`/`Dashboard.jsx` decían "Dashboard" y
    "Analytics" en inglés en medio de un panel en español — renombrados
    a "Panel" y "Analítica". Se aprovechó para sacar del sidebar los
    íconos (`IconClock`/`IconFileText`) que quedaron sin uso al fusionar
    esas dos páginas.
  - **Pregunta del cliente sobre reconocimiento de producto por foto**:
    respondida, no implementada — `@zxing/browser` (la librería que ya
    usa la cámara del escáner) solo decodifica códigos de barra/QR
    dentro del cuadro, no reconoce el producto por su apariencia.
    Reconocimiento visual sin código de barras necesitaría un modelo de
    visión (clasificación/similitud) + fotos de referencia por producto
    + servicio de inferencia — evaluado como fuera de alcance de este
    pedido, no como algo que faltó prender.
  - Verificado: `npm run build` limpio, `npm test` 13/13 (9 preexistentes
    + 4 nuevos de `barcodeLookup.js`). **No verificado**: nada de esto se
    abrió en un navegador real (mismo bloqueo de siempre, SSO de Vercel)
    — ni las 3 pestañas nuevas, ni el badge combinado del sidebar, ni los
    dos redirects viejos.
- **Cámara del TPV sin feedback + pistola disparaba el guardado del
  producto (2026-09-23, mismo día, reportado por el cliente tras probar
  la fusión de arriba).** Dos bugs distintos, ambos encontrados leyendo
  el código real (sin poder probar en dispositivo físico desde acá):
  - **Cámara del TPV**: `Tpv.jsx` usaba clases CSS propias
    (`scanner-camera-wrap`/`scanner-camera-video`) que **no existen en
    `admin.css`** — el `<video>` se renderizaba sin tamaño/aspect-ratio/
    `object-fit`, y a diferencia de `StockScanner.jsx` no mostraba
    ningún texto tipo "Apuntá al código de barras…". El mecanismo de
    decodificación (`@zxing/browser`, ya arreglado el 2026-09-15) nunca
    estuvo roto — lo que faltaba era retroalimentación visual, así que
    parecía que la cámara "no hacía nada". Fix: `Tpv.jsx` ahora reusa
    exactamente el mismo markup ya probado de `StockScanner.jsx`
    (`.camera-wrap`/`.camera-video`/`.camera-aim`/`.camera-hint`, con
    su caja de encuadre). De paso, pedido explícito del cliente: si no
    reconoce ningún código en 6s de cámara abierta, el hint cambia a
    "No se reconoce ningún código — acercá la cámara o mejorá la luz"
    (`noDetection` nuevo en `useBarcodeScanner.js`, compartido, también
    se ve en `StockScanner.jsx`).
  - **Pistola disparaba el guardado del producto** — en
    `ProductEditor.jsx`, el campo de código de barras de una **variante
    nueva sin guardar todavía** (`draft.barcode`, dentro del formulario
    gigante `<form id="product-form">`) no tenía guard de `Enter` (los
    otros dos campos de barcode del mismo archivo sí lo tenían: el del
    producto y el de una variante ya guardada). La pistola manda un
    Enter automático después de cada código escaneado — sin guard, ese
    Enter disparaba el `submit` nativo del formulario completo,
    guardaba el producto y navegaba a `/admin/products` (lo que el
    cliente describió como "se devuelve al home de stock"). Fix: en vez
    de agregar un guard más a un campo más (mismo bug latente en
    cualquier otro input del formulario), se movió el guard al
    `<form>` mismo (`onKeyDown` que bloquea Enter en cualquier
    `<input>`) — el botón real de "Guardar" vive fuera de este `<form>`
    (`form="product-form" type="submit"` en el header), así que no se
    ve afectado. El guard puntual que ya tenía el campo de barcode del
    producto quedó redundante y se sacó; el de la variante ya guardada
    se dejó porque además dispara el commit inmediato del campo al
    presionar Enter (comportamiento útil, no solo el guard).
  - Verificado: `npm run build` limpio, `npm test` 13/13 (sin cambios
    de lógica testeable, ningún test nuevo aplica acá). **No
    verificado**: ninguno de los dos fixes se probó con hardware real
    (cámara de un móvil real, pistola física) desde acá — el cliente
    los reportó y hay que confirmar en el preview tras el próximo
    deploy.
- **Escáner de stock — vincular código a producto existente o crear uno
  nuevo (2026-09-23, mismo día, specs/escaner-vincular-o-crear-por-codigo.md)**.
  Pedido explícito del cliente inspirado en una funcionalidad de otro
  proyecto propio (`kayaosv/Stylo019`, revisado antes de diseñar —
  `VentaFisica.jsx`): al escanear un código no encontrado, la única
  salida era un link genérico a "Crear producto" sin el código
  precargado. Adaptado a este catálogo en vez de clonado literal:
  Stylo019 resuelve "no existe" creando un producto oculto de venta
  rápida sin categoría real (`activo:false`, categoría `venta_rapida`)
  — no aplica acá porque este catálogo depende de moldes de categoría
  reales (`ProductEditor.jsx`) para specs/variantes, y no hay concepto
  de "vender sin catalogar".
  - **Vincular a un producto existente** (`StockScanner.jsx`): nueva
    acción "🔗 Vincular a un producto existente" en el estado "no
    encontrado" — buscador por nombre (mismo patrón `ilike`/debounce
    250ms del buscador del TPV). Si el producto elegido no tiene
    variantes, el código se guarda directo en `products.barcode`; si
    tiene, pide elegir cuál (chips) antes de guardar en
    `product_variants.barcode`. Pensado para resolver de a uno los
    productos que ya señala `missingBarcode` en `/admin/products`
    (agregado el 2026-09-15) sin tener que entrar al editor completo.
  - **Crear producto nuevo**: el botón "+ Crear producto nuevo" navega a
    `/admin/products/new` pasando el código escaneado por
    `location.state.barcode` — `ProductEditor.jsx` lo precarga en el
    campo "Código de barras" (antes había que reescribirlo a mano). Es
    el editor completo real (categoría/molde/variantes desde el
    principio, decisión explícita del cliente), no un formulario
    paralelo simplificado.
  - Verificado: `npm run build` limpio, `npm test` 13/13 (sin tests
    nuevos — es un flujo de Supabase directo contra la base real, mismo
    patrón sin tests que `applyDelta`/`sellThis` ya existentes en el
    mismo archivo). **No verificado**: nada de esto se abrió en un
    navegador real todavía (ni el buscador, ni el vínculo contra un
    producto con variantes, ni el prefill del código en
    `ProductEditor.jsx`) — pendiente confirmar en el preview.
- **Packs/combos + descuento manual TPV + venta rápida TPV (2026-09-23,
  mismo día, specs/packs-combos.md, specs/tpv-descuento-manual.md,
  specs/tpv-venta-rapida.md).** Pedido grande del cliente, tres piezas:
  - **Packs**: tablas nuevas `packs`/`pack_items` (RLS: lectura pública
    si `is_active`, escritura solo admin) + `order_items.pack_id`.
    `consume_pack_stock()` es la única fuente de verdad para vender un
    pack — bloquea y descuenta el stock real de cada componente,
    atómico. `create_order`, `create_payment_draft`/`get_checkout_lines`,
    `confirm_payment_draft` y `create_pos_sale` ganan soporte para una
    línea `{ pack_id, quantity }` (mismo criterio no-DRY-a-propósito que
    ya usa este proyecto entre esas 4 funciones — ver promo tiers).
    `/admin/packs` (nuevo, en el sidebar): crear/editar packs buscando
    productos por nombre (variante específica si aplica), precio final
    a mano con la suma de componentes como referencia. Storefront:
    `/packs` (nuevo, en el menú), tarjetas con precio de oferta, se
    ocultan solos si no hay stock para armar ninguno. TPV: el buscador
    por nombre ahora también encuentra packs (🎁) y los agrega como una
    sola línea a su precio fijo. `OrderDetail.jsx` muestra qué compone
    una línea de pack (join a `pack_items` vía `order_items.pack_id`).
    **Verificado contra la base real**: pack de prueba con 2 componentes
    reales, vendido con `create_pos_sale` (pack + una línea normal con
    descuento manual en la misma venta) → total correcto, stock
    descontado en ambos componentes, `order_items` con las 2 filas
    esperadas (`pack_id` vs `product_id`). Probado también el rechazo
    por precio manual inflado y por stock insuficiente del pack (mensaje
    señala el componente exacto que falta). Todo revertido después.
  - **Descuento manual en el TPV**: botón "%" por línea (no en líneas de
    pack) — accesos rápidos −10/−20/−30% + campo libre, nunca puede
    superar el precio ya resuelto por catálogo/tramo. `create_pos_sale`
    valida el tope server-side (nunca confía en el precio que mande el
    cliente, solo en que el manual sea ≤ al que ella misma calculó).
  - **Venta rápida en el TPV** (pedido explícito del cliente, tipo
    `kayaosv/Stylo019`, revisado ese repo antes de construir esto):
    botón "+ Venta rápida" siempre visible junto al escáner — crea un
    producto oculto real (`is_active:false`, `category_id:null`, stock =
    la cantidad de esa venta) y lo agrega al carrito. **Bug real
    encontrado recién al probar contra la base** (no visible leyendo el
    código): `create_pos_sale` rechazaba cualquier producto
    `is_active=false`, lo que bloqueaba justo este caso. Fix en
    `supabase/fix-tpv-quick-sale-inactive-guard.sql`: acepta un producto
    inactivo únicamente cuando además no tiene categoría — combinación
    que un producto real desactivado desde `/admin/products` nunca tiene
    (el editor exige categoría), así que no abre la puerta a vender algo
    descatalogado de verdad. **Verificado con ambos casos reales**: el
    producto de venta rápida se pudo vender (stock a 0); un producto
    real desactivado temporalmente para la prueba siguió bloqueado con
    "ya no está disponible". Revertido después.
  - `get_advisors` (seguridad) revisado tras las 3 migraciones — sin
    hallazgos nuevos, todo lo que aparece ya estaba investigado y
    aceptado en sesiones anteriores (ítem 19 de este mismo archivo).
  - Verificado: `npm run build` limpio, `npm test` 13/13. **No
    verificado**: nada de esto se abrió en un navegador real (el
    catálogo de packs, el editor de packs, el buscador de packs en el
    TPV, el modal de descuento, el modal de venta rápida) — pendiente
    confirmar en el preview.
- **Cámara del escáner: códigos chicos/en superficie curva (2026-09-23,
  mismo día, specs/escaner-camara-codigos-dificiles.md)** — pedido
  urgente del cliente, botes chicos con códigos diminutos o impresos en
  curva que la cámara no reconocía. Mejoras gratuitas al motor actual
  (`@zxing/browser`) antes de evaluar migrar a otro:
  - Resolución de cámara pedida subida de 1280×(auto) a 1920×1080 — más
    píxeles reales por código chico.
  - `BrowserMultiFormatReader` ahora usa hints `TRY_HARDER` (modo
    exhaustivo, más lento por frame pero más preciso) +
    `POSSIBLE_FORMATS` acotado a EAN-13/8, UPC-A/E y Code128 (lo único
    que aparece en este catálogo) en vez de probar ~10 formatos.
    Requirió agregar `@zxing/library` como dependencia directa (antes
    solo transitiva vía `@zxing/browser`) para importar
    `DecodeHintType`/`BarcodeFormat`.
  - Zoom digital + linterna nuevos (`ScannerCameraControls.jsx`,
    compartido entre `Tpv.jsx` y `StockScanner.jsx`) — usan
    `IScannerControls` que `@zxing/browser` ya expone (`switchTorch`,
    `streamVideoConstraintsApply`, `streamVideoCapabilitiesGet`), no
    hizo falta código nuevo de bajo nivel. Se auto-ocultan si el
    navegador/dispositivo no los soporta (típicamente sí Chrome/Android,
    no iOS Safari todavía).
  - Mensaje de "no se reconoce" (a los 6s) ahora sugiere girar el envase
    para aplanar la parte del código hacia la cámara — una curva muy
    cerrada es un límite físico/óptico, ningún ajuste de software lo
    resuelve del todo.
  - **Se le explicó al cliente que existen motores de pago (Dynamsoft,
    Scandit) notablemente mejores para este caso puntual, y uno gratuito
    alternativo (`quagga2`) — se decidió probar primero estas mejoras
    gratuitas al motor actual antes de evaluar migrar.**
  - Verificado: `npm run build` limpio, `npm test` 13/13. **No
    verificado**: nada de esto se probó en un dispositivo real (sin
    cámara física ni navegador en este entorno) — pendiente que el
    cliente lo pruebe en el preview, idealmente con el mismo bote que le
    está fallando hoy. Si no alcanza, siguiente paso es `quagga2`.

## Pendiente / próximos pasos

- [ ] **Retomar acá primero**: la mejora de cámara del escáner
  (resolución 1920×1080, `TRY_HARDER`, zoom/linterna —
  specs/escaner-camara-codigos-dificiles.md, commit `859946f`) está
  **solo en `preview/alcosa`, todavía NO mergeada a `main`** — el
  cliente la pidió por códigos chicos/en curva que no leía bien, pero
  todavía no la probó en su celular real. Todo lo anterior en la misma
  sesión (dedupe TPV/Escáner, fusión Pedidos+Analítica, packs/combos,
  descuento manual TPV, venta rápida TPV) **sí fue probado por el
  cliente y ya está en `main`**. Esperar confirmación antes de mergear
  esta última.
- [x] ~~CTA flotante de WhatsApp~~ — **código resuelto 2026-09-15**
      (`WhatsAppFab.jsx`), ver "Hecho" arriba. Sigue pendiente probarlo
      visualmente en el preview (nunca se abrió en un navegador real).
- [x] ~~SEO + Analytics (mecanismo)~~ — **código resuelto 2026-09-15**
      (`useSeo.js`, JSON-LD, sitemap.xml, robots.txt, `AnalyticsLoader.jsx`),
      ver "Hecho" arriba. **Sigue bloqueado de verdad**: el cliente todavía
      no pasó IDs reales de GA4/Meta Pixel — sin eso, Analytics no manda
      ningún dato pese a que el código ya está listo.
- [ ] Probar el fix de cámara (`@zxing/browser`) en un iPhone real — el
      fix se basa en que Safari/WebKit nunca implementó `BarcodeDetector`
      (confirmado por búsqueda web), no en una prueba end-to-end con
      hardware real desde acá. Lo mismo para el buscador por nombre del
      TPV — código verificado con build/test, no abierto en navegador.
- [x] ~~Cargar el IBAN y/o número de Bizum reales~~ — **resuelto
      2026-09-14**: el cliente los pasó por chat, cargados directo en
      `shop_settings` vía SQL (no por `/admin/settings`, pero es la misma
      fila — igual de editable desde ahí a futuro si hace falta
      cambiarlos). `payment_whatsapp_phone` se dejó en el `34682725780`
      que ya usaba la tienda, sin cambios.
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
- [ ] Confirmar visualmente en el admin real la pestaña "Ventas" de
      Analítica (antes `/admin/reports`, fusionada el 2026-09-23) contra
      datos reales (no verificado en navegador desde acá).
- [ ] Confirmar visualmente la fusión del 2026-09-23 (ver "Hecho" arriba):
      pestaña "Pendientes de pago" dentro de Pedidos, badge combinado del
      sidebar, pestañas Catálogo/Ventas de Analítica, y los dos redirects
      viejos (`/admin/pending-payments`, `/admin/reports`) — nada de esto
      se abrió en un navegador real todavía.

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
  reales. IBAN/Bizum ya están cargados (ver "Hecho" arriba).
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

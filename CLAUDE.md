# Vapers Alcosa — contexto del proyecto

E-commerce de vapeo (Sevilla, Parque Alcosa). Vite + React + Three.js
(catálogo con 3D) + Supabase (Postgres/Auth/Storage) + Vercel.

**Modelo de negocio**: recogida en tienda física siempre — la web nunca
envía nada. Desde 2026-07-15 el cliente elige en el checkout entre dos
formas de pago: reservar y pagar en tienda al recoger (flujo original,
`create_order()`), o pagar online con Stripe por adelantado
(`create_paid_order()`, ver "Pago online con Stripe" más abajo). En
ambos casos se recoge y confirma disponibilidad por Instagram como
hasta ahora.

## Dónde vive cada cosa

- `src/pages/` — rutas públicas (Home, Catalog, Product, Cart, Checkout)
  y `src/pages/admin/` — panel de administración (productos, pedidos,
  categorías, mayorista, analíticas, escáner de stock por código de barra).
- `src/hooks/` — acceso a datos vía Supabase JS client (`src/lib/supabase.js`).
- `src/stores/` — Zustand: `useCartStore` (carrito, persistido en
  localStorage, líneas identificadas por `productId` + `variantId`) y
  `useAppStore` (UI: carrito abierto, tema, loader).
- `supabase/` — SQL de esquema, políticas RLS y notas de despliegue.
  **Leer `supabase/README.md` antes de tocar la base** — documenta el
  orden de aplicación y qué archivos están superados.

## Entorno de trabajo (para agentes)

- Repo: `kayaosv/AlcosaProduct`. Rama de trabajo activa: **`preview/alcosa`**
  (main no se toca hasta hacer merge deliberado).
- Supabase project ref: `jklippehnbzrrtrzbctw`. Sin branching de base de
  datos disponible (plan actual no lo soporta) — main y cualquier preview
  comparten la misma base real. Los cambios de esquema son aditivos e
  idempotentes por eso mismo.
- Vercel: proyecto `alcosa-product` bajo `kayaosv-gmailcoms-projects`.
  El preview de una rama sigue el patrón
  `https://<proyecto>-git-<rama>-<team>.vercel.app`. **Tiene protección
  SSO de Vercel activada** — un agente sin sesión de navegador no puede
  cargar la URL (redirige a `vercel.com/sso-api`). Verificación visual la
  hace un humano; un agente puede verificar el build (`npm run build`)
  y el estado del deploy vía `gh api repos/kayaosv/AlcosaProduct/commits/<sha>/status`.
- Si `npm run build` falla con `Cannot find native binding` en
  `@tailwindcss/oxide`: es el bug conocido de npm con dependencias
  opcionales (`npm/cli#4828`). Fix: `rm -rf node_modules package-lock.json && npm install`.
- **Evitar GSAP en el `CartDrawer` y, en general, desconfiar de
  `useGSAP({ dependencies })` para toggles de UI** (abrir/cerrar un
  panel, drawer, modal). Se intentaron dos variantes animadas (useGSAP
  con dependencias, y luego un `useEffect` plano con `gsap.to` — ambas
  técnicamente más correctas que la original) y **ambas fallaron de
  forma intermitente en el dispositivo real del usuario** — el panel a
  veces no llegaba a mostrarse. Decisión explícita del cliente: dejar
  `CartDrawer.jsx` sin animación (render condicional simple) de forma
  **definitiva**. No reintroducir motion ahí sin pedirlo explícitamente.
  Si aparece un síntoma parecido en otro componente (`MenuOverlay` usa
  el mismo patrón `useGSAP({ dependencies })` y no se ha auditado),
  sospechar primero de esto, pero considerar quitar la animación en vez
  de perseguir un fix — para UI funcional crítica, este proyecto prioriza
  fiabilidad sobre motion. **Confirmado un segundo caso real**: la ficha
  de producto (`Product.jsx`) tenía el mismo patrón (`useGSAP({ scope,
  dependencies: [loading, product?.id] })`) animando con `tl.from(...)`
  (arranca en `opacity:0`) el título, el precio, el selector de
  variantes y el botón "Agregar al carrito" — el usuario reportó no ver
  ni el botón ni las variantes en su tablet, coincidiendo con el tween
  quedando revertido/parado en su estado inicial. Se quitó esa animación
  por completo (sin sustituto) — mismo criterio que `CartDrawer.jsx`.
  `OrderDetail.jsx` (admin) usa un `useGSAP` parecido gateado por
  `loading` y **no se ha auditado todavía** — vigilar si aparece un
  síntoma similar ahí.

## Estado y hallazgos (auditoría 2026-07)

Ver `supabase/AUDIT-2026-07.md` para el detalle de base de datos.

**Ya arreglado:**
- Checkout público estaba roto en producción (RLS solo admin-only en
  `orders`/`order_items`, ningún pedido anónimo se guardaba). Ahora usa
  `create_order()` (RPC, `SECURITY DEFINER`) que valida stock/`is_active`,
  bloquea la fila del producto (`FOR UPDATE`) y descuenta stock atómicamente.
- `schema.sql` reconciliado con columnas/tablas que ya existían en
  producción sin documentar (`product_variants`, `axis_config`, `images`,
  `axis_values`).
- Carrito antes solo accesible abriendo el menú hamburguesa completo —
  ahora hay un ícono de carrito persistente en el nav, con banner sólido
  (blur + sombra) que aparece al hacer scroll para que nunca se pierda
  contra el fondo.
- El panel lateral del carrito no se abría — se dejó sin animación de
  forma definitiva (ver nota de GSAP arriba). Confirmado visualmente por
  el usuario.
- Catálogo (`ProductCard`) no tenía botón de añadir rápido — ahora lo
  tiene, visible en hover (desktop) y siempre visible en touch (`@media
  (hover: none)`).
- Ficha de producto: el botón "Agregar al carrito" quedaba fuera de
  vista sin scroll en tablet/móvil o en ventanas de escritorio anchas —
  ahora es una barra fija al fondo siempre, sin depender de ningún
  breakpoint.
- Grid del catálogo tenía un breakpoint asimétrico (`1fr 1.5fr 1fr`)
  pensado para desktop que se veía sobredimensionado en tablets; ahora
  tiene un breakpoint dedicado (900px / 1180px) con columnas parejas.
- Best Sellers: el link "Ver en tienda" usaba `?categoria=` pero
  `Catalog.jsx` lee `?cat=` — ningún card llevaba a su categoría real.
  Corregido. (Nota: los 4 productos de Best Sellers siguen siendo
  placeholder hardcodeado en `src/config/bestSellers.js`, no vienen de
  Supabase — decisión explícita del cliente: cuando suban catálogo real,
  ese slot debe enlazar a una máquina de vapear de precio medio para
  impulsar su venta, no a los 4 genéricos actuales.)
- **Selector de variantes en `Product.jsx`** — productos con variantes
  (sales, longfill, vapers, desechables, resistencia, merchandising)
  ahora muestran chips seleccionables (sabor/mg/Ω/volumen/color); precio
  y stock mostrados se recalculan según la variante elegida. `create_order()`
  se extendió (`supabase/variant-checkout.sql`) para validar y descontar
  el stock de la **variante**, no del producto base — importante porque
  el admin oculta precio/stock del producto cuando tiene variantes, así
  que ese stock solo vive en `product_variants.stock`. El carrito ahora
  identifica líneas por `productId` + `variantId` (antes solo `productId`,
  lo que habría colisionado dos variantes distintas en una fila).
  Limitación conocida: el botón de añadir rápido en `ProductCard.jsx`
  (catálogo) sigue sin variante — añade "a ciegas" sin elegir una,
  porque hacerlo bien requeriría cargar variantes por card en el grid.

- **Motor de sugerencias por familia de producto** — `src/config/crossSell.js`
  define "grupos de receta": categorías que se sugieren entre sí
  (todos-contra-todos), no una relación de una sola vía. Grupo DIY:
  `longfill`, `minilongfill`, `alquimia` (base neutra + nicokit),
  `vapers`, `resistencia` — un aroma concentrado sin base+nicotina no es
  líquido vapeable, y ese líquido sin vaporizador+resistencia no sirve de
  nada, así que añadir cualquiera de las 5 sugiere las otras 4. Grupo
  listo-para-vapear: `sales-de-nicotina`, `vapers`, `resistencia` (el
  líquido de sales ya viene mezclado, no necesita Alquimia). Es el único
  archivo que hace falta tocar para afinar las reglas de negocio. El hook
  `useSuggestedProducts` calcula, a partir de las categorías ya presentes en
  el carrito, qué categorías complementarias faltan, y trae 1 producto activo
  y con stock real por categoría (excluyendo lo que ya está en el carrito).
  Se muestra como "también te puede interesar" en `CartDrawer.jsx`
  (`SuggestedProducts.jsx`). **Importante**: el chequeo de stock consulta
  `product_variants` aparte de `products.stock` (mismo motivo que el
  checkout de variantes arriba — `products.stock` es 0 cuando el producto
  tiene variantes), así que un producto sugerido nunca aparece "en stock"
  por error. Los productos con variantes se sugieren como link a la ficha
  ("Ver →") en vez de quick-add, para no repetir la limitación de
  `ProductCard.jsx` (añadir sin elegir variante). Las líneas del carrito
  ahora llevan `categorySlug` (además de `productId`/`variantId`) para que
  el motor sepa qué hay dentro; carritos guardados antes de este cambio no
  lo tienen y simplemente no disparan sugerencias hasta que se añada algo
  nuevo — no hace falta migración.

- **Ficha de producto sin botón/variantes visibles** — causado por la
  animación de reveal con `useGSAP({ dependencies })` (ver nota de GSAP
  arriba); se quitó de `Product.jsx`. Precio, specs, variantes y el botón
  de compra ahora se renderizan sin animación de entrada, igual que el
  carrito.
- **Carrusel "también te puede interesar" en la ficha de producto** —
  `src/components/dom/ProductSuggestions.jsx`, reutiliza
  `useSuggestedProducts` (el mismo hook del carrito) pasándole un
  carrito sintético de un solo producto (`[{ productId, categorySlug }]`),
  así que usa exactamente el mismo mapa de `crossSell.js` y el mismo
  chequeo de stock real por variante. Fila horizontal con scroll nativo,
  sin librería de carrusel nueva.
- **Sidebar del admin no se retraía en tablet** — el bloque colapsable
  (hamburguesa/overlay/`transform`) en `src/styles/admin.css` solo
  existía en `@media (max-width: 767px)`; una tablet de ~10" cae por
  encima de ese ancho en ambas orientaciones y se quedaba con el sidebar
  fijo de escritorio sin forma de retraerlo. Ahora ese mismo bloque
  también vive en `@media (max-width: 1024px)` (duplicado, no
  reescrito — mismo mecanismo, más rango). Las reglas de layout
  específicas de móvil (`.dash-row`, `.editor-layout`, etc.) se quedaron
  en 767px a propósito, sin tocar.
- **`OrderDetail.jsx` no mostraba qué variante pidió el cliente** —
  `order_items.variant_label` se guarda desde `variant-checkout.sql`
  pero la vista de admin nunca lo pintaba ni lo traía en el `select`
  (`useAdminOrders.js`, `DETAIL_SELECT`). Sin esto, el empleado que
  prepara el pedido no podía saber qué sabor/volumen/color/Ω recoger si
  el producto tiene variantes. Corregido en ambos archivos.
- **`StockScanner.jsx` no tocaba el stock real de productos con
  variantes** — escribía siempre en `products.stock`, que queda en 0/
  sin uso en cuanto un producto tiene variantes (el stock real vive en
  `product_variants.stock`). `product_variants` no tiene columna de
  barcode propia, así que no hay forma de identificar la variante solo
  con el código escaneado. Decisión con el cliente: tras encontrar el
  producto, si tiene variantes se pide elegir una (chips) antes de
  habilitar los botones +/-; con variante elegida, el ajuste escribe en
  `product_variants.stock` y el historial de sesión guarda también qué
  variante se movió. Sin variantes, comportamiento idéntico a antes.
- **Motor de sugerencias sin lógica de "receta" completa** —
  `crossSell.js` solo mapeaba `longfill`/`minilongfill` → `alquimia`
  (base+nicokit), nunca hacia el vaporizador. Rediseñado como grupos de
  receta todos-contra-todos (ver arriba) — cliente lo confirmó
  explícitamente antes de implementarlo.
- **Ningún aviso cuando entra un pedido** — el vendedor tenía que entrar
  a `/admin` sin ningún disparador. `supabase/telegram-order-notify.sql`
  añade un trigger `AFTER INSERT ON orders` que manda un mensaje de
  Telegram. Blindado a propósito: si los secretos de Vault
  (`telegram_bot_token`, `telegram_chat_id`) no existen o Telegram falla,
  el trigger no hace nada — nunca puede romper un checkout real
  (`exception when others then null`). La lista de pedidos pendientes en
  sí ya existía (`Orders.jsx` con pestañas por estado + contador en el
  sidebar) — lo único que faltaba era el aviso.

- **Dashboard de stock estilo Catinfog (2026-07-15)**: el cliente evaluó
  migrar el inventario directamente desde Catinfog (su TPV físico actual,
  que exporta CSV) pero decidió NO hacerlo — el CSV llega sin slug SEO,
  sin metadatos y sin asociación al motor de cross-sell (`crossSell.js`),
  así que habría que reprocesar todo a mano igual. Los productos se
  siguen cargando uno a uno desde `/admin/products/new` (que ya genera
  slug/SEO/variantes correctamente). En su lugar se construyó un
  dashboard de stock propio, con el objetivo explícito de independencia
  total de Catinfog:
  - `useAdminProducts.js` trae `product_variants(stock)` y calcula
    `effectiveStock` (suma de variantes si tiene, si no `products.stock`)
    — antes `Products.jsx` usaba `products.stock` crudo, que queda en 0/
    sin uso en productos con variantes (mismo motivo ya documentado en el
    checkout y la ficha pública). Umbral de stock bajo en
    `src/config/stock.js` (`LOW_STOCK_THRESHOLD = 5`, constante global a
    propósito, no columna por producto — decisión explícita del cliente).
    Nuevo filtro "Solo stock bajo" y contador en el subtítulo de
    `Products.jsx`.
  - Impresión de etiquetas con código de barras: `/admin/products/:id/label`
    (`ProductLabel.jsx`), enlazada desde `Products.jsx` y
    `ProductEditor.jsx`. Usa `jsbarcode` (nueva dependencia) para
    renderizar el código en un `<svg>`. Si el producto no tiene
    `barcode`, se genera un EAN-13 propio válido (`src/lib/barcode.js`,
    checksum correcto, prefijo `20-29` reservado por GS1 para uso
    interno de tienda — nunca coincide con un código real de fabricante
    ni con nada de Catinfog) — decisión explícita del cliente, ya que el
    objetivo es no depender de Catinfog para nada, ni siquiera para los
    códigos. Una etiqueta es por producto, no por variante
    (`product_variants` no tiene columna de barcode propia).
  - Resumen diario por Telegram: `supabase/telegram-daily-summary.sql`,
    activa `pg_cron` y agenda `send_daily_summary()` a las 21:00 hora
    España (`0 19 * * *` UTC — **ajustar a `0 20 * * *` en horario de
    invierno**, ver comentario en el propio archivo SQL). Reutiliza los
    mismos secretos de Vault que `telegram-order-notify.sql`
    (`telegram_bot_token`, `telegram_chat_id`), mismo blindaje
    (`exception when others then null`). Manda pedidos del día (con
    fecha calculada en `Europe/Madrid`, con DST) + lista de productos en
    stock bajo/agotado (mismo criterio de `effectiveStock` que el
    dashboard, umbral hardcodeado a 5 en la query — no está conectado a
    `LOW_STOCK_THRESHOLD` del frontend, si se cambia uno hay que cambiar
    el otro a mano).

- **Pago online con Stripe (2026-07-15)**: coexiste con la reserva
  original, no la reemplaza — decisión explícita del cliente. En
  `Checkout.jsx` hay dos botones ("Pagar online ahora" / "Reservar y
  pagar en tienda") que comparten el mismo formulario; cuál se pulsó se
  distingue via `e.nativeEvent.submitter`. Arquitectura completa en
  `supabase/stripe-checkout.sql` y `supabase/functions/`:
  - El stock **solo se descuenta cuando Stripe confirma el pago**, nunca
    antes — por eso el pedido no se crea al enviar el formulario. La
    Edge Function `create-checkout-session` revalida precio/stock reales
    (`get_checkout_line()`, sin bloqueos, nunca confía en lo que manda
    el navegador), guarda el carrito en `checkout_drafts` (evita los
    límites de tamaño de `metadata` de Stripe) y crea la Checkout
    Session. El webhook `stripe-webhook` (`verify_jwt=false`,
    autenticación propia por firma de Stripe) recién ahí llama a
    `create_paid_order()` — variante de `create_order()` que además
    marca `payment_method='stripe'`, `payment_status='paid'` y
    `stripe_session_id`. `create_order()` original sigue intacta, sin
    tocar, para el flujo de reserva.
  - Conflicto de stock al confirmar el pago (venta física simultánea,
    caso raro): el webhook reembolsa automático vía API de Stripe e
    inserta un pedido `cancelled`/`refunded` directo (sin pasar por
    `create_order`) para que el trigger de Telegram existente avise al
    vendedor.
  - Idempotencia ante reintentos de webhook de Stripe:
    `checkout_drafts.consumed_at` + `UNIQUE` en `orders.stripe_session_id`.
  - `CheckoutSuccess.jsx` (`/checkout/success`) hace polling corto sobre
    `get_order_by_session()` tras volver de Stripe, porque el webhook
    procesa async y puede tardar unos segundos en crear el pedido.
  - **FIX DE SEGURIDAD encontrado durante esta migración**: `revoke ...
    from public` en Postgres no alcanza a `anon`/`authenticated` en
    Supabase si la función nunca tuvo su `EXECUTE` implícito de PUBLIC
    revocado — `create_paid_order()` se protegió bien desde el
    principio, pero al auditar con `get_advisors()` apareció que
    `send_daily_summary()` (sección de arriba) y `notify_new_order()`
    (preexistente, del trigger de pedidos) SÍ eran ejecutables por
    cualquier visitante anónimo vía `/rest/v1/rpc/`. Ninguna se podía
    usar para robar nada, pero se corrigieron con
    `revoke execute ... from public` explícito. **Regla para cualquier
    función `SECURITY DEFINER` nueva que no deba ser pública: siempre
    incluir ese revoke en el mismo archivo que la crea**, no asumir que
    alcanza con no otorgar a `anon`/`authenticated`.
  - **No probado de punta a punta todavía** — el cliente no tenía cuenta
    de Stripe al escribir esto (ver pendiente #0 abajo). Todo el código
    está desplegado y compila, pero `STRIPE_SECRET_KEY`/
    `STRIPE_WEBHOOK_SECRET` no existen como secretos de las Edge
    Functions.
  - **Pregunta legal sin resolver, planteada al cliente pero no
    verificada**: España/UE tienen restricciones sobre venta a distancia
    de productos de vapeo con nicotina que podrían no aplicar igual al
    modelo de reserva-sin-pago pero sí activarse con cobro online real.
    No confirmar que el pago online es legal para este rubro solo
    porque el código ya está listo — verificarlo (gestor/abogado) antes
    de dar de alta la cuenta de Stripe en modo real (modo test no
    importa).

- **Stock/precio/margen variant-aware centralizado (2026-07-16)**: una
  auditoria completa del admin encontro que el bug de "stock crudo en
  vez de agregado" arreglado en Products.jsx el dia anterior seguia
  vivo en Dashboard.jsx, Categories.jsx y Wholesale.jsx — las tres
  leian products.stock/price/wholesale_price directos, que quedan en
  0/null en cuanto un producto tiene variantes (la mayoria del
  catalogo). Efecto real: Dashboard sobre-contaba "sin stock" y
  sub-contaba "valor inventario", Categorias mostraba mal "agotados"/
  "valor en stock" por categoria, y Mayorista mostraba columnas de
  margen/equivalencia/ahorro vacias para casi todo el catalogo.
  Products.jsx ademas tenia el mismo bug sin arreglar en Precio y
  Mayorista (solo se habia corregido Stock antes). Analytics.jsx era la
  unica pagina que ya lo hacia bien, con su propio hook
  useAnalyticsData.js.
  Fix: nuevo src/lib/stockPricing.js (getStock, getEffectivePrice,
  getWholesalePrice, getMarginPct, hasWholesale) como unica fuente.
  useAdminProducts.js lo usa para adjuntar effectiveStock/
  effectivePrice/effectiveWholesalePrice/marginPct/hasWholesale a cada
  producto (SELECT ampliado con product_variants(price, sale_price,
  wholesale_price, is_primary, is_active)); useAnalyticsData.js
  re-exporta desde el mismo archivo (cero cambios en Analytics.jsx). De
  paso se corrigio un bug menor propio: effectiveStock no filtraba
  variantes inactivas (is_active=false), la funcion centralizada si.
  Sin tocar todavia (pendientes de la misma auditoria, mas abajo):
  inputs de categoria solo capturan nombre (color/tipo de variante
  siguen en codigo, CATEGORY_META en productSpecs.js), sin delete/
  rename de categorias, y el rediseño del selector de estado de pedido
  al estilo Perfumito14 — el estado actual ademas se llama "Enviado"
  para una tienda que no envia nada, solo recoge en local.

**Pendiente (por prioridad):**
0. **Bloqueante para probar el pago online**: el cliente no tiene cuenta
   de Stripe todavía. Pasos: crear cuenta en stripe.com para SUB
   OHM-TECHNOLOGIES SL (pide NIF y cuenta bancaria — el NIF sigue sin
   confirmar, ver ítem 8 más abajo), copiar la clave secreta (modo test
   primero) y configurarla como secreto `STRIPE_SECRET_KEY` de las Edge
   Functions, crear un webhook endpoint en el dashboard de Stripe
   apuntando a la función `stripe-webhook` desplegada y copiar su
   secreto de firma como `STRIPE_WEBHOOK_SECRET`. Sin esto, los botones
   de "Pagar online ahora" fallan.
1. Best Sellers conectado a productos reales (`is_featured=true`) en vez
   del placeholder — pendiente hasta que el cliente suba catálogo real;
   el slot destacado debe apuntar a una máquina de precio medio.
2. Quick-add de `ProductCard.jsx` sin variante elegida (ver limitación
   arriba) — evaluar si vale la pena el costo de fetch por card.
3. Limpieza de imágenes huérfanas en Storage al borrar un producto.
4. ~~`Products.jsx` (admin) no refleja el stock agregado de variantes~~
   — **resuelto 2026-07-15**, ver "Dashboard de stock estilo Catinfog"
   arriba.
5. Bucket `product-images` permite listar todos los archivos públicamente
   (advertencia menor del linter de Supabase, no crítico).
6. El motor de sugerencias solo tiene 2 productos reales para ofrecer en
   `alquimia` (ambos nicokits) — no hay "base neutra" cargada todavía en
   el catálogo; cuando el cliente la suba, aparecerá sola (no requiere
   cambio de código).
7. Trigger de Telegram (aviso por pedido) Y el resumen diario
   (`send_daily_summary`, cron 21:00) desplegados pero **inactivos hasta
   que se carguen los dos secretos de Vault**
   (`telegram_bot_token`, `telegram_chat_id`) — instrucciones en
   `supabase/telegram-order-notify.sql`. Recordar ajustar el cron del
   resumen diario a `0 20 * * *` cuando empiece el horario de invierno
   (ver `supabase/telegram-daily-summary.sql`).
8. **Cumplimiento legal (2026-07-13)**: añadidas páginas de Aviso Legal,
   Política de Privacidad y Política de Cookies (`src/pages/AvisoLegal.jsx`,
   `Privacidad.jsx`, `Cookies.jsx`, rutas `/aviso-legal`, `/privacidad`,
   `/cookies`), enlazadas desde `Footer.jsx`. Checkout ahora exige aceptar
   la Política de Privacidad y confirmar mayoría de edad (checkboxes
   `required`) antes de poder enviar el pedido. Auditado antes de escribir:
   cero trackers de terceros en el código, único almacenamiento en cliente
   es el carrito (`localStorage`, clave `vapers-cart`, estrictamente
   necesario) — por eso no se añadió banner de cookies, no es obligatorio.
   **Pendiente**: el NIF/CIF y el email de contacto del titular
   (SUB OHM-TECHNOLOGIES SL) están como `[COMPLETAR]` en las tres páginas
   — sustituir en cuanto el cliente los facilite (buscar
   `[COMPLETAR` en `src/pages/`). Los demás datos (razón social, domicilio,
   teléfono, inscripción en el Registro Mercantil de Sevilla) se tomaron
   de la web actual en producción (vapersalcosa19.com) — su política de
   cookies antigua no se reutilizó a propósito porque describe cookies de
   analítica/publicidad que este sitio no usa y basa el consentimiento en
   "navegar implica aceptar", un criterio ya desactualizado ante la AEPD.
9. **Inputs de categoría incompletos** (hallazgo auditoría 2026-07-16):
   `Categories.jsx` → "+ Nueva categoría" solo captura el nombre. El
   color, `kind` (qué campos de `details` usa `ProductEditor.jsx`) y
   `variantType` (qué tipo de variante acepta: sabor/nicotina/color/Ω)
   viven hardcodeados en `CATEGORY_META` (`src/lib/productSpecs.js`),
   no en la base de datos. Una categoría creada desde el admin hoy
   queda "coja" — sin campos especiales, sin poder agregarle variantes
   — hasta que alguien la agregue a mano en `CATEGORY_META` y
   redespliegue. Tampoco hay delete/rename de categorías desde el
   admin, solo crear y reordenar. Ver propuesta de solución discutida
   con el cliente el 2026-07-16 (dos caminos: mover `CATEGORY_META` a
   una columna JSONB en `categories` con un formulario completo en el
   admin, o mantenerlo en código pero agregar validación/aviso cuando
   se crea una categoría sin entrada correspondiente).
10. **Selector de estado de pedido — rediseño pendiente** (hallazgo
    auditoría 2026-07-16, referencia: dashboard de pedidos de
    Perfumito14, `app/admin/pedidos/page.tsx`): hoy
    `OrderDetail.jsx` avanza el estado de a un paso ("→ Marcar como
    Preparando/Enviado/Entregado") en vez de un selector directo a
    cualquier estado. Perfumito14 usa un `<select>` nativo disfrazado
    de pill de color (punto + texto, sin flecha nativa) con semántica
    de urgencia por color (rojo=requiere acción ya, ámbar=en
    preparación, azul=en tránsito, verde=completo, gris=fuera de
    flujo) y update optimista con rollback si falla. Además, el estado
    `shipped`/"Enviado" no tiene sentido para Alcosa — la tienda no
    envía nada, solo se recoge en local; renombrar a algo como "Listo
    para recoger" antes o al mismo tiempo que el rediseño visual.
11. **`setPrimary` en `useProductVariants.js` no es atómico**: hace dos
    updates seguidos (desmarcar todas, marcar la nueva) — si el segundo
    falla a mitad de camino, el producto queda sin variante principal.
    Riesgo bajo (falla de red muy puntual), no urgente.
12. `checkout-policies.sql` es un archivo SQL superado (dice "NO
    aplicar" en su propio comentario) que ya no está activo en la base
    real (verificado 2026-07-16 vía `pg_policies` — `orders`/
    `order_items` solo tienen políticas `is_admin()`) — candidato a
    archivar o borrar del repo para no confundir a futuro.

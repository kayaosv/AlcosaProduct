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
  Color de categoria: **resuelto 2026-07-16**, ver mas abajo. Kind/
  variantType de categoria siguen en codigo a proposito (decision
  tomada, ver pendiente #9). Selector de pedidos: **resuelto
  2026-07-16**, ver mas abajo.

- **Categorias: color/borrar/renombrar + selector de pedidos estilo
  Perfumito14 (2026-07-16, resto de la auditoria del mismo dia)**:
  - `categories.color` (columna nueva) — `categoryColor(slug, dbColor)`
    en `productSpecs.js` prioriza el color de la categoria sobre
    `CATEGORY_META`, con fallback a gris. `useCategories.js` gana
    `create`/`update`/`remove` (antes `Categories.jsx` llamaba a
    `supabase.from(...)` directo y refrescaba con
    `window.location.reload()`). Renombrar una categoria solo cambia
    `name`, nunca `slug` — el slug es la clave de `CATEGORY_META` y de
    las URLs `?cat=slug`, cambiarlo desconectaria la categoria de sus
    campos especiales en silencio. Borrar categoria bloqueado en la UI
    si tiene productos asociados (la FK es `ON DELETE SET NULL`, no
    lo impide sola).
  - `OrderStatusSelect` (`src/components/dom/admin/`): select nativo
    disfrazado de pill de color (punto + flecha propia, sin la del
    navegador), salta directo a cualquier estado en un solo cambio, con
    update optimista y rollback si falla la escritura — mismo patron
    que el dashboard de pedidos de Perfumito14
    (`app/admin/pedidos/page.tsx`). Reemplaza el badge estatico +
    boton "→ Marcar como X" de `OrderDetail.jsx`, y se agrega tambien
    inline en cada fila de `Orders.jsx` (antes solo se podia cambiar
    el estado abriendo el detalle). Elegir "Cancelado" pide
    confirmacion (`window.confirm`) antes de aplicar, mismo criterio
    que ya tenia el boton dedicado. El estado `shipped`/"Enviado" se
    renombro a `ready`/"Listo para recoger" — no tiene sentido para
    una tienda que no envia nada — **sin migracion de datos** porque
    no habia pedidos reales en la base en ese momento; si esto se lee
    despues de que existan pedidos reales con status `shipped`, hace
    falta un `update orders set status='ready' where status='shipped'`
    antes de desplegar.
  - Bug propio encontrado y corregido en el camino: `Dashboard.jsx`
    (commit `216e6e1`, mismo dia) quedo llamando a una funcion
    `marginPct(p)` ya borrada y leyendo `p.wholesale_price` crudo en
    `marginByCategory` — se escapo del build porque Vite no chequea
    variables indefinidas en JS. Sirve de recordatorio: **correr la
    app real (o al menos revisar con grep cada función/variable que se
    borra) después de refactors de este tipo, el build pasando no es
    suficiente garantía.**

- **Deploy de Vercel roto durante varios commits sin detectarlo
  (2026-07-16)**: el repo tenía DOS lockfiles — `package-lock.json`
  (activo, el que usa `npm run build` local) y `pnpm-lock.yaml`
  (commiteado una única vez en el commit inicial de mayo, nunca más
  tocado). Vercel prioriza `pnpm-lock.yaml` cuando existe y corre
  `pnpm install --frozen-lockfile`, que falla apenas ese lockfile
  queda desactualizado respecto a `package.json`. Eso pasó en cuanto
  se agregó la primera dependencia nueva de esta sesión (`jsbarcode`,
  commit `868ed17`, impresión de etiquetas) — **el deploy de Vercel
  quedó roto desde ese commit hasta `600660c` sin que se detectara**,
  porque la verificación de cada paso era `npm run build` local (que
  ni siquiera toca `pnpm-lock.yaml`), nunca el estado real del deploy
  (`gh api repos/.../commits/<sha>/status`). Fix: se borraron
  `pnpm-lock.yaml` y `pnpm-workspace.yaml` (este último tampoco se
  usaba de verdad — ni define `packages:`, solo una config de
  `allowBuilds` — no es un monorepo real). **Regla para instalar
  cualquier dependencia nueva de aquí en adelante: además de
  `npm run build` local, chequear
  `gh api repos/kayaosv/AlcosaProduct/commits/<sha>/status` después de
  pushear**, no asumir que un build local exitoso implica que Vercel
  también lo hará — son entornos de instalación distintos.

- **Auditoría de atributos/variantes por categoría vs. proveedores reales
  (2026-07-16)**: a pedido del cliente, se comparó el modelo de
  categorías/variantes contra sinhumo.net (cadena grande de Sevilla,
  referencia de competencia directa) y contra los datos ya cargados en
  la base real (317 productos, 204 variantes) para verificar que cada
  categoría permite cargar un producto con todas sus variantes en una
  sola subida, sin duplicar el producto por sabor/ml/ohmio.
  - **Confirmado que el mecanismo ya funciona bien** en `resistencia`
    (ohmios como variante, ej. "Vaporesso GTX Coil" con 7 variantes de
    ohmios — coincide exacto con el patrón de sinhumo.net de vender
    una caja con varios ohmios seleccionables), `sales-de-nicotina`
    (mg como variante) y `longfill`/`minilongfill` (ml de botella como
    variante, cuando aplica — la mayoría de esos 267 productos son de
    un solo tamaño, lo cual probablemente refleja que así los vende el
    proveedor, no una carga incompleta).
  - **Bug real encontrado con evidencia de datos**: `vapers-desechables`
    tenía `variantType: 'color'`, pero el único producto cargado
    (10 variantes) usa esos slots para **sabores**
    (`Mango Slushy`, `Piña Hielo`, etc.) — el admin veía un selector de
    color para escribir ahí un sabor. Corregido a `variantType: 'flavor'`.
    Al investigar el fix se encontró un segundo problema: `'flavor'`
    como `variantType` estaba pisado por `alquimia`, que lo usaba para
    activar el compositor de ejes (`AlquimiaComposer`, volumen/ratio/
    nicotina) — cambiar `vapers-desechables` a `'flavor'` sin más
    habría mostrado por error ese compositor en vez de un campo de
    texto simple. Se separó: `alquimia` pasa a `variantType: 'recipe'`
    (nueva entrada en `VARIANT_META` y `VARIANT_LABELS`,
    `src/lib/productSpecs.js` +
    `src/pages/admin/ProductEditor.jsx`), dejando `'flavor'` libre y
    correctamente aislado para sabores simples (desechables, y
    cualquier categoría futura que solo necesite un nombre de sabor sin
    compositor ni color).
  - **Corrección propia sobre la marcha**: se había planteado que
    "Alquimia" mezclaba aromas + bases + nicokits — el cliente corrigió
    que no es así: `longfill`/`minilongfill` (los aromas) ya son
    categorías separadas desde antes, `alquimia` es únicamente para
    bases neutras/nicokits/similares, para lo cual el compositor de
    volumen/ratio/nicotina encaja bien tal cual está. No se tocó nada
    de esa categoría.
  - Pendiente, no bloqueante: las resistencias no capturan el rango de
    potencia recomendado (W) como campo estructurado, solo el ohmio —
    los proveedores reales sí lo muestran, pero es información
    secundaria que hoy puede ir en la descripción libre si hace falta.

- **Regresión propia corregida el mismo día**: al arreglar
  `vapers-desechables` (arriba) se detectó que el cambio de
  `variantType: 'color'` a `'flavor'` había apagado sin querer la foto
  por variante — `VARIANT_META.color` tenía `hasImage: true` (por eso
  antes, aunque mal etiquetado como "color", sí se podía subir una foto
  distinta por sabor), y `VARIANT_META.flavor` tenía `hasImage: false`.
  Corregido: `flavor` ahora también tiene `hasImage: true`. De paso se
  subió `MAX_COLOR_IMAGES` de 4 a 12 — ese tope estaba pensado para
  pocas variantes de color de un dispositivo, pero un desechable real
  puede tener 10+ sabores (el único producto cargado en esa categoría
  ya tiene 10). También se agregó la sección "Descripción del
  producto" (textarea libre) a `kind === 'desechables'` — antes solo
  la tenían `accesorios`/`alquimia`; desechables solo tenía el campo
  corto "Sabor" (pensado para el nombre, no para texto descriptivo
  largo).

- **Envío manual vía WhatsApp para pedidos pagados online (2026-07-16)**:
  tras investigar verificación de edad (decálogo AEPD, ver más abajo) y
  confirmar que un transportista externo (Correos/SEUR/MRW) no
  verifica edad al entregar — y que hay señales mixtas sobre si
  aceptan siquiera productos de vapeo — se decidió que el envío, por
  ahora, se organiza **a mano por el dueño con su propio repartidor**
  (no un transportista externo), justamente porque así puede verificar
  el DNI en persona al entregar, igual que en el mostrador. No hay
  infraestructura de envío automatizada (sin cálculo de zonas/costes,
  sin integración de transportista) — es deliberado, no una limitación
  a resolver todavía.
  En `CheckoutSuccess.jsx` (solo pedidos pagados online, no reserva-en-
  tienda) hay un botón "Quiero envío — avisar por WhatsApp" que arma un
  mensaje con `wa.me` (sin API de WhatsApp Business, solo el deep link
  público) hacia el +34682725780, con número de pedido, cliente,
  teléfono, productos, total y las notas del checkout (donde el
  cliente puede escribir su dirección si quiere). `get_order_by_session()`
  se amplió (drop + recreate, cambia el tipo de retorno) para incluir
  `customer_phone`, `notes` y `items` (agregado vía `jsonb_agg` desde
  `order_items`) — antes solo devolvía id/total/nombre/fecha.
  **Investigación de verificación de edad (mismo día)**: el decálogo de
  la AEPD (Diciembre 2023, documento oficial) dice textualmente que los
  sistemas basados en autodeclaración del propio usuario "solo han
  servido para dar garantías jurídicas puramente formales" — ni un
  checkbox ni pedir que el cliente escriba su DNI/NIE cuentan como
  "verificación cierta" (Principio 5). Pedir foto de DNI o usar un
  servicio externo de verificación va además en contra del principio
  de minimización de datos del mismo decálogo. Conclusión aplicada:
  la única verificación real sigue siendo el DNI físico revisado en
  persona (mostrador o repartidor propio) — no vale la pena invertir en
  verificación online más "seria", no mejora la cobertura legal.

**Pendiente (por prioridad):**
0. **Bloqueante para probar el pago online**: el cliente está creando la
   cuenta de Stripe (en curso, 2026-07-16). Pasos: copiar la clave
   secreta (modo test primero) y configurarla como secreto
   `STRIPE_SECRET_KEY` de las Edge Functions, crear un webhook endpoint
   en el dashboard de Stripe apuntando a la función `stripe-webhook`
   desplegada y copiar su secreto de firma como `STRIPE_WEBHOOK_SECRET`.
   Sin esto, los botones de "Pagar online ahora" fallan.
0.5. ~~Figura legal real: autónomo, no SL~~ — **resuelto 2026-07-16**.
   `AvisoLegal.jsx`/`Privacidad.jsx` ya no dicen "SUB OHM-TECHNOLOGIES
   SL" ni "Inscripción registral: Registro Mercantil de Sevilla"
   (confirmado con el Art. 19 del Código de Comercio, BOE, que la
   inscripción es *potestativa* para autónomos salvo naviero — no
   aplica aquí). Titular: **"Vapers Alcosa"** (el cliente decidió
   explícitamente no publicar el nombre personal del autónomo, solo
   la marca) — **ojo**: el Art. 10.a LSSI-CE (BOE) pide "nombre o
   denominación social" del titular, y para una persona física eso es
   en principio su nombre real, no solo una marca comercial; puede que
   esto no cubra el 100% del requisito formal, señalado al cliente,
   decisión suya mantenerlo así — revisar con gestoría si se cuestiona.
   NIF: **30269335R** (checksum de DNI verificado correcto: 30269335
   mod 23 = 1 → letra R). Sigue faltando: email de contacto
   (`[COMPLETAR: email]` en ambas páginas). También corregido en el
   mismo commit: el texto de `AvisoLegal.jsx` que decía "No se procesan
   pagos online" (ya no era cierto desde que existe Stripe) ahora
   menciona ambas modalidades de pago y aclara que no hay envío a
   domicilio automatizado (coherente con el flujo manual por WhatsApp).
   **Sigue sin resolver**: `Privacidad.jsx` sección 04, el
   `[COMPLETAR: confirmar transferencia internacional de datos]` —
   ahora aplica de verdad porque Stripe es una empresa de EEUU y
   procesará datos de pago en cuanto se active la cuenta.
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
9. **Inputs de categoría — parcialmente resuelto 2026-07-16**: color
   ✅ (columna `categories.color`, editable desde `Categories.jsx`) y
   delete/rename ✅. Sigue pendiente a propósito, por decisión
   consciente (no por olvido): `kind` (qué campos de `details` usa
   `ProductEditor.jsx`) y `variantType` (qué tipo de variante acepta)
   siguen hardcodeados en `CATEGORY_META` (`src/lib/productSpecs.js`)
   — son literalmente pantallas de formulario distintas por categoría,
   no datos: moverlas a la base de datos implicaría un sistema de
   formularios dinámicos, proyecto grande para 11 categorías que
   probablemente ya cubren casi todo. Una categoría creada desde el
   admin sin entrada en `CATEGORY_META` queda sin campos especiales ni
   variantes hasta que se agregue a mano en código.
10. ~~Selector de estado de pedido — rediseño~~ — **resuelto
    2026-07-16**, ver `OrderStatusSelect` más arriba.
11. ~~`setPrimary` en `useProductVariants.js` no era atómico~~ —
    **resuelto 2026-07-16** (se invirtió el orden de los dos updates).
12. `checkout-policies.sql` es un archivo SQL superado (dice "NO
    aplicar" en su propio comentario) que ya no está activo en la base
    real (verificado 2026-07-16 vía `pg_policies` — `orders`/
    `order_items` solo tienen políticas `is_admin()`) — candidato a
    archivar o borrar del repo para no confundir a futuro.

# Vapers Alcosa — contexto del proyecto

E-commerce de vapeo (Sevilla, Parque Alcosa). Vite + React + Three.js
(catálogo con 3D) + Supabase (Postgres/Auth/Storage) + Vercel.

**Modelo de negocio**: reserva online, pago y recogida en tienda física.
No hay pasarela de pago — el checkout crea un pedido "pendiente" y el
cliente lo recoge y paga en local. Confirmación de disponibilidad hoy es
manual, por Instagram.

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

**Pendiente (por prioridad):**
1. Best Sellers conectado a productos reales (`is_featured=true`) en vez
   del placeholder — pendiente hasta que el cliente suba catálogo real;
   el slot destacado debe apuntar a una máquina de precio medio.
2. Quick-add de `ProductCard.jsx` sin variante elegida (ver limitación
   arriba) — evaluar si vale la pena el costo de fetch por card.
3. Limpieza de imágenes huérfanas en Storage al borrar un producto.
4. `Products.jsx` (admin) no refleja el stock agregado de variantes,
   solo el del producto base.
5. Bucket `product-images` permite listar todos los archivos públicamente
   (advertencia menor del linter de Supabase, no crítico).
6. El motor de sugerencias solo tiene 2 productos reales para ofrecer en
   `alquimia` (ambos nicokits) — no hay "base neutra" cargada todavía en
   el catálogo; cuando el cliente la suba, aparecerá sola (no requiere
   cambio de código).

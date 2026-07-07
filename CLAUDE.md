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
  localStorage) y `useAppStore` (UI: carrito abierto, tema, loader).
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
- **Cuidado con `useGSAP({ dependencies })` para toggles de UI** (abrir/
  cerrar un panel, drawer, modal): revierte las tweens del run anterior
  en cada cambio de dependencia, lo que puede dejar un elemento animado
  "atascado" a mitad de camino mientras otro (ej. un backdrop) sí anima
  bien — muy difícil de notar sin probarlo en vivo. Para toggles usar un
  `useEffect(() => { gsap.to(...) }, [dep])` plano en su lugar. Bug real
  encontrado y corregido en `CartDrawer.jsx` — si aparece un síntoma
  parecido en otro componente (`MenuOverlay` usa el mismo patrón y no se
  ha auditado), sospechar de esto primero.

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
- El panel lateral del carrito (`CartDrawer`) no se abría — bug real de
  `useGSAP({ dependencies })` revirtiendo la animación (ver nota arriba).
  Corregido con `useEffect` plano; confirmado visualmente por el usuario.
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

**Pendiente (por prioridad):**
1. Selector de variantes visible en `Product.jsx` — el admin ya crea
   variantes (sabor, mg, Ω, volumen) pero el storefront nunca las
   muestra ni permite elegirlas.
2. Motor de sugerencias por familia de producto (ej. longfill → sugerir
   base + nicokit al añadir al carrito). No existe ningún mecanismo hoy;
   tampoco lo tiene sinhumo.net (competencia) — sería diferenciador real.
3. Best Sellers conectado a productos reales (`is_featured=true`) en vez
   del placeholder — pendiente hasta que el cliente suba catálogo real;
   el slot destacado debe apuntar a una máquina de precio medio.
4. Limpieza de imágenes huérfanas en Storage al borrar un producto.
5. `Products.jsx` (admin) no refleja el stock agregado de variantes,
   solo el del producto base.
6. Bucket `product-images` permite listar todos los archivos públicamente
   (advertencia menor del linter de Supabase, no crítico).

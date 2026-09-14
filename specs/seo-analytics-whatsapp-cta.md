# CTA flotante de WhatsApp + SEO orgánico + Analytics/Ads

## Objetivo

Puntos 5 y 6 del pedido del cliente (2026-09-15): un botón flotante en
toda la web pública que abra WhatsApp con un mensaje fijo de consulta
(sin datos de carrito), y que el sitio tenga SEO orgánico básico
(meta tags dinámicos, Open Graph, JSON-LD, sitemap.xml) más un
mecanismo para conectar Google Analytics 4 / Meta Pixel para Ads.

## Criterios de aceptación

- [x] Botón flotante de WhatsApp visible en toda página pública (no en
      `/admin`), mensaje fijo "Hola, quiero hacer una consulta 🙂", sin
      datos de carrito/pedido. Se oculta en `/pago/:draftId` (ya tiene su
      propio CTA de WhatsApp con el carrito, no competir con ese).
      Reutiliza el mismo número que ya usa el flujo de pago
      (`shop_settings.payment_whatsapp_phone`) — un solo lugar para
      cambiarlo.
- [x] `document.title` + meta description dinámicos por página (Home,
      Catálogo con nombre de categoría, ficha de Producto con nombre real).
- [x] Open Graph (`og:title`, `og:description`, `og:image`, `og:type`,
      `og:url`) + Twitter Card por página, con fallback estático fuerte en
      `index.html` para bots que no ejecutan JS.
- [x] JSON-LD `schema.org/Product` en la ficha de producto (nombre, marca,
      imagen, precio, disponibilidad).
- [x] `sitemap.xml` generado en cada build (`postbuild`, lee productos/
      categorías reales de Supabase) + `robots.txt` (permite indexar,
      bloquea `/admin`/`/cart`/`/checkout`/`/pago`).
- [x] Páginas transaccionales (`/cart`, `/checkout`, `/pago/:draftId`)
      marcadas `noindex`.
- [x] Mecanismo para cargar GA4/Meta Pixel sin tocar código — IDs
      editables desde `/admin/settings`, inertes (no cargan ningún script)
      hasta que el cliente los complete.
- [ ] **IDs reales de GA4/Meta Pixel** — el cliente los tiene que pasar
      (o decidir crear cuentas nuevas); no se inventó ningún ID de prueba.

## Fuera de alcance

- **Vistas previas de enlace por producto en WhatsApp/Facebook/Twitter**:
  el sitio es una SPA cliente-only (Vite, sin SSR/prerender). Esos bots
  leen el HTML crudo sin ejecutar JS, así que **siempre** ven los
  defaults estáticos de `index.html` (foto/nombre genéricos de la
  tienda), nunca la foto/precio de un producto específico compartido.
  Arreglar esto del todo requiere pre-renderizado o una función
  serverless que detecte bots y sirva HTML estático por URL — no
  encarado en esta tanda, es una decisión de arquitectura más grande.
  Googlebot sí ejecuta JS, así que el indexado/rich-results de Google no
  tiene este problema.
- **Imagen de marca para Open Graph** (1200×630, la que se usa hoy es el
  favicon SVG): no existe un gráfico así en el repo — si se quiere una
  mejor tarjeta de vista previa para Home/Catálogo, hace falta diseñarla
  (`ui-ux-designer` o el cliente la provee).
- **Crear las cuentas de GA4/Meta Pixel**: solo se construyó el
  mecanismo de carga condicional, no las cuentas en sí.

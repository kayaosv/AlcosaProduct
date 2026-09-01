# STATUS

Última actualización: 2026-08-31

## Estado actual

E-commerce + TPV físico de Vapers Alcosa (Sevilla). Supabase es la fuente de
verdad operativa de stock/ventas; Odoo recibe fire-and-forget la factura
legal en paralelo (no bloquea ninguna venta). El historial detallado de cada
sesión de trabajo vive en el propio `CLAUDE.md` del repo (convención previa
a este `STATUS.md` — se mantiene así, no se migra retroactivamente).

Este archivo es nuevo (no existía hasta hoy, faltaba respecto al harness de
`proyectos_digidot`) — arranca reflejando el trabajo de esta sesión en
adelante, no reconstruye retroactivamente todo lo de `CLAUDE.md`.

## Hecho (verificado)

- Export de ventas para el gestor (specs/export-ventas-gestor.md) —
  `/admin/reports`: filtro por rango de fechas + canal (TPV efectivo/
  tarjeta, Stripe, reserva), resumen en pantalla, descarga `.xlsx` (2 hojas:
  Ventas detalle por línea + Resumen por canal). `xlsx` se carga con
  `import()` dinámico, nunca entra al bundle inicial. Tests unitarios
  (Vitest, recién agregado al proyecto — no existía antes) sobre las
  funciones puras de agregación en `src/lib/salesExport.js`.

## Pendiente / próximos pasos

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

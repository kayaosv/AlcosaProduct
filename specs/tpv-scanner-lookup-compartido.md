# Búsqueda por código de barras compartida entre TPV y Escáner de stock

## Objetivo

`Tpv.jsx` y `StockScanner.jsx` duplican casi textualmente la resolución de
"código escaneado → producto o variante" (variante por `barcode` primero,
si no aparece cae a `products.barcode`). Extraer esa lógica a un único
lugar para que un cambio en la regla de resolución no dependa de tocar dos
archivos en sync.

## Criterios de aceptación

- [ ] `src/lib/barcodeLookup.js` expone una función que, dado un código,
      devuelve la variante encontrada (con su producto embebido) o el
      producto encontrado (con sus variantes embebidas), o `null` si no
      hay match — sin decidir qué hacer con el resultado (eso lo sigue
      resolviendo cada pantalla).
- [ ] `Tpv.jsx` y `StockScanner.jsx` usan esa función en vez de repetir las
      queries a Supabase.
- [ ] Comportamiento observable idéntico al actual en ambas pantallas
      (mismo resultado ante: código de variante, código de producto,
      código no encontrado) — no es un cambio de UX, es solo remover
      duplicación.
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se fusionan las dos pantallas en una sola (decisión explícita: TPV
  vende, Escáner ajusta stock, son tareas distintas del día a día).
- No se toca el buscador por nombre del TPV (ya existe, no está duplicado).
- No se agrega reconocimiento de producto por foto/cámara sin código de
  barras (evaluado, requeriría un modelo de visión aparte — no es un
  ajuste chico).

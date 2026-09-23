# Escáner de stock: código no encontrado → vincular a un producto existente o crear uno nuevo

## Objetivo

Hoy, cuando `/admin/stock-scanner` escanea un código que no está en la
base, la única salida es un link genérico a "Crear producto" (sin el
código precargado) — no contempla el caso, muy real en este catálogo,
de que el producto **ya existe** pero nunca se le cargó ese código de
barras (`missingBarcode` en `/admin/products` ya lo señala como
problema conocido). Pedido explícito del cliente, inspirado en una
funcionalidad de otro proyecto propio (Stylo019: escanear → si no
existe, alta rápida ahí mismo) — adaptado acá porque este catálogo
tiene categorías con moldes de campos/variantes propios (a diferencia
de Stylo019, que resuelve el caso "no existe" creando un producto
oculto de venta rápida sin categoría real: no aplica a este catálogo).

## Criterios de aceptación

- [ ] Al escanear (pistola o cámara) un código que no matchea ninguna
      variante ni producto, además del mensaje actual "Producto no
      encontrado", aparecen dos acciones:
  - [ ] **"🔗 Vincular a un producto existente"** — abre un buscador por
        nombre (mismo patrón `ilike` + debounce ya usado en el buscador
        por nombre del TPV). Al elegir un resultado:
    - [ ] Si el producto **no tiene variantes**: el código escaneado se
          guarda directo en `products.barcode`.
    - [ ] Si el producto **tiene variantes**: se pide elegir cuál
          (chips con el label de cada variante activa) antes de guardar
          el código en `product_variants.barcode` de esa variante.
    - [ ] Confirmación visible tras guardar, y el escáner queda listo
          para el siguiente código (mismo `reset()` que ya existe).
  - [ ] **"+ Crear producto nuevo"** — navega a `/admin/products/new`
        con el código ya escaneado precargado en el campo "Código de
        barras" del formulario (el resto del alta sigue siendo el
        editor completo real, con categoría/molde/variantes — no un
        formulario paralelo simplificado, para no duplicar la lógica de
        moldes por categoría que ya vive en `ProductEditor.jsx`).
- [ ] Ambos casos manejan el error de código duplicado (23505) con un
      mensaje claro, aunque en la práctica no debería pasar (se llega a
      este flujo justamente porque el código no matcheó nada).
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se replica el patrón de Stylo019 de crear un producto oculto
  (`activo: false`, sin categoría real) para "vender igual" — este
  catálogo no tiene ese concepto de venta sin catalogar, y mezclar
  categoría real con producto placeholder complicaría los moldes de
  `ProductEditor.jsx` sin necesidad real (no hay TPV sin stock
  catalogado como problema reportado, a diferencia de Stylo019).
- No se agrega esta funcionalidad al TPV (`Tpv.jsx`) — el TPV es para
  vender un catálogo ya cargado, no para gestionarlo; decisión explícita
  del cliente de que esto viva solo en Escáner de stock.
- No se toca el formulario de alta completo (`ProductEditor.jsx`) más
  allá de prellenar el campo de código de barras cuando llega por
  `location.state`.

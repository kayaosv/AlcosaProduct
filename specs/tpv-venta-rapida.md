# TPV: venta rápida de un producto no registrado

## Objetivo

Pedido explícito del cliente: poder cobrar en el momento algo que no
está cargado en el catálogo (igual que en `kayaosv/Stylo019`), sin tener
que pasar primero por el Escáner de stock a crear/vincular un producto
completo. Reemplaza la decisión anterior (`specs/escaner-vincular-o-crear-por-codigo.md`,
sección "Fuera de alcance") de no clonar ese patrón — el cliente confirmó
que sí lo quiere, en el TPV específicamente.

## Diseño

- Botón "+ Venta rápida (producto no registrado)" en `Tpv.jsx`, siempre
  visible junto al escáner (no solo tras un código no encontrado, igual
  que en Stylo019) — si el disparador fue un código sin match, se
  precarga; si no, el campo de código queda libre y opcional.
- Al confirmar (descripción + precio + cantidad), se crea un producto
  **oculto** real: `is_active: false`, `category_id: null` (no pasa por
  el editor completo ni sus moldes de categoría — es intencional, no un
  atajo incompleto), `stock` = la cantidad exacta de esa venta, código
  de barras opcional.
- Se agrega directo al carrito del TPV como una línea de producto
  normal — la venta se cobra con `create_pos_sale()` sin ningún cambio
  en esa función: es un `product_id` real como cualquier otro, así que
  descuenta su stock (a 0) y queda en `orders`/`order_items` visible en
  Pedidos/Analítica igual que cualquier venta.
- Código de barras duplicado (si se tipeó uno que ya existe) se rechaza
  con mensaje claro — no debería pasar en la práctica ya que el atajo
  nace de un código que ya se confirmó como "no encontrado", pero un
  código tipeado a mano sí puede colisionar.

## Criterios de aceptación

- [ ] El botón de venta rápida está visible en `/admin/tpv` en todo
      momento, no solo tras un escaneo fallido.
- [ ] Confirmar el formulario crea el producto oculto y lo agrega al
      carrito con la cantidad pedida, listo para cobrar.
- [ ] La venta resultante es indistinguible de cualquier otra en
      Pedidos/Analítica (mismo `create_pos_sale`, sin lógica paralela).
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se agrega esta venta rápida a `StockScanner.jsx` ni a los flujos
  online (reserva/transferencia) — es exclusiva del TPV presencial,
  donde tiene sentido cobrar algo en el momento sin catalogarlo antes.
- No hay forma de "promover" después un producto de venta rápida a un
  producto real catalogado (asignarle categoría/variantes) más allá de
  editarlo a mano desde `/admin/products/:id` como cualquier otro.

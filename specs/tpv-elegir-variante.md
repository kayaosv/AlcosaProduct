# TPV: elegir variante al agregar un producto

## Objetivo

Reporte del cliente (2026-09-25): desde el buscador por nombre del TPV no
se podía elegir la variante (ej. nicotina HIGH/LOW de "Shades Dry Shot",
6/30ml de un longfill) — se agregaba siempre la variante principal sola,
y tuvo que registrar ventas reales con la variante equivocada. Tampoco
se veía ninguna imagen en los resultados.

## Criterios de aceptación

- [ ] Elegir en el buscador por nombre un producto con 2+ variantes
      activas abre un selector de variantes en vez de agregar la
      principal automáticamente.
- [ ] Escanear el código del PRODUCTO base (no de una variante) de un
      producto con 2+ variantes activas abre el mismo selector.
- [ ] El selector muestra por variante: foto (la de la variante, si no la
      del producto), etiqueta, precio resuelto y stock.
- [ ] Con 1 sola variante activa se agrega directo (sin selector), igual
      que antes.
- [ ] Los resultados del buscador muestran una miniatura del producto
      (foto del producto, si no la de la variante principal).
- [ ] Escanear el código propio de una variante sigue agregando esa
      variante exacta, sin selector.

## Fuera de alcance

- Corregir las ventas ya registradas con la variante equivocada (se
  cancelan/rehacen desde `/admin/orders` si hace falta).
- Bloquear variantes sin stock — se muestran marcadas pero se pueden
  elegir, el RPC `create_pos_sale` ya valida el stock real al cobrar.
- Tests de componente (el proyecto no tiene React Testing Library
  instalado): la lógica de decisión se extrae a `src/lib/posVariants.js`
  y se testea ahí; la UI requiere prueba manual.

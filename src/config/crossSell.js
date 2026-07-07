// Sugerencias cruzadas por familia de producto (slug de categoría → slugs
// de categorías sugeridas). Usado por el "también te puede interesar" del
// carrito: p.ej. un longfill (aroma concentrado, sin nicotina) necesita
// base neutra/nicokit de Alquimia para poder vapearse. Ajustar este mapa
// si el catálogo real o el naming de categorías cambia — es la única
// pieza que un no-programador necesitaría tocar para afinar el motor.
export const CROSS_SELL_MAP = {
  longfill: ['alquimia'],
  minilongfill: ['alquimia'],
  alquimia: ['longfill', 'minilongfill'],
  'sales-de-nicotina': ['vapers', 'resistencia'],
  vapers: ['resistencia', 'accesorios'],
  resistencia: ['vapers', 'accesorios'],
}

export const crossSellCategoriesFor = (categorySlug) => CROSS_SELL_MAP[categorySlug] ?? []

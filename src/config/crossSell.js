// Sugerencias cruzadas por familia de producto, modeladas como "grupos de
// receta": todas las categorías de un mismo grupo se sugieren entre sí
// (relación de todos-contra-todos, no de una sola vía). Un longfill sin
// base neutra + nicokit (Alquimia) no es líquido vapeable, y ese líquido
// sin vaporizador + resistencia no sirve de nada — por eso añadir
// cualquiera de las partes sugiere las demás del mismo grupo. Ajustar
// estos grupos es lo único que un no-programador necesitaría tocar para
// afinar el motor.
const RECIPE_GROUPS = [
  // DIY: aroma concentrado + base/nicokit (Alquimia) + dispositivo + resistencia
  ['longfill', 'minilongfill', 'alquimia', 'vapers', 'resistencia'],
  // Listo para vapear: sales de nicotina ya vienen mezcladas, no necesitan Alquimia
  ['sales-de-nicotina', 'vapers', 'resistencia'],
  // Desechables no usan piezas DIY (son autocontenidos) — solo se
  // sugieren accesorios genéricos compatibles con cualquier dispositivo.
  ['vapers-desechables', 'accesorios'],
]

export const crossSellCategoriesFor = (categorySlug) => {
  const targets = new Set()
  for (const group of RECIPE_GROUPS) {
    if (!group.includes(categorySlug)) continue
    for (const slug of group) {
      if (slug !== categorySlug) targets.add(slug)
    }
  }
  return [...targets]
}

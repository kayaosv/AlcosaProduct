// Grafo de cercania entre categorias para sugerencias cruzadas
// ("tambien te puede interesar" en la ficha de producto y en el
// carrito - ambas comparten useSuggestedProducts.js).
//
// Antes esto era una lista fija de "grupos de receta": una categoria
// sin grupo asignado (o cuyo unico grupo se quedaba sin stock, como
// paso con Accesorios cuando Vapers Desechables llego a 0 unidades)
// se quedaba sin ninguna sugerencia posible - la seccion entera
// desaparecia, sin ningun link para seguir navegando. Ahora TODA
// categoria tiene un peso de cercania a TODAS las demas, para
// garantizar que siempre hay algun candidato de fallback.
//
// Peso 3: "receta" - hacen falta juntas para vapear (ver RECIPE_GROUPS).
// Peso 2: misma familia (mismo `kind` de categoria).
// Peso 1: catch-all - cualquier otro par de categorias distintas.
// (0 esta reservado para "misma categoria", que crossSellWeight nunca
// devuelve - ese caso se maneja aparte, como ultimo fallback, en
// useSuggestedProducts.js).
const RECIPE_GROUPS = [
  // DIY: aroma concentrado + base/nicokit (Alquimia) + dispositivo + resistencia
  ['longfill', 'minilongfill', 'alquimia', 'vapers', 'resistencia'],
  // Listo para vapear: sales de nicotina ya vienen mezcladas, no necesitan Alquimia
  ['sales-de-nicotina', 'vapers', 'resistencia'],
  // Desechables no usan piezas DIY (son autocontenidos) — solo se
  // sugieren accesorios genéricos compatibles con cualquier dispositivo.
  ['vapers-desechables', 'accesorios'],
]

export const crossSellWeight = (slugA, slugB, kindA, kindB) => {
  if (slugA === slugB) return 0
  if (RECIPE_GROUPS.some((g) => g.includes(slugA) && g.includes(slugB))) return 3
  if (kindA && kindB && kindA === kindB) return 2
  return 1
}

// Ordena una lista de categorias {id, slug, kind} por cercania a un
// conjunto de categorias de origen (las que ya hay en el carrito/la
// que se esta viendo), usando el peso maximo contra cualquiera de
// ellas. Agrupa por nivel de peso (3/2/1) para poder consultar
// productos nivel por nivel en useSuggestedProducts.js, en vez de un
// solo query plano que un `kind` muy poblado podria dominar.
export const rankCategoriesByCloseness = (categories, sourceSlugs) => {
  const sources = categories.filter((c) => sourceSlugs.includes(c.slug))
  const candidates = categories.filter((c) => !sourceSlugs.includes(c.slug))

  const weighted = candidates.map((c) => ({
    ...c,
    weight: Math.max(0, ...sources.map((s) => crossSellWeight(s.slug, c.slug, s.kind, c.kind))),
  }))

  const tiers = new Map()
  for (const c of weighted) {
    if (!tiers.has(c.weight)) tiers.set(c.weight, [])
    tiers.get(c.weight).push(c)
  }

  return [...tiers.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weight, cats]) => ({ weight, categories: cats }))
}

// Unico lugar donde vive "cual es el stock/precio/margen real de un
// producto" cuando puede tener variantes. Antes esta logica solo
// existia bien en useAnalyticsData.js (usado por Analytics.jsx) - el
// resto del admin (Dashboard, Categorias, Mayorista, y parte de
// Productos) leia products.stock/price/wholesale_price crudos, que
// quedan en 0/null en cuanto un producto tiene variantes (el editor
// oculta esos campos del producto base a proposito cuando hay
// variantes). Centralizado aca para que no se repita ni se desincronice
// de nuevo.

export const activeVariants = (p) =>
  (p.product_variants ?? []).filter((v) => v.is_active !== false)

export const getStock = (p) => {
  const vv = activeVariants(p)
  return vv.length ? vv.reduce((s, v) => s + (v.stock || 0), 0) : p.stock ?? 0
}

export const getEffectivePrice = (p) => {
  const vv = activeVariants(p)
  if (vv.length) {
    const primary = vv.find((v) => v.is_primary) ?? vv[0]
    const price = primary?.price ?? p.price ?? 0
    const sale = primary?.sale_price
    return Number((p.is_on_sale && sale) ? sale : price)
  }
  return Number((p.is_on_sale && p.sale_price) ? p.sale_price : p.price ?? 0)
}

export const getWholesalePrice = (p) => {
  const vv = activeVariants(p).filter((v) => v.wholesale_price)
  if (vv.length) return vv.reduce((s, v) => s + Number(v.wholesale_price), 0) / vv.length
  return p.wholesale_price != null ? Number(p.wholesale_price) : null
}

export const getMarginPct = (p) => {
  const vv = activeVariants(p)
  if (vv.length) {
    const priced = vv.filter((v) => v.price && v.wholesale_price)
    if (priced.length) {
      return priced.reduce(
        (s, v) => s + ((v.price - v.wholesale_price) / v.price) * 100,
        0,
      ) / priced.length
    }
  }
  if (p.wholesale_price && p.price) {
    return ((p.price - p.wholesale_price) / p.price) * 100
  }
  return 0
}

export const hasWholesale = (p) => {
  const vv = activeVariants(p)
  if (vv.length) return vv.some((v) => v.price && v.wholesale_price)
  return !!(p.wholesale_price && p.price)
}

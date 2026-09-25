export const activeVariants = (product) =>
  (product.product_variants ?? []).filter((v) => v.is_active !== false)

export const primaryVariant = (variants) => variants.find((v) => v.is_primary) ?? variants[0] ?? null

// Codigo de producto base o resultado del buscador por nombre: con 2+
// variantes no se sabe cual tiene el cliente en la mano, hay que
// preguntar (antes se agregaba la principal sola, ver specs/tpv-elegir-variante.md).
export const needsVariantPick = (product) => activeVariants(product).length > 1

export const productThumb = (product) =>
  product.image_url || primaryVariant(activeVariants(product))?.image_url || null

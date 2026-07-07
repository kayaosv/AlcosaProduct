import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { crossSellCategoriesFor } from '../config/crossSell.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale,
  stock, image_url, categories(id, name, slug)
`

// Sugiere productos de categorías complementarias a las que ya hay en el
// carrito (ver src/config/crossSell.js), evitando: categorías que ya
// están en el carrito, productos ya añadidos, y productos sin stock.
//
// El stock de productos con variantes vive en `product_variants.stock`,
// no en `products.stock` (el admin lo oculta cuando hay variantes — ver
// CLAUDE.md) — por eso el chequeo de disponibilidad consulta las dos
// tablas en vez de filtrar por `products.stock` directamente en la query.
export const useSuggestedProducts = (cartItems, { limit = 3 } = {}) => {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  const cartCategorySlugs = [...new Set(cartItems.map((i) => i.categorySlug).filter(Boolean))]
  const cartProductIds = [...new Set(cartItems.map((i) => i.productId))]
  const dedupeKey = `${cartCategorySlugs.join(',')}|${cartProductIds.join(',')}`

  useEffect(() => {
    const targetSlugs = [
      ...new Set(
        cartCategorySlugs
          .flatMap((slug) => crossSellCategoriesFor(slug))
          .filter((slug) => !cartCategorySlugs.includes(slug)),
      ),
    ]

    if (targetSlugs.length === 0) {
      setSuggestions([])
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)

      const { data: cats } = await supabase.from('categories').select('id, slug').in('slug', targetSlugs)
      const catIds = (cats ?? []).map((c) => c.id)
      if (cancelled) return
      if (catIds.length === 0) {
        setSuggestions([])
        setLoading(false)
        return
      }

      const { data: candidates } = await supabase
        .from('products')
        .select(SELECT)
        .in('category_id', catIds)
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit * 4)
      if (cancelled) return

      const list = (candidates ?? []).filter((p) => !cartProductIds.includes(p.id))
      if (list.length === 0) {
        setSuggestions([])
        setLoading(false)
        return
      }

      const { data: variantRows } = await supabase
        .from('product_variants')
        .select('product_id, stock')
        .in(
          'product_id',
          list.map((p) => p.id),
        )
      if (cancelled) return

      const variantStockByProduct = new Map()
      for (const v of variantRows ?? []) {
        variantStockByProduct.set(v.product_id, (variantStockByProduct.get(v.product_id) ?? 0) + v.stock)
      }

      const seenCategory = new Set()
      const picked = []
      for (const p of list) {
        const hasVariants = variantStockByProduct.has(p.id)
        const inStock = hasVariants ? variantStockByProduct.get(p.id) > 0 : p.stock > 0
        if (!inStock) continue
        const slug = p.categories?.slug
        if (seenCategory.has(slug)) continue
        seenCategory.add(slug)
        picked.push({ ...p, hasVariants })
        if (picked.length >= limit) break
      }
      setSuggestions(picked)
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupeKey, limit])

  return { suggestions, loading }
}

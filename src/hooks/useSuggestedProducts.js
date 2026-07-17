import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { crossSellCategoriesFor } from '../config/crossSell.js'
import { getStock } from '../lib/stockPricing.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale,
  stock, image_url, categories(id, name, slug),
  product_variants(id, label, price, sale_price, is_primary, is_active, stock, image_url)
`

// Sugiere productos de categorías complementarias a las que ya hay en el
// carrito (ver src/config/crossSell.js), evitando: categorías que ya
// están en el carrito, productos ya añadidos, y productos sin stock.
//
// El stock Y el precio de productos con variantes viven en
// `product_variants` (stock/price/sale_price), no en `products.stock`/
// `price` (el admin los oculta cuando hay variantes — ver CLAUDE.md).
// Se traen completos en el SELECT principal (antes solo se traía el
// stock en una query aparte, sin precio — SuggestedProducts.jsx/
// ProductSuggestions.jsx mostraban 0€ para cualquier sugerencia con
// variantes).
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

      const seenCategory = new Set()
      const picked = []
      for (const p of list) {
        const hasVariants = (p.product_variants?.length ?? 0) > 0
        if (getStock(p) <= 0) continue
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

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { rankCategoriesByCloseness } from '../config/crossSell.js'
import { getStock } from '../lib/stockPricing.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale,
  stock, image_url, categories(id, name, slug),
  product_variants(id, label, price, sale_price, is_primary, is_active, stock, image_url)
`

// Sugiere productos de categorías complementarias a las que ya hay en el
// carrito (ver src/config/crossSell.js), evitando: productos ya en el
// carrito y productos sin stock.
//
// Nunca deberia quedar vacio mientras exista algun producto activo con
// stock fuera del propio carrito. Antes, una categoria dependia de una
// lista fija de categorias "permitidas" - si su unico destino se
// quedaba sin stock (paso con Accesorios cuando Vapers Desechables
// llego a 0 unidades), la seccion entera desaparecia sin dejar ningun
// link para seguir navegando. Ahora se recorren TODAS las categorias
// por nivel de cercania (receta > misma familia > cualquier otra, ver
// rankCategoriesByCloseness), y solo si eso no alcanza cae a "mas de
// esta misma categoria" y finalmente a "cualquier producto activo con
// stock" como ultimo recurso.
//
// El stock Y el precio de productos con variantes viven en
// `product_variants` (stock/price/sale_price), no en `products.stock`/
// `price` (el admin los oculta cuando hay variantes — ver CLAUDE.md).
export const useSuggestedProducts = (cartItems, { limit = 3 } = {}) => {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  const cartCategorySlugs = [...new Set(cartItems.map((i) => i.categorySlug).filter(Boolean))]
  const cartProductIds = [...new Set(cartItems.map((i) => i.productId))]
  const dedupeKey = `${cartCategorySlugs.join(',')}|${cartProductIds.join(',')}`

  useEffect(() => {
    if (cartCategorySlugs.length === 0) {
      setSuggestions([])
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)

      const { data: allCategories } = await supabase.from('categories').select('id, slug, kind')
      if (cancelled) return
      const categories = allCategories ?? []

      const picked = []
      const seenCategorySlug = new Set()

      // `diversify`: como mucho 1 producto por categoria - se desactiva
      // en los fallbacks (misma categoria / cualquiera), donde ya no
      // importa variedad sino simplemente no dejar la seccion vacia.
      const fetchAndPick = async (categoryIds, { diversify = true } = {}) => {
        if (categoryIds.length === 0 || picked.length >= limit) return
        const { data } = await supabase
          .from('products')
          .select(SELECT)
          .in('category_id', categoryIds)
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit * 6)
        if (cancelled || !data) return
        for (const p of data) {
          if (picked.length >= limit) break
          if (cartProductIds.includes(p.id)) continue
          if (picked.some((x) => x.id === p.id)) continue
          if (getStock(p) <= 0) continue
          const slug = p.categories?.slug
          if (diversify && slug && seenCategorySlug.has(slug)) continue
          if (slug) seenCategorySlug.add(slug)
          picked.push({ ...p, hasVariants: (p.product_variants?.length ?? 0) > 0 })
        }
      }

      // Categorias complementarias, por nivel de cercania (receta >
      // misma familia > cualquier otra).
      const tiers = rankCategoriesByCloseness(categories, cartCategorySlugs)
      for (const tier of tiers) {
        if (picked.length >= limit) break
        await fetchAndPick(tier.categories.map((c) => c.id))
      }

      // Fallback 1: mas productos de la(s) misma(s) categoria(s) del carrito.
      if (picked.length < limit) {
        const sameCategoryIds = categories
          .filter((c) => cartCategorySlugs.includes(c.slug))
          .map((c) => c.id)
        await fetchAndPick(sameCategoryIds, { diversify: false })
      }

      // Fallback 2 (ultimo recurso): cualquier producto activo con
      // stock, sin filtro de categoria - solo puede quedar vacio si no
      // queda NADA vendible en todo el catalogo fuera del carrito.
      if (picked.length < limit) {
        await fetchAndPick(categories.map((c) => c.id), { diversify: false })
      }

      if (!cancelled) {
        setSuggestions(picked)
        setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupeKey, limit])

  return { suggestions, loading }
}

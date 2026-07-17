import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// El stock Y el precio de productos con variantes viven en
// `product_variants` (stock/price/sale_price), no en `products.stock`/
// `price` (el admin los oculta cuando hay variantes — ver CLAUDE.md).
// Se traen completos (no solo stock) para que ProductCard.jsx pueda
// calcular el precio real con getEffectivePrice() en vez de mostrar
// 0€ leyendo products.price directo.
const SELECT = `
  id, name, brand, price, sale_price, is_on_sale,
  stock, is_active, is_featured, image_url, details,
  categories(id, name, slug),
  product_variants(id, label, price, sale_price, is_primary, is_active, stock, image_url)
`

export const useProducts = ({
  categorySlug,
  search,
  page = 1,
  pageSize = 12,
} = {}) => {
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('products')
        .select(SELECT, { count: 'exact' })
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })

      if (categorySlug && categorySlug !== 'all') {
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', categorySlug)
          .maybeSingle()
        if (cat?.id) query = query.eq('category_id', cat.id)
      }

      if (search?.trim()) {
        query = query.ilike('name', `%${search.trim()}%`)
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error: err, count } = await query
      if (cancelled) return

      if (err) {
        setError(err)
        setProducts([])
        setTotal(0)
      } else {
        setProducts(data ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [categorySlug, search, page, pageSize])

  return { products, total, loading, error }
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale, wholesale_price,
  stock, details, category_id,
  categories(id, name, slug, color),
  product_variants(id, price, sale_price, wholesale_price, stock, is_primary, is_active)
`

export const useAnalyticsData = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select(SELECT)
    setProducts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { products, loading }
}

// Helpers variant-aware — viven en src/lib/stockPricing.js (compartidos
// con useAdminProducts.js, que usan Dashboard/Categorías/Mayorista/
// Productos). Re-exportados aquí para no tocar los imports existentes
// en Analytics.jsx.
export { getStock, getEffectivePrice, getWholesalePrice, getMarginPct, hasWholesale } from '../lib/stockPricing.js'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale, wholesale_price,
  stock, details, category_id,
  categories(id, name, slug),
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

// ── Helpers variant-aware ─────────────────────────────────────────────────────

const activeVariants = (p) =>
  (p.product_variants ?? []).filter((v) => v.is_active !== false)

export const getStock = (p) => {
  const vv = activeVariants(p)
  return vv.length
    ? vv.reduce((s, v) => s + (v.stock || 0), 0)
    : p.stock ?? 0
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

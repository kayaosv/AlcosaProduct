import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const useProduct = (id) => {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('products')
        .select(`
          id, name, brand, price, sale_price, is_on_sale,
          stock, is_active, is_featured, image_url, details,
          categories(id, name, slug, kind, promo_tiers)
        `)
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      if (err) {
        setError(err)
        setProduct(null)
      } else {
        setProduct(data)
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  return { product, loading, error }
}

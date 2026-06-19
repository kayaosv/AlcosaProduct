import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = `
  id, name, brand, barcode, price, sale_price, is_on_sale, wholesale_price,
  stock, is_active, is_featured, image_url, images, details, category_id,
  created_at, updated_at,
  categories(id, name, slug)
`

export const useAdminProducts = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('products')
      .select(SELECT)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setProducts([])
    } else {
      setProducts(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from('products').delete().eq('id', id)
    if (err) throw err
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { products, loading, error, refetch: fetchAll, remove }
}

export const fetchProductById = async (id) => {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export const createProduct = async (payload) => {
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

export const updateProduct = async (id, payload) => {
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

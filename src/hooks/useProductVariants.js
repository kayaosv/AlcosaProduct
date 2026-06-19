import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export const useProductVariants = (productId) => {
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order')
    setVariants(data ?? [])
    setLoading(false)
  }, [productId])

  useEffect(() => { refetch() }, [refetch])

  const add = async (variant) => {
    const isPrimary = variants.length === 0
    const { data, error } = await supabase
      .from('product_variants')
      .insert({ ...variant, product_id: productId, sort_order: variants.length, is_primary: isPrimary })
      .select()
      .single()
    if (error) throw error
    setVariants((v) => [...v, data])
    return data
  }

  const update = async (id, changes) => {
    const { error } = await supabase
      .from('product_variants')
      .update(changes)
      .eq('id', id)
    if (error) throw error
    setVariants((v) => v.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const remove = async (id) => {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id)
    if (error) throw error
    setVariants((v) => {
      const next = v.filter((item) => item.id !== id)
      // Auto-promote first remaining variant to primary if needed
      if (next.length > 0 && !next.some((i) => i.is_primary)) {
        supabase.from('product_variants').update({ is_primary: true }).eq('id', next[0].id)
        return next.map((i, idx) => ({ ...i, is_primary: idx === 0 }))
      }
      return next
    })
  }

  const setPrimary = async (id) => {
    await supabase.from('product_variants').update({ is_primary: false }).eq('product_id', productId)
    await supabase.from('product_variants').update({ is_primary: true }).eq('id', id)
    setVariants((v) => v.map((item) => ({ ...item, is_primary: item.id === id })))
  }

  return { variants, loading, add, update, remove, setPrimary, refetch }
}

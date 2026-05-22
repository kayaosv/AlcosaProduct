import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const useCategories = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { data, error: err } = await supabase
        .from('categories')
        .select('id, name, slug, sort_order')
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (err) {
        setError(err)
        setCategories([])
      } else {
        setCategories(data ?? [])
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  return { categories, loading, error }
}

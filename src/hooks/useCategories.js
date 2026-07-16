import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = 'id, name, slug, sort_order, color'

export const useCategories = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('categories')
      .select(SELECT)
      .order('sort_order', { ascending: true })
    if (err) {
      setError(err)
      setCategories([])
    } else {
      setCategories(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const create = useCallback(async (payload) => {
    const { data, error: err } = await supabase
      .from('categories')
      .insert(payload)
      .select(SELECT)
      .single()
    if (err) throw err
    setCategories((c) => [...c, data])
    return data
  }, [])

  // El slug es la identidad de la categoria (URLs ?cat=slug, y la clave
  // de CATEGORY_META en productSpecs.js) - renombrar NO debe tocarlo,
  // solo el nombre visible, para no desconectar la categoria de sus
  // campos/variantes especiales ni romper links guardados.
  const update = useCallback(async (id, changes) => {
    const { slug, ...safeChanges } = changes
    const { error: err } = await supabase.from('categories').update(safeChanges).eq('id', id)
    if (err) throw err
    setCategories((c) => c.map((cat) => (cat.id === id ? { ...cat, ...safeChanges } : cat)))
  }, [])

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from('categories').delete().eq('id', id)
    if (err) throw err
    setCategories((c) => c.filter((cat) => cat.id !== id))
  }, [])

  return { categories, loading, error, refetch: fetchAll, create, update, remove }
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// Fila única (id fijo = true) con ajustes globales de la tienda —
// hoy solo el banner de envío gratis, pensado para sumar más ajustes
// sueltos acá sin crear una tabla nueva por cada uno.
export const useShopSettings = () => {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('shop_settings').select('*').eq('id', true).maybeSingle()
    setSettings(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const update = useCallback(async (changes) => {
    const { error } = await supabase.from('shop_settings').update(changes).eq('id', true)
    if (error) throw error
    setSettings((s) => ({ ...s, ...changes }))
  }, [])

  return { settings, loading, update }
}

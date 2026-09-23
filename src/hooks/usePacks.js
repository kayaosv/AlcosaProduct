import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = `
  id, name, slug, description, image_url, price, created_at,
  pack_items(
    quantity,
    products(id, name, image_url, stock),
    product_variants(id, label, stock, image_url)
  )
`

// Cuantas unidades del pack se pueden armar hoy con el stock real de
// cada componente — mismo criterio que pack_available_units() en el
// server (ver supabase/add-packs-and-tpv-discount.sql), calculado acá
// porque ya se trae el stock de cada componente para mostrar la ficha.
const availableUnits = (pack) => {
  if (!pack.pack_items?.length) return 0
  return Math.min(
    ...pack.pack_items.map((it) => {
      const stock = it.product_variants?.stock ?? it.products?.stock ?? 0
      return Math.floor(stock / it.quantity)
    }),
  )
}

// Packs activos y con stock real para armar al menos 1 — un pack sin
// stock no se muestra en la tienda (mismo criterio que un producto
// agotado no aparece con el resto, no tiene sentido ofrecer algo que no
// se puede vender).
export const usePacks = () => {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('packs')
      .select(SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setPacks(
          (data ?? [])
            .map((p) => ({ ...p, availableUnits: availableUnits(p) }))
            .filter((p) => p.availableUnits > 0),
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { packs, loading }
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const SELECT = `
  id, name, slug, description, image_url, price, is_active, created_at,
  pack_items(
    id, product_id, variant_id, quantity, sort_order,
    products(id, name, brand, image_url, price, sale_price, is_on_sale),
    product_variants(id, label, price, sale_price)
  )
`

export const useAdminPacks = () => {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('packs')
      .select(SELECT)
      .order('created_at', { ascending: false })
    setPacks(
      (data ?? []).map((p) => ({ ...p, pack_items: (p.pack_items ?? []).sort((a, b) => a.sort_order - b.sort_order) })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { packs, loading, refetch: fetchAll }
}

// slug único no adivinable a partir del nombre — no es una URL amigable
// a propósito (el pack no tiene ficha propia con SEO, ver
// specs/packs-combos.md "Fuera de alcance"), solo tiene que cumplir la
// constraint UNIQUE de la tabla.
const slugify = (name) =>
  `${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`

const saveItems = async (packId, items) => {
  await supabase.from('pack_items').delete().eq('pack_id', packId)
  if (!items.length) return
  const { error } = await supabase.from('pack_items').insert(
    items.map((it, i) => ({
      pack_id: packId,
      product_id: it.productId,
      variant_id: it.variantId ?? null,
      quantity: it.quantity ?? 1,
      sort_order: i,
    })),
  )
  if (error) throw error
}

export const createPack = async ({ name, description, price, image_url, items }) => {
  const { data: pack, error } = await supabase
    .from('packs')
    .insert({ name, slug: slugify(name), description: description || null, price, image_url: image_url || null })
    .select()
    .single()
  if (error) throw error
  await saveItems(pack.id, items)
  return pack
}

export const updatePack = async (id, { name, description, price, image_url, is_active, items }) => {
  const { error } = await supabase
    .from('packs')
    .update({ name, description: description || null, price, image_url: image_url || null, is_active })
    .eq('id', id)
  if (error) throw error
  await saveItems(id, items)
}

export const deletePack = async (id) => {
  const { error } = await supabase.from('packs').delete().eq('id', id)
  if (error) throw error
}

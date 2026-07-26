// Espeja apply_desechables_tier() (ver
// supabase/add-desechables-promo-tiers.sql) del lado del cliente — la
// fuente de verdad sigue siendo ese RPC en el momento de cobrar/pagar
// (create_order/create_paid_order/create_pos_sale/get_checkout_lines).
// Esto es solo para mostrar en pantalla el precio correcto ANTES de
// eso: en el TPV el vendedor tiene que ver el monto real para cobrarlo
// en el datáfono físico antes de que el RPC siquiera se llame.

export const bestTierFor = (quantity, tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return null
  const applicable = tiers.filter((t) => quantity >= Number(t.min_qty))
  if (applicable.length === 0) return null
  return applicable.sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0]
}

// lines: [{ key, categoryId, categoryKind, promoTiers, quantity, unitPrice, ... }]
// Devuelve las mismas lineas — unitPrice ajustado (nunca peor que el
// original) cuando corresponde un tramo de desechables.
export const applyDesechablesTiers = (lines) => {
  const totalsByCategory = {}
  for (const l of lines) {
    if (l.categoryKind !== 'desechables' || !Array.isArray(l.promoTiers)) continue
    totalsByCategory[l.categoryId] = (totalsByCategory[l.categoryId] ?? 0) + l.quantity
  }
  return lines.map((l) => {
    if (l.categoryKind !== 'desechables' || !Array.isArray(l.promoTiers)) return l
    const totalQty = totalsByCategory[l.categoryId] ?? l.quantity
    const tier = bestTierFor(totalQty, l.promoTiers)
    if (!tier) return l
    return { ...l, unitPrice: Math.min(l.unitPrice, Number(tier.unit_price)) }
  })
}

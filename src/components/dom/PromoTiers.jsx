// Mini-cards de promoción por volumen para desechables (ficha de
// producto) — estilo "3 unidades · 10% dto. · Ahorras 2,67€", con el
// % y el ahorro calculados contra el precio base (no se cargan a
// mano desde admin, solo cantidad + precio por tramo).

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

export const PromoTiers = ({ basePrice, tiers }) => {
  if (!Array.isArray(tiers) || tiers.length === 0 || !basePrice) return null

  const sorted = [...tiers]
    .filter((t) => t.min_qty && t.unit_price)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty))

  if (sorted.length === 0) return null

  return (
    <div className="mt-6">
      <span
        className="block text-[10px] tracking-[0.2em] uppercase mb-3"
        style={{ color: 'rgba(23,45,109,0.5)' }}
      >
        ↳ Llevando más, pagas menos
      </span>
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((t) => {
          const unitPrice = Number(t.unit_price)
          const qty = Number(t.min_qty)
          const pct = Math.max(0, Math.round((1 - unitPrice / basePrice) * 100))
          const savings = Math.max(0, (basePrice - unitPrice) * qty)
          return (
            <div
              key={qty}
              className="px-3 py-3 text-center"
              style={{ border: '1px solid rgba(23,45,109,0.15)' }}
            >
              <span className="block text-[15px]" style={{ fontWeight: 900, color: 'var(--color-navy)' }}>
                {qty} uds.
              </span>
              <span className="block text-[11px] mt-1" style={{ fontWeight: 700, color: 'var(--color-blue)' }}>
                {pct}% dto.
              </span>
              <span className="block text-[10px] mt-1" style={{ color: 'rgba(23,45,109,0.6)' }}>
                Ahorras {formatPrice(savings)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useCartStore } from '../../stores/useCartStore.js'
import { useSuggestedProducts } from '../../hooks/useSuggestedProducts.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

// "También te puede interesar" dentro del carrito — motor de sugerencias
// por familia de producto (ver src/config/crossSell.js). Los productos
// con variantes (p.ej. longfill por volumen) enlazan a la ficha para que
// el cliente elija variante en vez de añadirse "a ciegas" — mismo criterio
// que el quick-add del catálogo (ver limitación conocida en CLAUDE.md).
export const SuggestedProducts = ({ items }) => {
  const addItem = useCartStore((s) => s.addItem)
  const { suggestions, loading } = useSuggestedProducts(items)

  if (loading || suggestions.length === 0) return null

  return (
    <div className="px-6 py-5 border-t" style={{ borderColor: 'rgba(23,45,109,0.1)' }}>
      <span
        className="block text-[10px] tracking-[0.2em] uppercase mb-3"
        style={{ color: 'rgba(23,45,109,0.5)' }}
      >
        También te puede interesar
      </span>
      <ul className="space-y-3">
        {suggestions.map((p) => {
          const price = p.is_on_sale && p.sale_price != null ? p.sale_price : p.price
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Link
                to={`/product/${p.id}`}
                data-cursor="link"
                className="w-12 h-14 shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: 'var(--color-navy)' }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span style={{ color: 'var(--color-cream)', fontWeight: 900, fontSize: 12 }}>
                    {(p.brand || p.name || 'V').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/product/${p.id}`}
                  data-cursor="link"
                  className="block text-[12px] leading-tight truncate"
                  style={{ fontWeight: 700, color: 'var(--color-navy)' }}
                >
                  {p.name}
                </Link>
                <span className="text-[11px]" style={{ color: 'rgba(23,45,109,0.6)' }}>
                  {formatPrice(price)}
                </span>
              </div>
              {p.hasVariants ? (
                <Link
                  to={`/product/${p.id}`}
                  data-cursor="link"
                  className="text-[10px] tracking-[0.15em] uppercase shrink-0"
                  style={{ color: 'var(--color-blue)', fontWeight: 700 }}
                >
                  Ver →
                </Link>
              ) : (
                <button
                  type="button"
                  data-cursor="link"
                  onClick={() =>
                    addItem({
                      productId: p.id,
                      categorySlug: p.categories?.slug ?? null,
                      name: p.name,
                      brand: p.brand,
                      price: Number(price),
                      image_url: p.image_url,
                      quantity: 1,
                    })
                  }
                  className="text-[10px] tracking-[0.15em] uppercase shrink-0 px-3 py-2"
                  style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
                >
                  + Añadir
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

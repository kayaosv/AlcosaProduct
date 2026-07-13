import { Link } from 'react-router-dom'
import { useCartStore } from '../../stores/useCartStore.js'
import { useAppStore } from '../../stores/useAppStore.js'
import { useSuggestedProducts } from '../../hooks/useSuggestedProducts.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

// Carrusel "también te puede interesar" para la ficha de producto —
// misma fuente de verdad que el carrito (useSuggestedProducts +
// src/config/crossSell.js), pasándole un carrito sintético de un solo
// producto (el que se está viendo) para reusar exactamente la misma
// lógica de categorías complementarias y chequeo de stock real.
export const ProductSuggestions = ({ productId, categorySlug }) => {
  const addItem = useCartStore((s) => s.addItem)
  const setCartOpen = useAppStore((s) => s.setCartOpen)
  const syntheticCart = [{ productId, categorySlug }]
  const { suggestions, loading } = useSuggestedProducts(syntheticCart, { limit: 6 })

  if (loading || suggestions.length === 0) return null

  return (
    <div>
      <span
        className="block text-[10px] tracking-[0.2em] uppercase mb-4"
        style={{ color: 'rgba(23,45,109,0.5)' }}
      >
        También te puede interesar
      </span>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollSnapType: 'x proximity' }}>
        {suggestions.map((p) => {
          const price = p.is_on_sale && p.sale_price != null ? p.sale_price : p.price
          return (
            <div
              key={p.id}
              className="shrink-0"
              style={{ width: 200, scrollSnapAlign: 'start' }}
            >
              <Link
                to={`/product/${p.id}`}
                data-cursor="link"
                className="block relative overflow-hidden"
                style={{ aspectRatio: '4/5', background: 'var(--color-navy)' }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: 'var(--color-cream)', fontWeight: 900, fontSize: 28 }}
                  >
                    {(p.brand || p.name || 'V').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </Link>
              <Link
                to={`/product/${p.id}`}
                data-cursor="link"
                className="block mt-3 text-[13px] leading-tight"
                style={{ fontWeight: 700, color: 'var(--color-navy)' }}
              >
                {p.name}
              </Link>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[12px]" style={{ color: 'rgba(23,45,109,0.7)', fontWeight: 700 }}>
                  {formatPrice(price)}
                </span>
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
                    onClick={() => {
                      addItem({
                        productId: p.id,
                        categorySlug: p.categories?.slug ?? null,
                        name: p.name,
                        brand: p.brand,
                        price: Number(price),
                        image_url: p.image_url,
                        quantity: 1,
                      })
                      setCartOpen(true)
                    }}
                    className="text-[10px] tracking-[0.15em] uppercase shrink-0 px-3 py-2"
                    style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
                  >
                    + Añadir
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

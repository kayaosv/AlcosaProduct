import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../../stores/useCartStore.js'
import { useAppStore } from '../../stores/useAppStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

export const PackCard = ({ pack }) => {
  const cardRef = useRef(null)
  const imageRef = useRef(null)
  const addItem = useCartStore((s) => s.addItem)
  const setCartOpen = useAppStore((s) => s.setCartOpen)

  const { contextSafe } = useGSAP({ scope: cardRef })

  const onEnter = contextSafe(() => {
    gsap.to(cardRef.current, { scale: 1.02, duration: 0.4, ease: 'power2.out' })
    gsap.to(imageRef.current, { scale: 1.08, duration: 0.6, ease: 'power2.out' })
  })
  const onLeave = contextSafe(() => {
    gsap.to(cardRef.current, { scale: 1, duration: 0.4, ease: 'power2.out' })
    gsap.to(imageRef.current, { scale: 1, duration: 0.6, ease: 'power2.out' })
  })

  const image = pack.image_url || pack.pack_items.find((it) => it.products?.image_url)?.products?.image_url

  const handleAdd = (e) => {
    e.preventDefault()
    addItem({
      packId: pack.id,
      name: pack.name,
      price: Number(pack.price),
      image_url: image,
      quantity: 1,
    })
    setCartOpen(true)
  }

  return (
    <div ref={cardRef} className="block group" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '4/5', background: 'var(--color-cream)', border: '1px solid rgba(23,45,109,0.08)' }}
      >
        <div ref={imageRef} className="absolute inset-0">
          {image ? (
            <img src={image} alt={pack.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'var(--color-navy)', color: 'var(--color-cream)', fontWeight: 900, fontSize: '3vw' }}
            >
              PACK
            </div>
          )}
        </div>
        <span
          className="absolute top-3 right-3 text-[10px] tracking-[0.18em] uppercase px-2 py-1"
          style={{ background: 'var(--color-lime)', color: 'var(--color-navy)', fontWeight: 700 }}
        >
          Pack
        </span>
        <button
          type="button"
          onClick={handleAdd}
          data-cursor="link"
          aria-label={`Añadir pack ${pack.name} al carrito`}
          className="quick-add-btn absolute bottom-3 right-3 flex items-center justify-center"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: 'var(--color-lime)', color: 'var(--color-navy)',
            fontWeight: 900, fontSize: 22, lineHeight: 1, boxShadow: '0 2px 10px rgba(23,45,109,0.3)',
          }}
        >
          +
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-[15px] leading-tight" style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
          {pack.name}
        </h3>
        <p className="text-[12px] mt-1" style={{ color: 'rgba(23,45,109,0.6)' }}>
          {pack.pack_items.map((it) => it.products?.name).filter(Boolean).join(' + ')}
        </p>
        <span className="text-[15px] block mt-1" style={{ fontWeight: 900 }}>{formatPrice(pack.price)}</span>
      </div>
    </div>
  )
}

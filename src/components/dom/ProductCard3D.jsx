import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { View, PerspectiveCamera } from '@react-three/drei'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ProductModel3D } from '../canvas/ProductModel3D.jsx'

// `active`: controlado por BestSellersSection via useInView - el
// modelo 3D real (y la descarga de su .glb) solo se monta cuando la
// seccion esta por aparecer en el scroll, en cualquier dispositivo
// (tactil o no - antes se decidia por tipo de dispositivo, lo que
// tambien apagaba el 3D en tablets capaces).
export const ProductCard3D = ({ product, flex = 1, active = true }) => {
  const rootRef = useRef(null)
  const viewRef = useRef(null)
  const ctaRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  useGSAP(
    () => {
      const ctx = gsap.context(() => {})
      const card = rootRef.current
      const cta = ctaRef.current
      if (!card) return

      const enter = () => {
        gsap.to(card, { scale: 1.02, duration: 0.4, ease: 'power2.out' })
        if (cta) gsap.to(cta, { color: 'var(--color-lime)', duration: 0.3 })
        setIsHovered(true)
      }
      const leave = () => {
        gsap.to(card, { scale: 1, duration: 0.4, ease: 'power2.out' })
        if (cta) gsap.to(cta, { color: 'var(--color-cream)', duration: 0.3 })
        setIsHovered(false)
      }

      card.addEventListener('mouseenter', enter)
      card.addEventListener('mouseleave', leave)

      return () => {
        card.removeEventListener('mouseenter', enter)
        card.removeEventListener('mouseleave', leave)
        ctx.revert()
      }
    },
    { scope: rootRef },
  )

  return (
    <div
      ref={rootRef}
      data-anim="bs-card"
      className="bs-card relative flex flex-col overflow-hidden"
      style={{
        '--bs-flex': flex,
        background: 'var(--color-navy)',
        minWidth: 0,
        willChange: 'transform',
      }}
    >
      <div
        ref={viewRef}
        style={{
          width: '100%',
          height: '300px',
          position: 'relative',
        }}
      >
        {!active ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--color-dark)', color: 'var(--color-lime)' }}
          >
            <span style={{ fontWeight: 900, fontSize: 32 }}>
              {(product.brand || product.name || 'V').slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <View track={viewRef} style={{ width: '100%', height: '100%' }}>
            <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={35} />
            <ProductModel3D model={product.model} isHovered={isHovered} />
          </View>
        )}
      </div>

      <div className="flex flex-col gap-2 p-6 pt-4 border-t border-white/5">
        <span
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ color: 'var(--color-lime)', fontWeight: 700 }}
        >
          {product.tag}
        </span>

        <h3
          className="font-sans"
          style={{
            fontWeight: 700,
            fontSize: '20px',
            color: 'var(--color-cream)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          {product.name}
        </h3>

        <span
          className="text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          {product.category}
        </span>

        <div className="flex items-end justify-between mt-3">
          <span
            style={{
              color: 'var(--color-lime)',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '-0.02em',
            }}
          >
            {product.price.toFixed(2)}€
          </span>

          <Link
            ref={ctaRef}
            to={`/catalog?cat=${product.catalogSlug}`}
            data-cursor="link"
            className="text-[11px] tracking-[0.25em] uppercase"
            style={{ color: 'var(--color-cream)', fontWeight: 700 }}
          >
            Ver en tienda →
          </Link>
        </div>
      </div>
    </div>
  )
}

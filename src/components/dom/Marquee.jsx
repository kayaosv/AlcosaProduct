import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

const ITEMS = [
  '9000 PUFFS',
  '12.90€',
  'ENVÍO 24H',
  'NEW DROP 06',
  'SABOR ICE BERRY',
  'MADE IN ALCOSA',
  'CLAN VPRS',
  '20% OFF',
]

export const Marquee = ({ angle = -4, color = 'lime' }) => {
  const trackRef = useRef(null)

  useGSAP(() => {
    if (!trackRef.current) return
    const track = trackRef.current
    const distance = track.scrollWidth / 2
    gsap.to(track, {
      x: -distance,
      duration: 28,
      ease: 'none',
      repeat: -1,
    })
  })

  const bg = color === 'lime' ? 'var(--color-lime)' : 'var(--color-navy)'
  const fg = color === 'lime' ? 'var(--color-navy)' : 'var(--color-lime)'

  return (
    <div
      className="relative w-screen overflow-hidden py-4 my-12"
      style={{
        background: bg,
        color: fg,
        transform: `rotate(${angle}deg)`,
        marginLeft: '-2vw',
        width: '104vw',
      }}
    >
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform">
        {[...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-8 px-6 italic"
            style={{ fontWeight: 700, fontSize: 'clamp(1.25rem, 2.4vw, 2.5rem)' }}
          >
            {item}
            <span style={{ fontSize: '0.6em', opacity: 0.6 }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

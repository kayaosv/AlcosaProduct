import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { usePacks } from '../hooks/usePacks.js'
import { PackCard } from '../components/dom/PackCard.jsx'
import { useSeo } from '../hooks/useSeo.js'

export const Packs = () => {
  const containerRef = useRef(null)
  const { packs, loading } = usePacks()

  useSeo({
    title: 'Packs y combos',
    description: 'Packs de Vapers Alcosa — combos de productos a precio de oferta. Tienda en el Parque Alcosa, Sevilla.',
  })

  useGSAP(
    () => {
      if (loading) return
      gsap.from('[data-anim="header"]', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' })
      gsap.from('[data-anim="card"]', { y: 30, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' })
    },
    { scope: containerRef, dependencies: [loading] },
  )

  return (
    <main ref={containerRef} className="min-h-screen pt-32 pb-24">
      <header className="px-6 md:px-10 mb-12" data-anim="header">
        <h1
          className="leading-none"
          style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--color-navy)' }}
        >
          PACKS
        </h1>
        <p className="text-[12px] tracking-[0.2em] uppercase mt-2" style={{ color: 'rgba(23,45,109,0.6)' }}>
          {loading ? 'Cargando…' : `${packs.length} pack${packs.length === 1 ? '' : 's'} disponible${packs.length === 1 ? '' : 's'}`}
        </p>
      </header>

      <section className="px-6 md:px-10">
        {!loading && packs.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[14px] tracking-[0.2em] uppercase" style={{ color: 'rgba(23,45,109,0.6)' }}>
              No hay packs disponibles por ahora.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-8"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            {packs.map((p) => (
              <div key={p.id} data-anim="card">
                <PackCard pack={p} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

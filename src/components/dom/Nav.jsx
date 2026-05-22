import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../../stores/useCartStore.js'
import { useAppStore } from '../../stores/useAppStore.js'

const LINKS = [
  { to: '/catalog', label: 'Tienda' },
  { to: '/catalog?cat=vapers-desechables', label: 'Desechables' },
  { to: '/catalog?cat=sales-de-nicotina', label: 'Sales' },
  { to: '/catalog?cat=vapers', label: 'Vapers' },
]

const NavLink = ({ to, label, onClick }) => {
  const ref = useRef(null)
  const lineRef = useRef(null)
  const { contextSafe } = useGSAP({ scope: ref })

  const onEnter = contextSafe(() => {
    gsap.fromTo(
      lineRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.45, ease: 'power3.out' },
    )
  })
  const onLeave = contextSafe(() => {
    gsap.to(lineRef.current, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: 0.35,
      ease: 'power3.in',
    })
  })

  return (
    <Link
      ref={ref}
      to={to}
      onClick={onClick}
      data-cursor="link"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="relative inline-block py-1"
      style={{ color: 'var(--color-navy)' }}
    >
      {label}
      <span
        ref={lineRef}
        aria-hidden
        className="absolute left-0 right-0 bottom-0 block h-px"
        style={{
          background: 'var(--color-navy)',
          transform: 'scaleX(0)',
          transformOrigin: 'left center',
        }}
      />
    </Link>
  )
}

const MobileMenu = ({ open, onClose }) => {
  const rootRef = useRef(null)
  const panelRef = useRef(null)

  useGSAP(
    () => {
      if (open) {
        gsap.set(rootRef.current, { display: 'block' })
        gsap.to(rootRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' })
        gsap.fromTo(
          panelRef.current,
          { yPercent: -100 },
          { yPercent: 0, duration: 0.55, ease: 'power4.out' },
        )
        gsap.fromTo(
          '[data-mobile-link]',
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.06,
            delay: 0.15,
            ease: 'power3.out',
          },
        )
      } else {
        gsap.to(panelRef.current, {
          yPercent: -100,
          duration: 0.4,
          ease: 'power3.in',
        })
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.3,
          delay: 0.1,
          onComplete: () => gsap.set(rootRef.current, { display: 'none' }),
        })
      }
    },
    { dependencies: [open] },
  )

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200] md:hidden"
      style={{ display: 'none', opacity: 0 }}
    >
      <div
        ref={panelRef}
        className="absolute inset-0 px-6 pt-24 pb-16 flex flex-col"
        style={{ background: 'var(--color-cream)' }}
      >
        <ul className="flex flex-col gap-6">
          {LINKS.map((l) => (
            <li key={l.to} data-mobile-link>
              <Link
                to={l.to}
                onClick={onClose}
                data-cursor="link"
                className="block leading-none"
                style={{
                  fontWeight: 900,
                  fontSize: 'clamp(2.5rem, 10vw, 5rem)',
                  color: 'var(--color-navy)',
                  letterSpacing: '-0.03em',
                }}
              >
                {l.label}.
              </Link>
            </li>
          ))}
        </ul>
        <div data-mobile-link className="mt-12 text-[10px] tracking-[0.3em] uppercase opacity-60">
          Sevilla · Parque Alcosa · Est. 2025
        </div>
      </div>
    </div>
  )
}

export const Nav = () => {
  const navRef = useRef(null)
  const itemsCount = useCartStore((s) => s.items.length)
  const isLoaded = useAppStore((s) => s.isLoaded)
  const setCartOpen = useAppStore((s) => s.setCartOpen)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useGSAP(
    () => {
      gsap.set(navRef.current, { y: -40, opacity: 0 })
      if (!isLoaded) return
      gsap.to(navRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    },
    { dependencies: [isLoaded], scope: navRef },
  )

  return (
    <>
      <header
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          background: scrolled || menuOpen ? 'rgba(255,248,240,0.7)' : 'transparent',
          backdropFilter: scrolled || menuOpen ? 'blur(12px)' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-6 md:px-10 py-5">
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-baseline gap-2"
            data-cursor="link"
            style={{ color: 'var(--color-navy)' }}
          >
            <span style={{ fontWeight: 900, fontSize: '14px', letterSpacing: '-0.02em' }}>
              VAPERS·ALCOSA
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase opacity-60 hidden sm:inline">
              EST·2025
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} label={l.label} />
            ))}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              data-cursor="link"
              className="inline-flex items-center gap-2 px-4 py-2"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-lime)',
                borderRadius: 0,
                fontWeight: 700,
              }}
            >
              <span>▸ Carrito</span>
              {itemsCount > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5"
                  style={{ background: 'var(--color-lime)', color: 'var(--color-navy)', fontWeight: 700 }}
                >
                  {itemsCount}
                </span>
              )}
            </button>
          </nav>

          <div className="md:hidden flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              data-cursor="link"
              aria-label="Abrir carrito"
              className="inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.18em] uppercase"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-lime)',
                fontWeight: 700,
              }}
            >
              ▸ {itemsCount}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              data-cursor="link"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              className="relative w-9 h-9 flex flex-col items-center justify-center gap-1.5"
            >
              <span
                className="block h-px transition-transform duration-300"
                style={{
                  width: 22,
                  background: 'var(--color-navy)',
                  transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none',
                }}
              />
              <span
                className="block h-px transition-transform duration-300"
                style={{
                  width: 22,
                  background: 'var(--color-navy)',
                  transform: menuOpen ? 'translateY(-3px) rotate(-45deg)' : 'none',
                }}
              />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

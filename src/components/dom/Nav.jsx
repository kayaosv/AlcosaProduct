import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../../stores/useCartStore.js'
import { useAppStore } from '../../stores/useAppStore.js'
import { useShopSettings } from '../../hooks/useShopSettings.js'

const LINKS = [
  { to: '/catalog', label: 'Tienda' },
  { to: '/catalog?cat=vapers-desechables', label: 'Desechables' },
  { to: '/catalog?cat=sales-de-nicotina', label: 'Sales' },
  { to: '/catalog?cat=vapers', label: 'Vapers' },
]

const MenuLink = ({ index, to, label, onNavigate }) => {
  const ref = useRef(null)
  const lineRef = useRef(null)
  const textRef = useRef(null)
  const { contextSafe } = useGSAP({ scope: ref })

  const onEnter = contextSafe(() => {
    gsap.to(textRef.current, { color: 'var(--color-lime)', duration: 0.3, ease: 'power2.out' })
    gsap.fromTo(
      lineRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.55, ease: 'power3.out' },
    )
  })
  const onLeave = contextSafe(() => {
    gsap.to(textRef.current, { color: 'var(--color-cream)', duration: 0.3, ease: 'power2.in' })
    gsap.to(lineRef.current, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: 0.4,
      ease: 'power3.in',
    })
  })

  return (
    <li
      ref={ref}
      data-menu-link
      className="relative flex items-start gap-4 md:gap-6 group"
    >
      <span
        className="pt-3 md:pt-5 shrink-0"
        style={{
          fontWeight: 200,
          fontSize: '11px',
          letterSpacing: '0.2em',
          color: 'var(--color-lime)',
        }}
      >
        [{String(index + 1).padStart(2, '0')}]
      </span>
      <Link
        to={to}
        onClick={onNavigate}
        data-cursor="link"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className="relative inline-block leading-[0.95]"
      >
        <span
          ref={textRef}
          className="block"
          style={{
            fontWeight: 900,
            // Piso bajado (era 3.5rem/56px) para que en moviles
            // angostos los labels largos ("Desechables.") entren sin
            // envolver de forma desproporcionada.
            fontSize: 'clamp(2.5rem, 9vw, 7rem)',
            letterSpacing: '-0.04em',
            color: 'var(--color-cream)',
          }}
        >
          {label}.
        </span>
        <span
          ref={lineRef}
          aria-hidden
          className="absolute left-0 right-0 -bottom-1 block h-[2px]"
          style={{
            background: 'var(--color-lime)',
            transform: 'scaleX(0)',
            transformOrigin: 'left center',
          }}
        />
      </Link>
    </li>
  )
}

const MenuOverlay = ({ open, onClose, onOpenCart, itemsCount }) => {
  const overlayRef = useRef(null)

  useGSAP(
    () => {
      gsap.set(overlayRef.current, {
        clipPath: 'circle(0% at 95% 5%)',
        display: 'none',
      })
    },
    { scope: overlayRef },
  )

  useGSAP(
    () => {
      if (open) {
        gsap.set(overlayRef.current, { display: 'flex' })
        gsap.fromTo(
          overlayRef.current,
          { clipPath: 'circle(0% at 95% 5%)' },
          { clipPath: 'circle(150% at 95% 5%)', duration: 0.7, ease: 'power4.inOut' },
        )
        gsap.fromTo(
          '[data-menu-link]',
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.07,
            duration: 0.5,
            delay: 0.25,
            ease: 'power3.out',
          },
        )
        gsap.fromTo(
          '[data-menu-footer]',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, delay: 0.45, ease: 'power2.out' },
        )
        gsap.fromTo(
          '[data-menu-cta]',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.55, ease: 'power3.out' },
        )
      } else {
        gsap.to('[data-menu-link]', {
          y: -30,
          opacity: 0,
          stagger: 0.04,
          duration: 0.3,
          ease: 'power3.in',
        })
        gsap.to(['[data-menu-footer]', '[data-menu-cta]'], {
          opacity: 0,
          duration: 0.2,
        })
        gsap.to(overlayRef.current, {
          clipPath: 'circle(0% at 95% 5%)',
          duration: 0.55,
          delay: 0.15,
          ease: 'power4.inOut',
          onComplete: () => gsap.set(overlayRef.current, { display: 'none' }),
        })
      }
    },
    { dependencies: [open] },
  )

  const handleNavigate = () => onClose()
  const handleCart = () => {
    onClose()
    setTimeout(() => onOpenCart(), 400)
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex-col"
      style={{
        background: 'var(--color-navy)',
        display: 'none',
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-10 py-5 shrink-0">
        <Link
          to="/"
          onClick={handleNavigate}
          data-cursor="link"
          style={{
            color: 'var(--color-cream)',
            fontWeight: 900,
            fontSize: '13px',
            letterSpacing: '-0.02em',
          }}
        >
          VAPERS·ALCOSA
        </Link>
        <button
          type="button"
          onClick={onClose}
          data-cursor="link"
          className="flex items-center justify-center"
          style={{
            color: 'var(--color-cream)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.25em',
            minWidth: 44,
            minHeight: 44,
          }}
        >
          CERRAR
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 overflow-hidden">
        <ul className="flex flex-col gap-2 md:gap-4">
          {LINKS.map((l, i) => (
            <MenuLink
              key={l.to}
              index={i}
              to={l.to}
              label={l.label}
              onNavigate={handleNavigate}
            />
          ))}
        </ul>

        <div data-menu-cta className="mt-10 md:mt-14">
          <button
            type="button"
            onClick={handleCart}
            data-cursor="link"
            className="inline-flex items-center gap-3 px-8 py-3"
            style={{
              background: 'var(--color-lime)',
              color: 'var(--color-navy)',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.22em',
              minHeight: 44,
            }}
          >
            <span>▸ CARRITO</span>
            {itemsCount > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5"
                style={{
                  background: 'var(--color-navy)',
                  color: 'var(--color-lime)',
                  fontWeight: 700,
                }}
              >
                {itemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        data-menu-footer
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 md:px-10 py-6 shrink-0"
        style={{ color: 'var(--color-cream)' }}
      >
        <span
          className="text-[10px] uppercase opacity-60"
          style={{ letterSpacing: '0.3em' }}
        >
          Sevilla · Parque Alcosa · Est. 2025
        </span>
        <span
          className="text-[10px] uppercase opacity-80"
          style={{ letterSpacing: '0.25em' }}
        >
          @vapers.alcosa · 682 72 57 80
        </span>
      </div>
    </div>
  )
}

const CartButton = ({ itemsCount, onOpen, theme }) => {
  const fg = theme === 'dark' ? 'var(--color-cream)' : 'var(--color-navy)'
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cursor="link"
      aria-label={itemsCount > 0 ? `Abrir carrito, ${itemsCount} artículos` : 'Abrir carrito'}
      className="flex items-center justify-center"
      style={{ color: fg, transition: 'color 0.4s ease', minWidth: 44, minHeight: 44 }}
    >
      {/* Badge posicionado contra este wrapper (tamaño real del icono),
          no contra el boton (area tactil ampliada a 44px min) - si no,
          el badge quedaria flotando lejos del icono. */}
      <span className="relative inline-flex">
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemsCount > 0 && (
        <span
          className="absolute top-0 right-0 flex items-center justify-center"
          style={{
            background: 'var(--color-lime)',
            color: 'var(--color-navy)',
            fontWeight: 700,
            fontSize: '9px',
            width: 16,
            height: 16,
            borderRadius: '50%',
            lineHeight: 1,
          }}
        >
          {itemsCount > 9 ? '9+' : itemsCount}
        </span>
      )}
      </span>
    </button>
  )
}

const MenuToggle = ({ open, onToggle, theme }) => {
  const labelRef = useRef(null)
  const { contextSafe } = useGSAP({ scope: labelRef })

  const handleClick = contextSafe(() => {
    gsap.to(labelRef.current, {
      opacity: 0,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: () => {
        onToggle()
        gsap.to(labelRef.current, {
          opacity: 1,
          duration: 0.15,
          delay: 0.05,
          ease: 'power2.out',
        })
      },
    })
  })

  const fg = open || theme === 'dark' ? 'var(--color-cream)' : 'var(--color-navy)'

  return (
    <button
      type="button"
      onClick={handleClick}
      data-cursor="link"
      aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={open}
      className="flex items-center justify-center"
      style={{
        fontWeight: 700,
        fontSize: '13px',
        letterSpacing: '0.25em',
        color: fg,
        transition: 'color 0.4s ease',
        minWidth: 44,
        minHeight: 44,
      }}
    >
      <span ref={labelRef} className="inline-block">
        {open ? 'CERRAR' : 'MENÚ'}
      </span>
    </button>
  )
}

const SCROLL_SOLIDIFY_THRESHOLD = 24

export const Nav = () => {
  const navRef = useRef(null)
  const { settings: shopSettings } = useShopSettings()
  const itemsCount = useCartStore((s) => s.items.length)
  const isLoaded = useAppStore((s) => s.isLoaded)
  const setCartOpen = useAppStore((s) => s.setCartOpen)
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const [scrolled, setScrolled] = useState(false)
  const toggleMenu = () => setOpen((v) => !v)
  const closeMenu = () => setOpen(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const sections = document.querySelectorAll('[data-nav-theme="dark"]')
    if (!sections.length) return
    const visible = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target)
          else visible.delete(entry.target)
        })
        setTheme(visible.size > 0 ? 'dark' : 'light')
      },
      { rootMargin: '-30px 0px -95% 0px', threshold: 0 },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  // Lenis (SmoothScroll) still drives real window scroll under the hood,
  // so a plain scroll listener here tracks it fine.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_SOLIDIFY_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  // Once the header solidifies into its own opaque band, it defines its
  // own contrast — ignore the underlying section's dark/light theme so
  // e.g. cream icons never end up on a cream bar.
  const effectiveTheme = scrolled ? 'light' : theme

  return (
    <>
      <header
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-[100]"
        style={{
          background: scrolled ? 'rgba(255,248,240,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
          boxShadow: scrolled ? '0 1px 0 rgba(23,45,109,0.1)' : 'none',
          transition: 'background 0.35s ease, box-shadow 0.35s ease',
        }}
      >
        {shopSettings?.free_shipping_enabled && shopSettings?.free_shipping_threshold != null && (
          <div
            className="flex items-center justify-center text-center px-4 py-1.5"
            style={{ background: 'var(--color-lime)', color: 'var(--color-navy)' }}
          >
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.12em' }}>
              Envío gratis a partir de {Number(shopSettings.free_shipping_threshold).toFixed(0)} €
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-6 md:px-10 py-6">
          <Link
            to="/"
            onClick={closeMenu}
            data-cursor="link"
            style={{
              color: effectiveTheme === 'dark' ? 'var(--color-cream)' : 'var(--color-navy)',
              fontWeight: 900,
              fontSize: '16px',
              letterSpacing: '-0.02em',
              transition: 'color 0.4s ease',
            }}
          >
            VAPERS·ALCOSA
          </Link>
          <div className="flex items-center gap-1 md:gap-3">
            <CartButton itemsCount={itemsCount} onOpen={() => setCartOpen(true)} theme={effectiveTheme} />
            <MenuToggle open={open} onToggle={toggleMenu} theme={effectiveTheme} />
          </div>
        </div>
      </header>

      <MenuOverlay
        open={open}
        onClose={closeMenu}
        onOpenCart={() => setCartOpen(true)}
        itemsCount={itemsCount}
      />
    </>
  )
}

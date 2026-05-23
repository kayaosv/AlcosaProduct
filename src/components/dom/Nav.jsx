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
            fontSize: 'clamp(3.5rem, 10vw, 7rem)',
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
          className="px-2 py-1"
          style={{
            color: 'var(--color-cream)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.25em',
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

const MenuToggle = ({ open, onToggle, itemsCount, theme }) => {
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
    <div className="flex items-center gap-5">
      {itemsCount > 0 && !open && (
        <span
          className="text-[13px]"
          style={{
            color: 'var(--color-lime)',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          ▸ {itemsCount}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        data-cursor="link"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        className="px-2 py-1"
        style={{
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.25em',
          color: fg,
          transition: 'color 0.4s ease',
        }}
      >
        <span ref={labelRef} className="inline-block">
          {open ? 'CERRAR' : 'MENÚ'}
        </span>
      </button>
    </div>
  )
}

export const Nav = () => {
  const navRef = useRef(null)
  const itemsCount = useCartStore((s) => s.items.length)
  const isLoaded = useAppStore((s) => s.isLoaded)
  const setCartOpen = useAppStore((s) => s.setCartOpen)
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState('light')
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
        className="fixed top-0 left-0 right-0 z-[100]"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center justify-between px-6 md:px-10 py-6">
          <Link
            to="/"
            onClick={closeMenu}
            data-cursor="link"
            style={{
              color: theme === 'dark' ? 'var(--color-cream)' : 'var(--color-navy)',
              fontWeight: 900,
              fontSize: '16px',
              letterSpacing: '-0.02em',
              transition: 'color 0.4s ease',
            }}
          >
            VAPERS·ALCOSA
          </Link>
          <MenuToggle open={open} onToggle={toggleMenu} itemsCount={itemsCount} theme={theme} />
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

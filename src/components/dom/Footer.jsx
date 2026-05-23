import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export const Footer = () => {
  const rootRef = useRef(null)

  useGSAP(
    () => {
      gsap.fromTo(
        '[data-anim="footer-phrase"]',
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          duration: 1.5,
          ease: 'expo.out',
          scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
        },
      )
      gsap.from('[data-anim="footer-block"]', {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        delay: 0.3,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
      })
    },
    { scope: rootRef },
  )

  return (
    <footer
      ref={rootRef}
      data-nav-theme="dark"
      className="relative w-full"
      style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
    >
      <div className="px-6 md:px-10 pt-24 md:pt-40 pb-12 max-w-[1400px] mx-auto">
        <div className="flex justify-between items-start text-[10px] tracking-[0.3em] uppercase opacity-60 mb-16">
          <span>Vapers·Alcosa</span>
          <span>Sevilla · ES</span>
        </div>

        <h2
          data-anim="footer-phrase"
          className="leading-[0.85]"
          style={{
            fontWeight: 900,
            fontSize: 'clamp(3rem, 11vw, 13rem)',
            letterSpacing: '-0.05em',
          }}
        >
          Pásate por <em className="italic" style={{ fontWeight: 200, color: 'var(--color-lime)' }}>la tienda</em>.
        </h2>

        <div className="mt-20 md:mt-32 grid grid-cols-12 gap-y-12 gap-x-6">
          <div data-anim="footer-block" className="col-span-12 md:col-span-5">
            <span
              className="block text-[10px] tracking-[0.3em] uppercase mb-4"
              style={{ color: 'var(--color-blue)' }}
            >
              ↳ Dirección
            </span>
            <p className="text-[15px] leading-relaxed" style={{ fontWeight: 700 }}>
              Av. Ildefonso Marañón Lavín
              <br />
              Nº 9 — Local 2
            </p>
            <p className="text-[13px] mt-2" style={{ color: 'rgba(255,248,240,0.6)' }}>
              41019 Sevilla · Parque Alcosa
            </p>
          </div>

          <div data-anim="footer-block" className="col-span-6 md:col-span-4">
            <span
              className="block text-[10px] tracking-[0.3em] uppercase mb-4"
              style={{ color: 'var(--color-blue)' }}
            >
              ↳ Horario
            </span>
            <p className="text-[13px] leading-relaxed">
              <span style={{ fontWeight: 700 }}>L–V</span>{' '}
              <span style={{ color: 'rgba(255,248,240,0.7)' }}>
                10:00–14:30 / 17:30–21:30
              </span>
            </p>
            <p className="text-[13px] leading-relaxed mt-1">
              <span style={{ fontWeight: 700 }}>Sáb</span>{' '}
              <span style={{ color: 'rgba(255,248,240,0.7)' }}>10:00–14:00</span>
            </p>
            <p className="text-[13px] leading-relaxed mt-1">
              <span style={{ fontWeight: 700 }}>Dom</span>{' '}
              <span style={{ color: 'rgba(255,248,240,0.4)' }}>Cerrado</span>
            </p>
          </div>

          <div data-anim="footer-block" className="col-span-6 md:col-span-3">
            <span
              className="block text-[10px] tracking-[0.3em] uppercase mb-4"
              style={{ color: 'var(--color-blue)' }}
            >
              ↳ Contacto
            </span>
            <a
              href="tel:+34682725780"
              data-cursor="link"
              className="block text-[15px]"
              style={{ fontWeight: 700 }}
            >
              682 72 57 80
            </a>
            <a
              href="https://instagram.com/vapers.alcosa"
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className="block text-[13px] mt-3 underline underline-offset-4"
            >
              @vapers.alcosa
            </a>
            <a
              href="#"
              data-cursor="link"
              className="block text-[13px] mt-1 underline underline-offset-4"
              style={{ color: 'rgba(255,248,240,0.7)' }}
            >
              TikTok
            </a>
          </div>

          <div
            data-anim="footer-block"
            className="col-span-12 md:col-start-1 md:col-span-8 mt-4"
          >
            <p
              className="text-[12px] tracking-[0.15em] uppercase leading-relaxed"
              style={{ color: 'rgba(255,248,240,0.5)' }}
            >
              Solo tienda física. Para consultas{' '}
              <a
                href="https://instagram.com/vapers.alcosa"
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="link"
                style={{ color: 'var(--color-lime)' }}
              >
                escríbenos en Instagram
              </a>
              .
            </p>
          </div>
        </div>

        <div
          className="mt-24 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
          style={{ borderTop: '1px solid rgba(255,248,240,0.15)' }}
        >
          <span
            className="text-[10px] tracking-[0.3em] uppercase"
            style={{ color: 'rgba(255,248,240,0.5)' }}
          >
            VAPERS ALCOSA · © 2026 · Sevilla, España
          </span>
          <div
            className="flex gap-4 text-[10px] tracking-[0.25em] uppercase"
            style={{ color: 'rgba(255,248,240,0.4)' }}
          >
            <a href="#" data-cursor="link">+18</a>
            <a href="#" data-cursor="link">Aviso legal</a>
            <a href="#" data-cursor="link">Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

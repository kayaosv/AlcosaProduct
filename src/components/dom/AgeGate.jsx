import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.js'

// Puerta de verificacion de edad a la entrada del sitio, mostrada una vez
// el Preloader termina (Preloader -> AgeGate -> web). Requisito legal para
// venta de vapeo (Ley 3/2014, RD 579/2017) - se muestra una sola vez por
// navegador (persistida via useAppStore.confirmAge en localStorage).
export const AgeGate = () => {
  const confirmAge = useAppStore((s) => s.confirmAge)
  const [rejected, setRejected] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
      style={{ background: 'var(--color-dark)', color: 'var(--color-cream)' }}
    >
      <div className="max-w-md text-center">
        {!rejected ? (
          <>
            <span className="block text-[10px] tracking-[0.3em] uppercase opacity-70 mb-6">
              Vapers·Alcosa — Verificación de edad
            </span>
            <h1
              className="leading-[0.95] mb-6"
              style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}
            >
              ¿ERES MAYOR DE 18 AÑOS?
            </h1>
            <p className="text-[13px] leading-relaxed opacity-70 mb-10">
              Este sitio vende productos de vapeo con nicotina. Su venta está restringida a
              personas mayores de edad conforme a la Ley 3/2014 y el RD 579/2017.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={confirmAge}
                data-cursor="link"
                className="px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
                style={{ background: 'var(--color-lime)', color: 'var(--color-navy)', fontWeight: 900 }}
              >
                ▸ Sí, soy mayor de edad
              </button>
              <button
                type="button"
                onClick={() => setRejected(true)}
                data-cursor="link"
                className="px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
                style={{ border: '1px solid rgba(255,248,240,0.3)', color: 'var(--color-cream)', fontWeight: 700 }}
              >
                No
              </button>
            </div>
          </>
        ) : (
          <>
            <h1
              className="leading-[0.95] mb-6"
              style={{ fontWeight: 900, fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)' }}
            >
              LO SENTIMOS.
            </h1>
            <p className="text-[13px] leading-relaxed opacity-70">
              Este sitio es exclusivamente para mayores de edad. No puedes continuar.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

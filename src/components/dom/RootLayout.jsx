import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from './Nav.jsx'
import { CustomCursor } from './CustomCursor.jsx'
import { CartDrawer } from './CartDrawer.jsx'
import { SmoothScroll, useLenis } from './SmoothScroll.jsx'
import { Preloader } from './Preloader.jsx'
import { AgeGate } from './AgeGate.jsx'
import { SectionTransitions } from './SectionTransitions.jsx'
import { useAppStore } from '../../stores/useAppStore.js'
import { shouldSimplifyVisuals } from '../../lib/deviceCapability.js'

// Import dinamico: three.js/fiber/drei no se descargan en absoluto en
// rutas que no lo necesitan (View.Port solo lo usa BestSellersSection,
// solo en home) ni con prefers-reduced-motion activo.
const SharedCanvas = lazy(() =>
  import('../three/SharedCanvas.jsx').then((m) => ({ default: m.SharedCanvas })),
)

// Vive dentro de <SmoothScroll> (no en RootLayout directamente) porque
// useLenis() necesita ser descendiente del Provider, no el componente
// que lo renderiza.
const RootLayoutInner = () => {
  const isLoaded = useAppStore((s) => s.isLoaded)
  const ageVerified = useAppStore((s) => s.ageVerified)
  const location = useLocation()
  const lenisRef = useLenis()
  const [simplify] = useState(shouldSimplifyVisuals)
  const isHome = location.pathname === '/'
  const needsCanvas = !simplify && isHome

  // Once preloader unmounts, recompute ScrollTrigger positions.
  useEffect(() => {
    if (!isLoaded) return
    // Two rAF frames: first lets Lenis complete its initial tick,
    // second lets the DOM settle before ScrollTrigger measures positions.
    let id2
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2) }
  }, [isLoaded])

  // Lenis (no el navegador) es dueño de la posicion de scroll y
  // RootLayout nunca se remonta entre rutas (history.scrollRestoration
  // = 'manual' en main.jsx, sin reemplazo hasta ahora) — sin esto, cada
  // <Link> (catalogo, legales del footer, etc.) llegaba dejando el
  // scroll donde haya quedado la pagina anterior en vez de arrancar en
  // el inicio de la seccion nueva.
  useEffect(() => {
    lenisRef?.current?.scrollTo(0, { immediate: true })
  }, [location.pathname, lenisRef])

  return (
    <>
      {!isLoaded && <Preloader />}
      {isLoaded && !ageVerified && <AgeGate />}
      {/* Solo Home tiene [data-section]/data-transition-type — montado
          siempre, estas planas/circulo fixed 100vw+200vmax quedaban en
          el DOM en cualquier otra ruta con el ultimo estado de scroll
          de Home (useGSAP acá solo mide las secciones una vez, no se
          reinicia al navegar), tapando el catalogo con el negro/lima. */}
      {isHome && <SectionTransitions />}
      <CustomCursor />
      <Nav />
      <Outlet />
      <CartDrawer />
      {needsCanvas && (
        <Suspense fallback={null}>
          <SharedCanvas />
        </Suspense>
      )}
    </>
  )
}

export const RootLayout = () => (
  <SmoothScroll>
    <RootLayoutInner />
  </SmoothScroll>
)

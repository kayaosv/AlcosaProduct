import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from './Nav.jsx'
import { CustomCursor } from './CustomCursor.jsx'
import { CartDrawer } from './CartDrawer.jsx'
import { SmoothScroll } from './SmoothScroll.jsx'
import { Preloader } from './Preloader.jsx'
import { AgeGate } from './AgeGate.jsx'
import { SectionTransitions } from './SectionTransitions.jsx'
import { useAppStore } from '../../stores/useAppStore.js'
import { shouldSimplifyVisuals } from '../../lib/deviceCapability.js'

// Import dinamico: three.js/fiber/drei no se descargan en absoluto en
// rutas que no lo necesitan (View.Port solo lo usa BestSellersSection,
// solo en home) ni en dispositivos simplificados.
const SharedCanvas = lazy(() =>
  import('./SharedCanvas.jsx').then((m) => ({ default: m.SharedCanvas })),
)

export const RootLayout = () => {
  const isLoaded = useAppStore((s) => s.isLoaded)
  const ageVerified = useAppStore((s) => s.ageVerified)
  const location = useLocation()
  const [simplify] = useState(shouldSimplifyVisuals)
  const needsCanvas = !simplify && location.pathname === '/'

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

  return (
    <SmoothScroll>
      {!isLoaded && <Preloader />}
      {isLoaded && !ageVerified && <AgeGate />}
      <SectionTransitions />
      <CustomCursor />
      <Nav />
      <Outlet />
      <CartDrawer />
      {needsCanvas && (
        <Suspense fallback={null}>
          <SharedCanvas />
        </Suspense>
      )}
    </SmoothScroll>
  )
}

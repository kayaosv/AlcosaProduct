import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from './Nav.jsx'
import { CustomCursor } from './CustomCursor.jsx'
import { CartDrawer } from './CartDrawer.jsx'
import { SmoothScroll } from './SmoothScroll.jsx'
import { Preloader } from './Preloader.jsx'
import { SectionTransitions } from './SectionTransitions.jsx'
import { useAppStore } from '../../stores/useAppStore.js'

export const RootLayout = () => {
  const isLoaded = useAppStore((s) => s.isLoaded)

  // Once preloader unmounts, recompute ScrollTrigger positions.
  useEffect(() => {
    if (!isLoaded) return
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [isLoaded])

  return (
    <SmoothScroll>
      {!isLoaded && <Preloader />}
      <SectionTransitions />
      <CustomCursor />
      <Nav />
      <Outlet />
      <CartDrawer />
      <Canvas
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: 'transparent',
        }}
        gl={{ antialias: false, alpha: true }}
        dpr={[1, 1.5]}
      >
        <View.Port />
      </Canvas>
    </SmoothScroll>
  )
}

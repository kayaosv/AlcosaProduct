import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { router } from './config/routes.jsx'
import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'
import { useAppStore } from './stores/useAppStore.js'
import { SmoothScroll } from './components/dom/SmoothScroll.jsx'
import { Preloader } from './components/dom/Preloader.jsx'
import { SectionTransitions } from './components/dom/SectionTransitions.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

export const App = () => {
  const isLoaded = useAppStore((s) => s.isLoaded)

  // Once preloader unmounts, recompute ScrollTrigger positions (preloader was
  // fixed inset-0 z-9999 during initial layout and broke trigger offsets).
  useEffect(() => {
    if (!isLoaded) return
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [isLoaded])

  return (
    <SmoothScroll>
      {!isLoaded && <Preloader />}
      <SectionTransitions />
      <RouterProvider router={router} />
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

import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'

// Extraido a su propio archivo para poder cargarlo con import() dinamico
// desde RootLayout.jsx - asi three.js/fiber/drei no se descargan en
// absoluto en rutas que no lo necesitan (todo salvo home) ni en
// dispositivos simplificados (ver deviceCapability.js).
export const SharedCanvas = () => (
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
)

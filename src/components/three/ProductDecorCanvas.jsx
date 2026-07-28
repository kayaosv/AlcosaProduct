import { useRef } from 'react'
import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, useGLTF } from '@react-three/drei'

// Extraido de Product.jsx a su propio archivo para poder cargarlo con
// import() dinamico - es puramente decorativo (fondo desenfocado tras
// el selector de variantes en pantallas lg+), asi que en movil/tablet/
// reduced-motion o pantallas angostas ni siquiera se descarga three.js
// para esto. Ver deviceCapability.js y su uso en Product.jsx.
const ProductVape = () => {
  const ref = useRef(null)
  const { scene } = useGLTF('/models/vape.glb')
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.4
  })
  return (
    <Float floatIntensity={0.3} speed={1}>
      <primitive ref={ref} object={scene.clone()} scale={2.2} />
    </Float>
  )
}

export const ProductDecorCanvas = () => (
  <Canvas
    dpr={[1, 1.5]}
    gl={{ antialias: true, alpha: true }}
    camera={{ position: [0, 0, 5], fov: 35 }}
    className="!absolute inset-0 pointer-events-none"
    style={{ zIndex: 0 }}
  >
    <ambientLight intensity={0.5} />
    <directionalLight position={[3, 4, 3]} intensity={1} color="#C6F91F" />
    <directionalLight position={[-3, -2, 2]} intensity={0.5} color="#5B8EE8" />
    <Suspense fallback={null}>
      <ProductVape />
    </Suspense>
    {/* Alojado localmente (public/hdri), ver HeroCanvas.jsx */}
    <Environment files="/hdri/studio_small_03_1k.hdr" />
  </Canvas>
)

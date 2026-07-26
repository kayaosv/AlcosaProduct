import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Environment, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { Suspense, useRef } from 'react'

useGLTF.preload('/models/vape.glb')

const VapeModel = () => {
  const ref = useRef(null)
  const { scene } = useGLTF('/models/vape.glb')
  // El FOV de three.js es vertical - el ancho visible en profundidad
  // depende de la relacion de aspecto del viewport. Un desplazamiento
  // fijo en X (pensado para desktop, aspecto ancho) cae fuera de
  // cuadro en movil (aspecto angosto y alto). `viewport.width` ya
  // calcula el ancho visible real en unidades de mundo para el
  // aspecto actual - usar una fraccion de eso en vez de un valor fijo
  // mantiene el modelo dentro de cuadro en cualquier dispositivo.
  const viewportWidth = useThree((state) => state.viewport.width)
  const xOffset = Math.min(1.4, viewportWidth * 0.22)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.25
  })

  return (
    <Float speed={1.5} floatIntensity={0.4} rotationIntensity={0.25}>
      <primitive
        ref={ref}
        object={scene}
        scale={0.9}
        position={[xOffset, -0.2, 0]}
        rotation={[0, -0.4, 0.15]}
      />
    </Float>
  )
}

const Sparks = () => {
  const group = useRef(null)
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y = state.clock.elapsedTime * 0.05
  })
  return (
    <group ref={group}>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2
        const r = 3 + (i % 3) * 0.4
        return (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(a * 1.4) * 1.2, Math.sin(a) * r]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={i % 4 === 0 ? '#C6F91F' : '#FFF8F0'} />
          </mesh>
        )
      })}
    </group>
  )
}

export const HeroCanvas = () => (
  <Canvas
    className="!fixed inset-0"
    style={{ zIndex: 0 }}
    dpr={[1, 1.5]}
    gl={{ antialias: false, alpha: true }}
    camera={{ position: [0, 0, 6], fov: 38 }}
  >
    <ambientLight intensity={0.4} />
    <directionalLight position={[5, 5, 5]} intensity={1.2} color="#C6F91F" />
    <directionalLight position={[-5, -2, 3]} intensity={0.6} color="#5B8EE8" />
    <Suspense fallback={null}>
      <VapeModel />
    </Suspense>
    <Sparks />
    <Environment preset="studio" />
    <EffectComposer>
      <Bloom intensity={0.35} luminanceThreshold={0.7} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  </Canvas>
)

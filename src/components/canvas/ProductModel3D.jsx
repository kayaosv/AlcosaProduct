import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, useGLTF } from '@react-three/drei'
import gsap from 'gsap'

export const ProductModel3D = ({ model, isHovered = false }) => {
  const { scene } = useGLTF(model)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const meshRef = useRef(null)
  const hoverTweenRef = useRef(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (hoverTweenRef.current && hoverTweenRef.current.isActive()) return
    meshRef.current.rotation.y += delta * 0.4
  })

  useEffect(() => {
    if (!meshRef.current) return
    if (isHovered) {
      hoverTweenRef.current = gsap.to(meshRef.current.rotation, {
        y: meshRef.current.rotation.y + Math.PI,
        duration: 0.8,
        ease: 'power2.inOut',
      })
      gsap.to(meshRef.current.scale, {
        x: 1.1, y: 1.1, z: 1.1,
        duration: 0.3,
        ease: 'back.out(2)',
      })
    } else {
      gsap.to(meshRef.current.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }, [isHovered])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.5} />
      <pointLight position={[-3, 0, -2]} intensity={0.6} color="#5B8EE8" />
      <Float speed={1.2} floatIntensity={0.3} rotationIntensity={0.2}>
        <primitive ref={meshRef} object={clonedScene} />
      </Float>
    </>
  )
}

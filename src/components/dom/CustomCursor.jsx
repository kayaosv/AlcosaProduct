import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useAppStore } from '../../stores/useAppStore.js'

const isCoarsePointer = () => {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(pointer: coarse)').matches
}

export const CustomCursor = () => {
  const dotRef = useRef(null)
  const followerRef = useRef(null)
  const variant = useAppStore((s) => s.cursorVariant)
  const [coarse, setCoarse] = useState(isCoarsePointer)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = (e) => setCoarse(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (coarse) return
    const dot = dotRef.current
    const follower = followerRef.current
    if (!dot || !follower) return

    const xDot = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3.out' })
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3.out' })
    const xFol = gsap.quickTo(follower, 'x', { duration: 0.45, ease: 'power3.out' })
    const yFol = gsap.quickTo(follower, 'y', { duration: 0.45, ease: 'power3.out' })

    const onMove = (e) => {
      xDot(e.clientX)
      yDot(e.clientY)
      xFol(e.clientX)
      yFol(e.clientY)
    }
    const onOver = (e) => {
      const target = e.target.closest('[data-cursor]')
      const next = target ? target.getAttribute('data-cursor') : 'default'
      if (next !== useAppStore.getState().cursorVariant) {
        useAppStore.setState({ cursorVariant: next })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
    }
  }, [coarse])

  useEffect(() => {
    if (coarse) return
    const follower = followerRef.current
    if (!follower) return

    if (variant === 'link') {
      gsap.to(follower, {
        scale: 2.5,
        duration: 0.4,
        ease: 'power3.out',
        backgroundColor: 'rgba(198,249,31,0.25)',
      })
    } else if (variant === 'text') {
      gsap.to(follower, { scaleX: 1.5, scaleY: 0.1, duration: 0.4, ease: 'power3.out' })
    } else {
      gsap.to(follower, {
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.4,
        ease: 'power3.out',
        backgroundColor: 'rgba(255,255,255,0)',
      })
    }
  }, [variant, coarse])

  if (coarse) return null

  return (
    <>
      <div
        ref={followerRef}
        className="pointer-events-none fixed top-0 left-0 z-[99998] rounded-full border"
        style={{
          width: 40,
          height: 40,
          marginLeft: -20,
          marginTop: -20,
          borderColor: 'var(--color-navy)',
          willChange: 'transform',
        }}
      />
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[99999] rounded-full"
        style={{
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          background: 'var(--color-cream)',
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />
    </>
  )
}

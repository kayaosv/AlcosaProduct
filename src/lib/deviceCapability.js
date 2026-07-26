// Heuristicas de capacidad de dispositivo para decidir cuando saltar
// efectos 3D pesados (postprocesado, HDRI, modelos rotando en loop
// continuo). No hay forma fiable de medir la potencia real de un GPU
// desde JS, asi que se usan dos señales baratas y ya usadas en el
// proyecto:
//
// - `prefers-reduced-motion`: preferencia explicita del usuario, se
//   respeta sin importar el dispositivo.
// - `pointer: coarse` (tactil): mismo criterio que ya usa
//   CustomCursor.jsx para desactivarse en movil/tablet - el 3D pesado
//   es justo donde mas golpea el rendimiento en gama baja, y coincide
//   con los mismos dispositivos que no se benefician del hover 3D de
//   todas formas (sin mouse no hay hover). Esto simplifica tambien en
//   tablets/moviles de gama alta - compromiso deliberado: preferimos
//   quedarnos cortos en dispositivos potentes antes que arriesgar jank
//   en uno debil, en vez de intentar adivinar RAM/CPU (APIs no
//   soportadas en Safari/iOS y poco fiables en general).
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const shouldSimplifyVisuals = () => {
  if (typeof window === 'undefined') return false
  return prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches
}

// Ancho minimo desde el que un elemento 3D puramente decorativo (no
// interactivo) se considera visible - coincide con el breakpoint `lg`
// de Tailwind, usado por Product.jsx para su canvas de fondo.
export const isDesktopViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

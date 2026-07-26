// Heuristicas de capacidad de dispositivo para decidir cuando saltar
// efectos 3D pesados (postprocesado, HDRI, modelos rotando en loop
// continuo).
//
// CORRECCION (2026-07-26): la primera version tambien usaba `pointer:
// coarse` (tactil) como señal de "gama baja", igual que CustomCursor.jsx
// - pero eso apaga el 3D en CUALQUIER tablet/movil sin importar su
// potencia real (confirmado: una tablet TCL capaz se quedaba sin
// modelo). Tactil no es sinonimo de debil. Ahora `shouldSimplifyVisuals`
// solo respeta `prefers-reduced-motion` (preferencia explicita del
// usuario) - el control real de cuando cargar el 3D pesado pasa a ser
// visibilidad en viewport (ver useInView.js), no tipo de dispositivo:
// se carga cuando la seccion esta por aparecer, nunca antes, y se ve en
// cualquier dispositivo capaz de hacerlo, tactil o no.
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const shouldSimplifyVisuals = () => prefersReducedMotion()

// Ancho minimo desde el que un elemento 3D puramente decorativo (no
// interactivo) se considera visible - coincide con el breakpoint `lg`
// de Tailwind, usado por Product.jsx para su canvas de fondo.
export const isDesktopViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

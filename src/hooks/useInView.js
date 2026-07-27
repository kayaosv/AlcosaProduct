import { useEffect, useRef, useState } from 'react'

// Devuelve [ref, inView] - inView pasa a true la primera vez que el
// elemento entra en el viewport (o se acerca, via rootMargin) y se
// queda en true - no vuelve a false al salir, para no desmontar/
// remontar contenido pesado (3D) en cada scroll de ida y vuelta.
// rootMargin por defecto adelanta la carga ~200px antes de que el
// elemento sea realmente visible, para que ya este listo al llegar.
//
// Acepta un ref externo opcional (segundo argumento) para reusar un
// ref que el componente ya tenga en el mismo nodo (ej. el scope de un
// useGSAP) en vez de forzar dos refs distintos sobre el mismo elemento.
export const useInView = (rootMargin = '200px', externalRef) => {
  const internalRef = useRef(null)
  const ref = externalRef ?? internalRef
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, rootMargin])

  return [ref, inView]
}

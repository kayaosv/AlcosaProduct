import { useEffect } from 'react'

const SITE_NAME = 'Vapers Alcosa'

// Sin react-helmet: el sitio es una SPA cliente-only (Vite, sin SSR), y
// esto es la unica pagina que existe (index.html) - manipular
// document.head directo evita sumar una dependencia para algo que son
// unas pocas lineas. Importante: esto ayuda al indexado real de Google
// (Googlebot ejecuta JS), pero NO a las tarjetas de vista previa de
// WhatsApp/Facebook/Twitter - esos bots leen el HTML crudo sin ejecutar
// JS, asi que siempre ven los defaults estaticos de index.html. Para que
// una URL de producto muestre su propia foto/precio al compartirse por
// WhatsApp hace falta pre-renderizado o una funcion serverless que
// detecte bots - no encarado en esta tanda, ver STATUS.md.
const setMeta = (attr, key, value) => {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!value) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

const setCanonical = (href) => {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// title/description/image por pagina; noindex para paginas transaccionales
// (carrito, checkout, pago) que no aportan nada indexadas y compiten con
// la ficha de producto real por las mismas palabras clave.
export const useSeo = ({ title, description, image, type = 'website', noindex = false } = {}) => {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Tienda de vapeo en Sevilla`

    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('property', 'og:site_name', SITE_NAME)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', window.location.origin + window.location.pathname)
    setMeta('property', 'og:image', image || `${window.location.origin}/va-favicon.svg`)
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null)
    setCanonical(window.location.origin + window.location.pathname)
  }, [title, description, image, type, noindex])
}

// JSON-LD (schema.org) - Googlebot si lo lee para resultados enriquecidos
// (precio/disponibilidad en el propio resultado de busqueda). `data` en
// null quita el script (producto no encontrado/descargando).
export const useJsonLd = (id, data) => {
  useEffect(() => {
    let el = document.getElementById(id)
    if (!data) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('script')
      el.id = id
      el.type = 'application/ld+json'
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(data)
    return () => { el?.remove() }
  }, [id, data])
}

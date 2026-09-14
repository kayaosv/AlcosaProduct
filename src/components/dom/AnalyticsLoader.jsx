import { useEffect } from 'react'
import { useShopSettings } from '../../hooks/useShopSettings.js'

// Carga gtag.js (GA4) y/o el Pixel de Meta SOLO si el cliente cargó un ID
// real en /admin/settings (shop_settings.seo_ga4_id/seo_meta_pixel_id) —
// nunca se inventa un ID de prueba, así que sin configurar no se inyecta
// ningún script de tracking. Vive en RootLayout (páginas públicas), nunca
// en /admin.
export const AnalyticsLoader = () => {
  const { settings } = useShopSettings()
  const ga4Id = settings?.seo_ga4_id
  const pixelId = settings?.seo_meta_pixel_id

  useEffect(() => {
    if (!ga4Id || document.getElementById('ga4-gtag-src')) return

    const script = document.createElement('script')
    script.id = 'ga4-gtag-src'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`
    document.head.appendChild(script)

    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', ga4Id)
  }, [ga4Id])

  useEffect(() => {
    if (!pixelId || window.fbq) return

    // Snippet oficial de Meta Pixel (facebook.com/business/help), sin
    // modificar la lógica — solo traducido a un useEffect.
    ;(function (f, b, e, v, n, t, s) {
      if (f.fbq) return
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      }
      if (!f._fbq) f._fbq = n
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []
      t = b.createElement(e)
      t.async = true
      t.src = v
      s = b.getElementsByTagName(e)[0]
      s.parentNode.insertBefore(t, s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

    window.fbq('init', pixelId)
    window.fbq('track', 'PageView')
  }, [pixelId])

  return null
}

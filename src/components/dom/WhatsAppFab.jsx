import { useLocation } from 'react-router-dom'
import { useShopSettings } from '../../hooks/useShopSettings.js'

const GENERIC_MESSAGE = 'Hola, quiero hacer una consulta 🙂'

const WhatsAppIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.6 6.3A8.9 8.9 0 0 0 12.04 3.5a8.9 8.9 0 0 0-7.7 13.4L3 21l4.2-1.3a8.9 8.9 0 0 0 4.84 1.4h.01a8.9 8.9 0 0 0 8.9-8.9 8.9 8.9 0 0 0-2.35-6.1zM12.05 19.4h-.01a7.4 7.4 0 0 1-3.77-1.03l-.27-.16-2.8.87.9-2.72-.18-.28a7.4 7.4 0 1 1 6.13 3.32zm4.06-5.54c-.22-.11-1.3-.64-1.5-.72-.2-.07-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.16-.48.05a6.1 6.1 0 0 1-1.79-1.1 6.7 6.7 0 0 1-1.24-1.55c-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.4.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.4-.06-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.4.06-.6.28-.22.22-.83.81-.83 1.98s.85 2.3.97 2.46c.11.15 1.68 2.57 4.08 3.6.57.25 1.02.4 1.36.5.57.18 1.09.16 1.5.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.2-.16-.42-.27z" />
  </svg>
)

// Boton flotante generico de "hablar con la tienda" - a diferencia de
// los links de WhatsApp del checkout/pago (que arman el mensaje con el
// carrito), este es un mensaje fijo sin datos de pedido, para cualquier
// consulta suelta. Reutiliza el mismo numero que ya usa el flujo de pago
// (shop_settings.payment_whatsapp_phone) - es el WhatsApp real de la
// tienda, no un numero aparte. Vive en RootLayout, asi que solo aparece
// en paginas publicas, nunca en /admin.
export const WhatsAppFab = () => {
  const { settings } = useShopSettings()
  const location = useLocation()

  const phone = settings?.payment_whatsapp_phone
  // /pago/:draftId ya tiene su propio CTA de WhatsApp prominente (con el
  // carrito adjunto) - mostrar tambien el generico ahi compite con ese
  // botón y confunde cuál usar.
  if (!phone || location.pathname.startsWith('/pago/')) return null

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(GENERIC_MESSAGE)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="link"
      aria-label="Hablar con la tienda por WhatsApp"
      className="fixed bottom-6 right-6 z-[150] flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-105"
      style={{ background: '#25D366', color: '#0b3d24' }}
    >
      <WhatsAppIcon />
    </a>
  )
}

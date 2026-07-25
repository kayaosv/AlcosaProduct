import { create } from 'zustand'

const AGE_VERIFIED_KEY = 'alcosa_age_verified'

const readAgeVerified = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AGE_VERIFIED_KEY) === '1'
}

export const useAppStore = create((set) => ({
  isLoaded: false,
  setLoaded: (isLoaded) => set({ isLoaded }),

  // Verificacion de edad al entrar al sitio (Preloader -> AgeGate -> web).
  // Persistida en localStorage para no repetir el aviso en cada visita.
  ageVerified: readAgeVerified(),
  confirmAge: () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(AGE_VERIFIED_KEY, '1')
    set({ ageVerified: true })
  },

  activeSection: null,
  setActiveSection: (activeSection) => set({ activeSection }),

  cursorVariant: 'default',
  setCursorVariant: (cursorVariant) => set({ cursorVariant }),

  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
}))

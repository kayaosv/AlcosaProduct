import { create } from 'zustand'

export const useAppStore = create((set) => ({
  isLoaded: false,
  setLoaded: (isLoaded) => set({ isLoaded }),

  // Verificacion de edad al entrar al sitio (Preloader -> AgeGate -> web).
  // Deliberadamente SIN persistir en localStorage - el cliente pidio
  // que aparezca siempre, en cada carga nueva del sitio (recarga o
  // visita), no solo la primera vez. Dentro de una misma sesion de SPA
  // ya cargada no vuelve a pedirse (navegar entre paginas no remonta
  // RootLayout), pero cualquier carga fresca del sitio la vuelve a
  // pedir.
  ageVerified: false,
  confirmAge: () => set({ ageVerified: true }),

  activeSection: null,
  setActiveSection: (activeSection) => set({ activeSection }),

  cursorVariant: 'default',
  setCursorVariant: (cursorVariant) => set({ cursorVariant }),

  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
}))

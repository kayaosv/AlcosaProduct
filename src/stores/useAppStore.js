import { create } from 'zustand'

export const useAppStore = create((set) => ({
  isLoaded: false,
  setLoaded: (isLoaded) => set({ isLoaded }),

  activeSection: null,
  setActiveSection: (activeSection) => set({ activeSection }),

  cursorVariant: 'default',
  setCursorVariant: (cursorVariant) => set({ cursorVariant }),

  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
}))

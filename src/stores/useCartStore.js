import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Normalizes undefined/null so carts saved before variant support (no
// variantId field at all) still match correctly against new items.
const sameLine = (item, productId, variantId) =>
  item.productId === productId && (item.variantId ?? null) === (variantId ?? null)

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const items = get().items
        const variantId = item.variantId ?? null
        const existing = items.find((i) => sameLine(i, item.productId, variantId))
        if (existing) {
          set({
            items: items.map((i) =>
              sameLine(i, item.productId, variantId)
                ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                : i,
            ),
          })
        } else {
          set({ items: [...items, { ...item, variantId, quantity: item.quantity ?? 1 }] })
        }
      },

      removeItem: (productId, variantId = null) =>
        set({ items: get().items.filter((i) => !sameLine(i, productId, variantId)) }),

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => !sameLine(i, productId, variantId)) })
          return
        }
        set({
          items: get().items.map((i) =>
            sameLine(i, productId, variantId) ? { ...i, quantity } : i,
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },
    }),
    { name: 'vapers-cart' },
  ),
)

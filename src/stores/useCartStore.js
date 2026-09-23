import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Normalizes undefined/null so carts saved before variant support (no
// variantId field at all) still match correctly against new items. Una
// línea de pack se identifica por packId (productId/variantId van null
// en ese caso) — nunca colisiona con una línea de producto normal.
const sameLine = (item, productId, variantId, packId = null) =>
  packId != null || item.packId != null
    ? item.packId === packId
    : item.productId === productId && (item.variantId ?? null) === (variantId ?? null)

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const items = get().items
        const variantId = item.variantId ?? null
        const packId = item.packId ?? null
        const existing = items.find((i) => sameLine(i, item.productId, variantId, packId))
        if (existing) {
          set({
            items: items.map((i) =>
              sameLine(i, item.productId, variantId, packId)
                ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                : i,
            ),
          })
        } else {
          set({ items: [...items, { ...item, variantId, packId, quantity: item.quantity ?? 1 }] })
        }
      },

      removeItem: (productId, variantId = null, packId = null) =>
        set({ items: get().items.filter((i) => !sameLine(i, productId, variantId, packId)) }),

      updateQuantity: (productId, variantId, quantity, packId = null) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => !sameLine(i, productId, variantId, packId)) })
          return
        }
        set({
          items: get().items.map((i) =>
            sameLine(i, productId, variantId, packId) ? { ...i, quantity } : i,
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

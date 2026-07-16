// Specs por categoría (clave = slug en DB).
// Define qué campos viven dentro del JSONB `details` para cada categoría
// y los colores que las cards/pills usan en el panel.

export const CATEGORY_META = {
  'sales-de-nicotina':  { color: '#e53935', kind: 'sales',       variantType: 'nic'    },
  'longfill':           { color: '#8b5cf6', kind: 'longfill',    variantType: 'volume' },
  'minilongfill':       { color: '#7c3aed', kind: 'longfill',    variantType: 'volume' },
  'vapers':             { color: '#3b82f6', kind: 'vapers',      variantType: 'color'  },
  'vapers-desechables': { color: '#f59e0b', kind: 'desechables', variantType: 'flavor' },
  'alquimia':           { color: '#10b981', kind: 'alquimia',    variantType: 'recipe' },
  'accesorios':         { color: '#6b7280', kind: 'accesorios',  variantType: null     },
  'cbd':                { color: '#16a34a', kind: 'accesorios',  variantType: null     },
  'resistencia':        { color: '#f97316', kind: 'accesorios',  variantType: 'ohm'   },
  'parafernalia':       { color: '#ec4899', kind: 'accesorios',  variantType: null     },
  'merchandising':      { color: '#06b6d4', kind: 'accesorios',  variantType: 'color'  },
}

export const NICOTINE_LEVELS = [0, 3, 6, 9, 10, 12, 18, 20]
export const SALES_SIZES = [10]
export const LONGFILL_CONCENTRATES = [10, 12, 15, 16, 20, 24, 30]
export const LONGFILL_BOTTLES = [30, 60, 120]
export const MINILONGFILL_CONCENTRATES = [10]

export const VARIANT_LABELS = {
  color: 'Color',
  flavor: 'Sabor',
  ohm: 'Resistencia',
  nic: 'Nicotina',
  volume: 'Volumen',
  recipe: 'Composición',
}

// dbColor (categories.color, editable desde el admin) gana si existe;
// si no, cae al color hardcodeado por categoria y despues a gris.
export const categoryColor = (slug, dbColor) => dbColor || CATEGORY_META[slug]?.color || '#6b7280'
export const categoryKind = (slug) => CATEGORY_META[slug]?.kind ?? 'accesorios'
export const categoryVariantType = (slug) => CATEGORY_META[slug]?.variantType ?? null

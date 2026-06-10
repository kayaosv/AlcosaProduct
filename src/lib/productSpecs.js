// Specs por categoría (clave = slug en DB).
// Define qué campos viven dentro del JSONB `details` para cada categoría
// y los colores que las cards/pills usan en el panel.

export const CATEGORY_META = {
  'sales-de-nicotina':  { color: '#e53935', kind: 'sales' },
  'longfill':           { color: '#8b5cf6', kind: 'longfill' },
  'minilongfill':       { color: '#7c3aed', kind: 'longfill' },
  'vapers':             { color: '#3b82f6', kind: 'vapers' },
  'vapers-desechables': { color: '#f59e0b', kind: 'desechables' },
  'alquimia':           { color: '#10b981', kind: 'alquimia' },
  'accesorios':         { color: '#6b7280', kind: 'accesorios' },
  'cbd':                { color: '#16a34a', kind: 'accesorios' },
  'resistencia':        { color: '#f97316', kind: 'accesorios' },
  'parafernalia':       { color: '#ec4899', kind: 'accesorios' },
  'merchandising':      { color: '#06b6d4', kind: 'accesorios' },
}

export const NICOTINE_LEVELS = [0, 3, 6, 9, 10, 12, 18, 20]
export const SALES_SIZES = [10, 20, 30, 50, 60, 100]
export const LONGFILL_CONCENTRATES = [10, 12, 15, 16, 20, 30]
export const LONGFILL_BOTTLES = [30, 60, 120]
export const MINILONGFILL_SIZES = [6, 10]

export const categoryColor = (slug) => CATEGORY_META[slug]?.color ?? '#6b7280'
export const categoryKind = (slug) => CATEGORY_META[slug]?.kind ?? 'accesorios'

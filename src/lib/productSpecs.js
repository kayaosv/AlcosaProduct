// Specs por categoría (clave = slug en DB).
// Define qué campos viven dentro del JSONB `details` para cada categoría
// y los colores que las cards/pills usan en el panel.
//
// `kind`/`variantType` ahora viven principalmente en la DB
// (categories.kind / categories.variant_type, editable desde
// /admin/categories) — este mapa queda como fallback para categorías
// creadas antes de esa migración y cuya fila todavía no tiene `kind`
// seteado. Ver categoryKind/categoryVariantType más abajo.
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

// Moldes seleccionables al crear/editar una categoría desde el admin
// (Categories.jsx). Reutilizan los mismos `kind` (que bloque de
// "Especificaciones" se muestra en ProductEditor.jsx) y `variantType`
// (que tipo de variante acepta VariantsEditor) que ya existen en código
// — elegir un molde no requiere ningún cambio de código, solo aplica a
// categorías cuya forma ya está construida. Un molde realmente nuevo
// (una sección de specs nunca vista) sigue requiriendo pedir el cambio.
export const CATEGORY_TEMPLATES = [
  { value: 'accesorios',   label: 'Accesorio simple (sin variantes)',                     kind: 'accesorios',  variantType: null     },
  { value: 'sales',        label: 'Sales de nicotina (variante = concentración, texto libre + foto)', kind: 'sales',       variantType: 'nic'    },
  { value: 'longfill',     label: 'Longfill / Minilongfill (variantes de volumen + foto)', kind: 'longfill',    variantType: 'volume' },
  { value: 'vapers',       label: 'Vapers (variantes de color + foto)',                   kind: 'vapers',      variantType: 'color'  },
  { value: 'desechables',  label: 'Desechables (variantes de sabor + foto)',              kind: 'desechables', variantType: 'flavor' },
  { value: 'resistencia',  label: 'Resistencias (variantes de Ω + foto)',                 kind: 'accesorios',  variantType: 'ohm'    },
  { value: 'alquimia',     label: 'Alquimia (composición de bases/nicokits)',              kind: 'alquimia',    variantType: 'recipe' },
  { value: 'color-simple', label: 'Variantes de color/modelo + foto (sin ficha especial)', kind: 'accesorios',  variantType: 'color'  },
]

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

// `category` es la fila de la tabla categories (o al menos {kind,
// variant_type}). Si esa fila ya tiene `kind` asignado (molde elegido
// en el admin, o backfill de la migración), la DB manda incluso si
// variant_type es null a propósito (categoría sin variantes). Si
// `kind` es null (fila de antes de la migración sin completar), cae al
// mapa hardcodeado por slug como red de seguridad.
export const categoryKind = (slug, category) =>
  category?.kind ?? CATEGORY_META[slug]?.kind ?? 'accesorios'

export const categoryVariantType = (slug, category) =>
  category?.kind ? (category.variant_type ?? null) : (CATEGORY_META[slug]?.variantType ?? null)

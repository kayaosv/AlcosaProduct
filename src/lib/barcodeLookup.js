import { supabase } from './supabase.js'

// Resolucion compartida "codigo escaneado -> variante o producto": se
// busca primero por codigo de VARIANTE (sabor/mg/color/Ω propio), si no
// aparece se cae al codigo del producto base. Antes esta cascada estaba
// duplicada casi textual en Tpv.jsx y StockScanner.jsx (ver
// specs/tpv-scanner-lookup-compartido.md) — cada pantalla sigue pidiendo
// los campos que necesita via variantSelect/productSelect (TPV quiere
// precio/promos, el escáner quiere stock/imagen), lo único que se
// comparte acá es el orden de resolución.
export const lookupByBarcode = async (code, { variantSelect, productSelect }) => {
  const clean = (code ?? '').trim()
  if (!clean) return null

  const { data: variant } = await supabase
    .from('product_variants')
    .select(variantSelect)
    .eq('barcode', clean)
    .maybeSingle()

  if (variant?.products) return { type: 'variant', variant }

  const { data: product } = await supabase
    .from('products')
    .select(productSelect)
    .eq('barcode', clean)
    .maybeSingle()

  if (product) return { type: 'product', product }

  return null
}

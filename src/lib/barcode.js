// Genera codigos EAN-13 propios cuando un producto no tiene uno. Usa el
// rango de prefijo 20-29, reservado por GS1 para uso interno de tienda -
// nunca coincide con el codigo real de un fabricante, así que es seguro
// generarlo sin depender de ningun catalogo externo (objetivo: independencia
// total de Catinfog, ver conversacion del proyecto).
const eanChecksum = (digits12) => {
  const sum = digits12
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

export const generateInternalEAN13 = () => {
  const prefix = '20'
  const body = String(Math.floor(Math.random() * 10 ** 10)).padStart(10, '0')
  const digits12 = prefix + body
  return digits12 + eanChecksum(digits12)
}

// Reintenta con otro codigo si `save` choca con un UNIQUE existente
// (products.barcode o product_variants.barcode) — colision es muy
// improbable con 10 digitos al azar, pero el rango es finito, asi que
// no dejamos el reintento al azar. `save(code)` debe lanzar en error;
// Postgrest menciona "barcode"/"duplicate" en el mensaje de un choque
// de unicidad.
export const generateUniqueBarcode = async (save) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInternalEAN13()
    try {
      await save(code)
      return code
    } catch (err) {
      const isUniqueClash = /barcode/i.test(err.message) || /duplicate/i.test(err.message)
      if (!isUniqueClash) throw err
    }
  }
  throw new Error('No se pudo generar un código único tras varios intentos, prueba otra vez.')
}

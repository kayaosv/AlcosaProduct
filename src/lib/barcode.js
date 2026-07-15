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

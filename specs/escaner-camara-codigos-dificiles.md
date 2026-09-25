# Cámara del escáner: leer códigos chicos/en superficie curva

## Objetivo

Pedido urgente del cliente: en la práctica, los botes chicos traen
códigos de barra diminutos o impresos sobre una superficie curva, y la
cámara del TPV/Escáner de stock (`@zxing/browser`) no los reconoce.

## Diseño (mejoras gratuitas al motor actual, antes de evaluar un motor de pago)

- `useBarcodeScanner.js` pide la cámara a mayor resolución (1920×1080 en
  vez de solo 1280 de ancho) — un código chico necesita más píxeles
  reales para que las barras se distingan; el navegador cae solo a la
  máxima que la cámara del dispositivo soporte si pide de más.
- `BrowserMultiFormatReader` ahora se construye con hints:
  `TRY_HARDER` (modo exhaustivo del decodificador — más lento por frame,
  pero lee códigos chicos/borrosos/en curva que el modo rápido default
  descarta) y `POSSIBLE_FORMATS` acotado a EAN-13/8, UPC-A/E y Code128
  (lo único que aparece en este catálogo — ver `src/lib/barcode.js`),
  en vez de probar los ~10 formatos que soporta la librería por default.
- Zoom digital y linterna, cuando el navegador/dispositivo los soporta
  (`IScannerControls` de `@zxing/browser` ya los expone, no hacía falta
  código nuevo de bajo nivel) — nuevo componente compartido
  `ScannerCameraControls.jsx` (usado en `Tpv.jsx` y `StockScanner.jsx`).
  Se auto-oculta si no hay soporte (típicamente sí en Chrome/Android, no
  en iOS Safari todavía) — nunca se asume que existen.
- Mensaje de "no se reconoce" (ya existía, a los 6s sin detectar)
  actualizado con una sugerencia práctica: girar el envase para que la
  parte del código quede lo más plana posible hacia la cámara — un
  código realmente envuelto en una curva muy cerrada es un problema
  físico/óptico que ningún ajuste de software resuelve del todo.

## Criterios de aceptación

- [ ] La cámara pide resolución alta (no se puede verificar sin
      dispositivo real qué resolución efectiva entrega cada teléfono).
- [ ] El decodificador usa `TRY_HARDER` + formatos acotados.
- [ ] Si el navegador soporta zoom, aparece un control deslizante sobre
      la vista de cámara; si soporta linterna, aparece un botón — en
      ambos casos en TPV y Escáner de stock.
- [ ] `npm run build` y `npm test` pasan.

## Fuera de alcance

- No se migra a un motor de pago (Dynamsoft/Scandit) ni a un motor
  gratuito alternativo (quagga2/zbar-wasm) en esta tanda — evaluado como
  siguiente paso si estas mejoras no alcanzan en la práctica (más caro
  de migrar, requiere probar contra dispositivos reales primero).
- No hay forma de "enfocar manualmente" (tap-to-focus) — no soportado de
  forma confiable entre navegadores vía la API estándar de getUserMedia.
- No se prueba en un dispositivo real desde acá (sin navegador ni
  cámara física en este entorno) — pendiente que el cliente lo confirme
  en el preview, idealmente con el mismo bote/código que le está
  fallando hoy.

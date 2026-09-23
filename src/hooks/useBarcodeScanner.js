import { useRef, useState, useEffect, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

export const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

// TRY_HARDER activa el modo mas exhaustivo del decodificador (mas lento
// por frame, pero lee codigos chicos/borrosos/en curva que el modo
// rapido default descarta) - pedido explicito del cliente (botes
// pequeños, codigos en superficie curva). POSSIBLE_FORMATS acotado a lo
// que realmente aparece en este catalogo (EAN-13/8, UPC-A/E de
// fabricante + Code128 de las etiquetas propias generadas en
// src/lib/barcode.js) en vez de probar los ~10 formatos que soporta la
// libreria por default, para no gastar ciclos en formatos que nunca van
// a aparecer.
const HINTS = new Map([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
  ]],
])

// Ciclo de vida compartido de escaneo (pistola/teclado + camara) - antes
// duplicado casi identico en StockScanner.jsx y Tpv.jsx. `onDetect(code)`
// se llama con el codigo crudo tanto si viene de Enter en el input como
// si lo detecta la camara; cada pantalla decide que hacer con el codigo
// (buscar y mostrar stock, o agregar directo al carrito de venta).
//
// La camara usaba antes la API nativa BarcodeDetector - WebKit (Safari/
// iOS) nunca la implementa (verificado 2026-09-15: sigue sin soporte),
// asi que fallaba en silencio en todo iPhone pese a que el mensaje de
// error viejo decia "Safari iOS 16.4+" (dato incorrecto, ya corregido).
// @zxing/browser decodifica en JS/WASM sobre el mismo <video>, funciona
// igual en Chrome/Android y en Safari/iOS.
export const useBarcodeScanner = (onDetect, { active = true } = {}) => {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)

  const [barcode, setBarcode] = useState('')
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [noDetection, setNoDetection] = useState(false)
  const noDetectionTimer = useRef(null)

  // Zoom digital y linterna — ambos vienen gratis de @zxing/browser
  // (IScannerControls) cuando el dispositivo/navegador los soporta
  // (tipicamente Chrome/Android; iOS Safari no expone ninguno de los
  // dos todavia). null = "no soportado, no mostrar el control".
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [zoomCaps, setZoomCaps] = useState(null) // { min, max, step } | null
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    if (active && !cameraMode) inputRef.current?.focus()
  }, [active, cameraMode])

  // Global keydown capture for barcode gun (desktop)
  useEffect(() => {
    if (!active || cameraMode) return
    const capture = () => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [active, cameraMode])

  const clearNoDetectionTimer = () => {
    if (noDetectionTimer.current) {
      clearTimeout(noDetectionTimer.current)
      noDetectionTimer.current = null
    }
  }

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
    setNoDetection(false)
    setTorchOn(false)
    setTorchSupported(false)
    setZoomCaps(null)
    setZoom(null)
    clearNoDetectionTimer()
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setNoDetection(false)
    if (!hasCamera()) {
      setCameraError('Este dispositivo no tiene cámara disponible.')
      return
    }
    try {
      readerRef.current = new BrowserMultiFormatReader(HINTS)
      setScanning(true)
      // A los 6s sin encontrar nada, se lo decimos explícitamente al
      // vendedor (pedido del cliente: "si no reconoce, que indique no
      // hay un código de barra") — sin esto, un código sucio/borroso o
      // mal encuadrado se ve igual que un lector que nunca arrancó.
      noDetectionTimer.current = setTimeout(() => setNoDetection(true), 6000)
      // decodeFromConstraints maneja el getUserMedia y el stream por su
      // cuenta - el callback se llama en cada intento de frame, "result"
      // solo viene definido cuando encuentra un codigo real (el resto
      // del tiempo llega un error de "no encontrado", normal, se ignora).
      // Resolucion alta a proposito (antes 1280 de ancho, sin alto
      // pedido) — un codigo chico en un bote necesita mas pixeles reales
      // para que las barras se distingan; el navegador cae solo a la
      // maxima que soporte la camara si esta pide de mas.
      controlsRef.current = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
        videoRef.current,
        (result) => {
          if (!result) return
          navigator.vibrate?.(80)
          stopCamera()
          setCameraMode(false)
          onDetect(result.getText())
        },
      )

      // Zoom/linterna: soporte real depende del dispositivo/navegador
      // (tipicamente si en Chrome/Android, no en iOS Safari todavia) -
      // se detecta despues de tener el stream real, nunca se asume.
      setTorchSupported(!!controlsRef.current.switchTorch)
      try {
        const caps = controlsRef.current.streamVideoCapabilitiesGet?.(() => true)
        if (caps?.zoom) {
          setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 })
          setZoom(caps.zoom.min)
        }
      } catch {
        // getCapabilities() no soportado en este navegador - sin zoom, no rompe el escaneo.
      }
    } catch (err) {
      setScanning(false)
      clearNoDetectionTimer()
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }, [onDetect, stopCamera])

  const toggleTorch = useCallback(async () => {
    if (!controlsRef.current?.switchTorch) return
    const next = !torchOn
    try {
      await controlsRef.current.switchTorch(next)
      setTorchOn(next)
    } catch {
      // Algunos navegadores anuncian soporte pero fallan al aplicarlo en
      // el momento (torch experimental) - no rompe el resto del escaneo.
    }
  }, [torchOn])

  const setZoomLevel = useCallback((value) => {
    if (!controlsRef.current?.streamVideoConstraintsApply) return
    controlsRef.current.streamVideoConstraintsApply({ advanced: [{ zoom: value }] })
    setZoom(value)
  }, [])

  const toggleCamera = useCallback(() => {
    if (cameraMode) {
      stopCamera()
      setCameraMode(false)
      setCameraError(null)
    } else {
      setCameraMode(true)
      setTimeout(startCamera, 100)
    }
  }, [cameraMode, startCamera, stopCamera])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onDetect(barcode)
        setBarcode('')
      }
    },
    [barcode, onDetect],
  )

  return {
    inputRef,
    videoRef,
    barcode,
    setBarcode,
    cameraMode,
    cameraError,
    scanning,
    noDetection,
    toggleCamera,
    handleKeyDown,
    stopCamera,
    torchOn,
    torchSupported,
    toggleTorch,
    zoomCaps,
    zoom,
    setZoomLevel,
  }
}

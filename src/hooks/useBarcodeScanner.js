import { useRef, useState, useEffect, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

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

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    if (!hasCamera()) {
      setCameraError('Este dispositivo no tiene cámara disponible.')
      return
    }
    try {
      readerRef.current = new BrowserMultiFormatReader()
      setScanning(true)
      // decodeFromConstraints maneja el getUserMedia y el stream por su
      // cuenta - el callback se llama en cada intento de frame, "result"
      // solo viene definido cuando encuentra un codigo real (el resto
      // del tiempo llega un error de "no encontrado", normal, se ignora).
      controlsRef.current = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1280 } } },
        videoRef.current,
        (result) => {
          if (!result) return
          navigator.vibrate?.(80)
          stopCamera()
          setCameraMode(false)
          onDetect(result.getText())
        },
      )
    } catch (err) {
      setScanning(false)
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }, [onDetect, stopCamera])

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
    toggleCamera,
    handleKeyDown,
    stopCamera,
  }
}

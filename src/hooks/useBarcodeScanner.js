import { useRef, useState, useEffect, useCallback } from 'react'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']

export const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
export const hasBarcodeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

// Ciclo de vida compartido de escaneo (pistola/teclado + camara con
// BarcodeDetector) - antes duplicado casi identico en StockScanner.jsx
// y Tpv.jsx. `onDetect(code)` se llama con el codigo crudo tanto si
// viene de Enter en el input como si lo detecta la camara; cada
// pantalla decide que hacer con el codigo (buscar y mostrar stock,
// o agregar directo al carrito de venta).
export const useBarcodeScanner = (onDetect, { active = true } = {}) => {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)

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
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const scanLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      if (codes.length > 0) {
        navigator.vibrate?.(80)
        stopCamera()
        setCameraMode(false)
        onDetect(codes[0].rawValue)
        return
      }
    } catch (_) {}
    rafRef.current = requestAnimationFrame(scanLoop)
  }, [onDetect, stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    if (!hasBarcodeDetector()) {
      setCameraError('Tu navegador no soporta detección de códigos. Usa Chrome en Android o Safari iOS 16.4+')
      return
    }
    try {
      detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      scanLoop()
    } catch (err) {
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }, [scanLoop])

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

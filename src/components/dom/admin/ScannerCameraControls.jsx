// Zoom digital + linterna sobre la vista de cámara del escáner — mismos
// controles en Tpv.jsx y StockScanner.jsx (ambos usan useBarcodeScanner),
// extraído para no duplicar el mismo overlay dos veces. Se auto-oculta
// si el dispositivo/navegador no soporta ninguno de los dos (típicamente
// sí en Chrome/Android, no en iOS Safari todavía).
export const ScannerCameraControls = ({ scanner }) => {
  if (!scanner.torchSupported && !scanner.zoomCaps) return null

  return (
    <div
      style={{
        position: 'absolute', top: 10, left: 10, right: 10, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {scanner.zoomCaps && (
        <input
          type="range"
          min={scanner.zoomCaps.min}
          max={scanner.zoomCaps.max}
          step={scanner.zoomCaps.step}
          value={scanner.zoom ?? scanner.zoomCaps.min}
          onChange={(e) => scanner.setZoomLevel(Number(e.target.value))}
          aria-label="Zoom de la cámara"
          style={{ flex: 1 }}
        />
      )}
      {scanner.torchSupported && (
        <button
          type="button"
          onClick={scanner.toggleTorch}
          aria-label={scanner.torchOn ? 'Apagar linterna' : 'Encender linterna'}
          title={scanner.torchOn ? 'Apagar linterna' : 'Encender linterna'}
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: scanner.torchOn ? '#e53935' : 'rgba(0,0,0,0.55)',
            color: '#fff', fontSize: 15, lineHeight: 1, cursor: 'pointer',
          }}
        >
          💡
        </button>
      )}
    </div>
  )
}

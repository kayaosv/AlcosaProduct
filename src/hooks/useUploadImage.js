import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const BUCKET = 'product-images'
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.82

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })

// Las fotos suben directo desde el móvil del cliente (varios MB, resolución
// de cámara) y se sirven tal cual a cada visitante en tarjetas de ~300px de
// ancho — la causa principal de la carga lenta del catálogo. Redimensiona
// a un máximo razonable y convierte a WebP en el propio navegador antes de
// subir, sin depender de ningún servicio de transformación de imágenes.
const optimizeImage = async (file) => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const img = await loadImage(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
    const width = Math.round(img.width * scale)
    const height = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(img.src)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    if (!blob) return file

    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
  } catch {
    // Si algo falla (imagen corrupta, navegador sin soporte), se sube el
    // archivo original en vez de bloquear al admin.
    return file
  }
}

export const useUploadImage = () => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const upload = useCallback(async (file, hint = 'product') => {
    setUploading(true)
    setError(null)
    try {
      const optimized = await optimizeImage(file)
      const ext = (optimized.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${slugify(hint)}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, optimized, { cacheControl: '3600', upsert: false, contentType: optimized.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { path, publicUrl: data.publicUrl }
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  const removeByUrl = useCallback(async (publicUrl) => {
    if (!publicUrl) return
    const marker = `/${BUCKET}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return
    const path = publicUrl.slice(idx + marker.length)
    await supabase.storage.from(BUCKET).remove([path])
  }, [])

  return { upload, removeByUrl, uploading, error }
}

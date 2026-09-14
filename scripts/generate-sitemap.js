// Genera dist/sitemap.xml despues del build (postbuild, ver package.json).
// El sitio es una SPA cliente-only (Vite, sin SSR) asi que no hay forma
// de generar esto en cada request - se arma una vez por deploy con el
// catalogo real de Supabase. Usa VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// (las mismas variables que ya usa el cliente, Vercel las expone igual a
// un script de Node corrido en el mismo build) - anon key alcanza,
// products/categories ya son de lectura publica via RLS.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const SITE_URL = 'https://vapersalcosa19.com'
const STATIC_ROUTES = ['/', '/catalog', '/aviso-legal', '/privacidad', '/cookies']

const urlEntry = (loc, lastmod) =>
  `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`

const run = async () => {
  const entries = STATIC_ROUTES.map((path) => urlEntry(`${SITE_URL}${path}`))

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (url && anonKey) {
    try {
      const supabase = createClient(url, anonKey)

      const { data: categories } = await supabase.from('categories').select('slug')
      for (const c of categories ?? []) entries.push(urlEntry(`${SITE_URL}/catalog?cat=${c.slug}`))

      const { data: products } = await supabase
        .from('products')
        .select('id, updated_at')
        .eq('is_active', true)
      for (const p of products ?? []) {
        entries.push(urlEntry(`${SITE_URL}/product/${p.id}`, p.updated_at?.slice(0, 10)))
      }
    } catch (err) {
      // No romper el build por un problema de red/DB al generar el
      // sitemap - mejor un deploy con sitemap incompleto (solo rutas
      // estaticas) que ningun deploy.
      console.warn('generate-sitemap: no se pudo leer Supabase, sitemap solo con rutas estáticas.', err.message)
    }
  } else {
    console.warn('generate-sitemap: faltan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, sitemap solo con rutas estáticas.')
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
  writeFileSync('dist/sitemap.xml', xml)
  console.log(`generate-sitemap: ${entries.length} URLs escritas en dist/sitemap.xml`)
}

run()

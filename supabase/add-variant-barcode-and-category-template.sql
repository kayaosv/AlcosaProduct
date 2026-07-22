-- Codigo de barras por variante (cada sabor/mg/color/volumen es una
-- unidad fisica distinta con su propio stock -- hoy solo products.barcode
-- existe, asi que escanear un producto con variantes nunca identifica
-- CUAL variante tenes en la mano, StockScanner.jsx obliga a elegir a mano).
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);

-- Molde de categoria (kind = que bloque de "Especificaciones" se muestra
-- en ProductEditor.jsx; variant_type = que tipo de variante acepta:
-- color/flavor/ohm/nic/volume/recipe). Antes vivia solo hardcodeado en
-- CATEGORY_META (src/lib/productSpecs.js) -- una categoria nueva creada
-- desde /admin/categories siempre caia en el molde generico (sin
-- variantes) hasta que un desarrollador editara ese archivo. Ahora la DB
-- es la fuente de verdad; el hardcode en productSpecs.js queda solo como
-- fallback para filas viejas sin completar.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS variant_type TEXT;

-- Backfill de las categorias existentes con los valores que ya tenian
-- hardcodeados en CATEGORY_META, para que la DB pase a ser autoritativa
-- de una sin cambiar el comportamiento actual de ninguna.
UPDATE categories SET kind = 'sales',       variant_type = 'nic'    WHERE slug = 'sales-de-nicotina';
UPDATE categories SET kind = 'longfill',    variant_type = 'volume' WHERE slug = 'longfill';
UPDATE categories SET kind = 'longfill',    variant_type = 'volume' WHERE slug = 'minilongfill';
UPDATE categories SET kind = 'vapers',      variant_type = 'color'  WHERE slug = 'vapers';
UPDATE categories SET kind = 'desechables', variant_type = 'flavor' WHERE slug = 'vapers-desechables';
UPDATE categories SET kind = 'alquimia',    variant_type = 'recipe' WHERE slug = 'alquimia';
UPDATE categories SET kind = 'accesorios',  variant_type = NULL     WHERE slug = 'accesorios';
UPDATE categories SET kind = 'accesorios',  variant_type = NULL     WHERE slug = 'cbd';
UPDATE categories SET kind = 'accesorios',  variant_type = 'ohm'    WHERE slug = 'resistencia';
UPDATE categories SET kind = 'accesorios',  variant_type = NULL     WHERE slug = 'parafernalia';
UPDATE categories SET kind = 'accesorios',  variant_type = 'color'  WHERE slug = 'merchandising';

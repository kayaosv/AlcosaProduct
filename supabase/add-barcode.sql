-- Add barcode column to products for scanner integration
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

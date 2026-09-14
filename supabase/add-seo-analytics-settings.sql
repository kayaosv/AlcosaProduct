-- ============================================================
-- Vapers Alcosa — IDs de Analytics/Ads editables sin tocar codigo
-- ============================================================
-- Mismo patron que payment_iban/payment_bizum_phone (transfer-payment.sql):
-- fila unica de shop_settings, editable desde /admin/settings. Vacio =
-- no se inyecta ningun script de tracking (AnalyticsLoader.jsx no monta
-- nada hasta que el cliente cargue un ID real - nunca se inventa uno).
alter table shop_settings add column if not exists seo_ga4_id text;
alter table shop_settings add column if not exists seo_meta_pixel_id text;

comment on column shop_settings.seo_ga4_id is 'Measurement ID de Google Analytics 4 (formato G-XXXXXXXXXX). NULL = gtag.js no se carga.';
comment on column shop_settings.seo_meta_pixel_id is 'Pixel ID de Meta (Facebook/Instagram Ads). NULL = fbevents.js no se carga.';

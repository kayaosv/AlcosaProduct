-- ============================================================
-- Vapers Alcosa — Seed de 30 productos (migrado del MVP)
-- ============================================================
--
-- Requiere que schema.sql ya esté aplicado (con categorías seedeadas).
-- Ejecutar en el SQL Editor de Supabase. Idempotente por nombre+marca.
--
-- Mapeo MVP → schema:
--   nombre            → name
--   marca             → brand
--   categoria (slug)  → category_id (resuelto por slug)
--   precio            → price  (o sale_price si en oferta)
--   precio_original   → price  (cuando hay oferta)
--   precio_mayorista  → wholesale_price
--   stock             → stock
--   disponible        → is_active
--   destacado         → is_featured
--   specs varios      → details JSONB

with cat as (
  select id, slug from categories
)
insert into products
  (name, brand, category_id, details, price, sale_price, is_on_sale,
   wholesale_price, stock, is_active, is_featured)
values
  -- ── SALES DE NICOTINA ─────────────────────────────────────────────────
  ('Dinner Lady Salts – Mango Ice', 'Dinner Lady',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Mango con toque helado"}'::jsonb,
    4.50, null, false, 3.10, 48, true, true),

  ('Dinner Lady Salts – Watermelon Slices', 'Dinner Lady',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Sandía fresca"}'::jsonb,
    4.50, null, false, 3.10, 32, true, false),

  ('Drifter – Pineapple Ice', 'Drifter',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Piña con hielo"}'::jsonb,
    3.50, null, false, 2.30, 60, true, false),

  ('Drifter – Cotton Candy Ice', 'Drifter',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Algodón de azúcar helado"}'::jsonb,
    3.50, null, false, 2.30, 45, true, false),

  ('Drifter – Grape', 'Drifter',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Uva"}'::jsonb,
    3.50, null, false, 2.30, 28, true, false),

  ('Drifter – Lychee', 'Drifter',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Lychee tropical"}'::jsonb,
    3.00, null, false, 2.00, 12, true, false),

  ('Drops Salts – American Luxury', 'Drops',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Tabaco americano premium"}'::jsonb,
    4.90, null, false, 3.50, 22, true, false),

  ('Drops Salts – Fausto''s Deal', 'Drops',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Tabaco especiado"}'::jsonb,
    4.90, null, false, 3.50, 18, true, false),

  -- En oferta: precio_original=4.90 (price), precio=3.50 (sale_price)
  ('Drops Salts – Route 66', 'Drops',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Tabaco americano y caramelo"}'::jsonb,
    4.90, 3.50, true, 2.40, 5, true, false),

  ('Frumist – Blue Magic Nic Salt', 'Frumist',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Arándanos y frutos del bosque"}'::jsonb,
    3.50, null, false, 2.40, 0, false, false),

  ('Frumist – Cola Ice Nic Salts', 'Frumist',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Cola con hielo"}'::jsonb,
    4.50, null, false, 3.10, 35, true, false),

  -- En oferta: precio_original=5.50, precio=5.00
  ('THE ORDER Salts – Tarta de San Marcos', 'Ivg',
    (select id from cat where slug='sales-de-nicotina'),
    '{"size_ml":10,"nicotine_mg":20,"flavor":"Tarta de San Marcos"}'::jsonb,
    5.50, 5.00, true, 3.60, 20, true, true),

  -- ── LONGFILL ──────────────────────────────────────────────────────────
  ('Aroma Afrodita – Golden Era', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":10,"bottle_ml":30,"flavor":"Fresas y frambuesas con toque cítrico"}'::jsonb,
    7.50, null, false, 5.20, 40, true, false),

  ('Aroma Afrodita – Golden Era (Grande)', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":15,"bottle_ml":60,"flavor":"Fresas y frambuesas con toque cítrico"}'::jsonb,
    13.00, null, false, 9.20, 24, true, false),

  ('Aroma Apple Peach Max – Bombo Bar Juice', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":10,"bottle_ml":30,"flavor":"Manzana y melocotón"}'::jsonb,
    6.30, null, false, 4.40, 55, true, false),

  ('Aroma Atenea – Golden Era', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":10,"bottle_ml":30,"flavor":"Mango y maracuyá exótico"}'::jsonb,
    7.50, null, false, 5.20, 30, true, false),

  ('Aroma Blueberry Cherry – Bombo Bar Juice', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":10,"bottle_ml":30,"flavor":"Arándanos y cereza"}'::jsonb,
    6.30, null, false, 4.40, 38, true, false),

  ('Aroma Branila – Golden Era (Grande)', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":15,"bottle_ml":60,"flavor":"Vainilla con frutos tropicales"}'::jsonb,
    13.00, null, false, 9.20, 0, false, false),

  ('Aroma Drifter – Kiwi Passion Guava', 'Drifter',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":16,"bottle_ml":60,"flavor":"Kiwi, maracuyá y guayaba"}'::jsonb,
    7.50, null, false, 5.20, 42, true, true),

  ('Aroma Drifter Mad Blue', 'Drifter',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":16,"bottle_ml":60,"flavor":"Arándanos y frambuesas heladas"}'::jsonb,
    7.50, null, false, 5.20, 28, true, false),

  ('Just Juice Bar – Strawberry Kiwi Longfill', 'Just Juice',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":12,"bottle_ml":60,"flavor":"Fresa y kiwi"}'::jsonb,
    8.90, null, false, 6.30, 15, true, false),

  ('Aroma Nutty Supra Reserve – Platinum Tobaccos', 'Bombo',
    (select id from cat where slug='longfill'),
    '{"concentrate_ml":15,"bottle_ml":60,"flavor":"Tabaco con avellana"}'::jsonb,
    13.00, null, false, 9.20, 10, true, false),

  -- ── VAPERS ────────────────────────────────────────────────────────────
  ('Geekvape Sonder Q2 Pod Kit + Líquido 10ml', 'Geekvape',
    (select id from cat where slug='vapers'),
    '{"model":"Sonder Q2","battery_mah":1000,"power_w":18}'::jsonb,
    19.00, null, false, 13.50, 8, true, true),

  ('OXVA Xlim V2 Pod Kit', 'OXVA',
    (select id from cat where slug='vapers'),
    '{"model":"Xlim V2","battery_mah":900,"power_w":25}'::jsonb,
    29.90, null, false, 21.00, 12, true, false),

  ('Vaporesso XROS 3 Mini', 'Vaporesso',
    (select id from cat where slug='vapers'),
    '{"model":"XROS 3 Mini","battery_mah":1000,"power_w":16}'::jsonb,
    24.90, null, false, 17.50, 6, true, false),

  -- ── DESECHABLES ───────────────────────────────────────────────────────
  ('Elf Bar 600 – Blueberry Ice', 'Elf Bar',
    (select id from cat where slug='vapers-desechables'),
    '{"puffs":600,"nicotine_mg":20,"flavor":"Arándano helado"}'::jsonb,
    6.50, null, false, 4.50, 80, true, false),

  ('Lost Mary BM600 – Pink Lemonade', 'Lost Mary',
    (select id from cat where slug='vapers-desechables'),
    '{"puffs":600,"nicotine_mg":20,"flavor":"Limonada de frambuesa"}'::jsonb,
    6.90, null, false, 4.80, 65, true, true),

  ('Drifter Bar – Watermelon Ice', 'Drifter',
    (select id from cat where slug='vapers-desechables'),
    '{"puffs":600,"nicotine_mg":20,"flavor":"Sandía con hielo"}'::jsonb,
    5.90, null, false, 4.00, 45, true, false),

  -- ── ACCESORIOS ────────────────────────────────────────────────────────
  ('Resistencia OXVA Xlim V2 0.6Ω', 'OXVA',
    (select id from cat where slug='accesorios'),
    '{"description":"Pack de 2 resistencias para Xlim V2"}'::jsonb,
    7.90, null, false, 5.50, 25, true, false),

  ('Botella Graduada 30ml', null,
    (select id from cat where slug='accesorios'),
    '{"description":"Botella transparente con punta fina para mezclas longfill"}'::jsonb,
    1.50, null, false, 0.90, 200, true, false)
on conflict do nothing;

-- Verificar:
-- select count(*) from products;
-- select c.name, count(p.*) from categories c left join products p on p.category_id=c.id group by c.name order by c.sort_order;

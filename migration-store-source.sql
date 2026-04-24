-- shopify_stores tablosuna source alani ekle.
-- 'storeleads' default - mevcut tum kayitlar icin
-- Yeni kaynaklar: 'tsoft', 'ticimax', 'manual'

ALTER TABLE shopify_stores ADD COLUMN IF NOT EXISTS source text DEFAULT 'storeleads';

UPDATE shopify_stores SET source = 'storeleads' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_stores_source ON shopify_stores (source);

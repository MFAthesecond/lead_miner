-- Supabase Dashboard -> SQL Editor -> New Query ile calistir
-- Shopify Lead Finder tablosu

CREATE TABLE IF NOT EXISTS shopify_stores (
  id            bigserial    PRIMARY KEY,
  url           text         UNIQUE NOT NULL,
  domain        text         NOT NULL,
  store_name    text,
  emails        text[]       DEFAULT '{}',
  phones        text[]       DEFAULT '{}',
  instagram     text,
  ig_followers  integer      DEFAULT 0,
  whatsapp      text,
  facebook      text,
  tiktok        text,
  category      text,
  currency      text,
  product_count integer,
  description   text,
  is_shopify    boolean      DEFAULT true,
  discovered_at timestamptz  DEFAULT now(),
  enriched_at   timestamptz,
  ig_fetched_at timestamptz,
  created_at    timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_enriched ON shopify_stores (enriched_at)
  WHERE enriched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stores_ig ON shopify_stores (ig_fetched_at)
  WHERE instagram IS NOT NULL AND ig_fetched_at IS NULL;

ALTER TABLE shopify_stores DISABLE ROW LEVEL SECURITY;

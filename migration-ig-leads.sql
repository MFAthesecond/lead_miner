-- Supabase Dashboard -> SQL Editor -> New Query ile calistir
-- Instagram Lead Mining tablosu

CREATE TABLE IF NOT EXISTS instagram_leads (
  id               bigserial   PRIMARY KEY,
  username         text        UNIQUE NOT NULL,
  full_name        text,
  bio              text,
  external_url     text,
  business_email   text,
  business_phone   text,
  whatsapp         text,
  followers        integer     DEFAULT 0,
  following        integer     DEFAULT 0,
  post_count       integer     DEFAULT 0,
  is_business      boolean     DEFAULT false,
  is_private       boolean     DEFAULT false,
  is_verified      boolean     DEFAULT false,
  category         text,
  niche            text,
  has_dm_signal    boolean     DEFAULT false,
  has_wa_signal    boolean     DEFAULT false,
  has_website      boolean     DEFAULT false,
  lite_score       integer     DEFAULT 0,
  shopify_url      text,
  source           text,
  tag              text,
  notes            text,
  discovered_at    timestamptz DEFAULT now(),
  ig_fetched_at    timestamptz,
  enrich_failed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ig_unfetched
  ON instagram_leads (ig_fetched_at)
  WHERE ig_fetched_at IS NULL AND enrich_failed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ig_score
  ON instagram_leads (lite_score DESC);

CREATE INDEX IF NOT EXISTS idx_ig_followers
  ON instagram_leads (followers DESC);

CREATE INDEX IF NOT EXISTS idx_ig_niche
  ON instagram_leads (niche);

CREATE INDEX IF NOT EXISTS idx_ig_source
  ON instagram_leads (source);

CREATE INDEX IF NOT EXISTS idx_ig_tag
  ON instagram_leads (tag)
  WHERE tag IS NOT NULL;

ALTER TABLE instagram_leads DISABLE ROW LEVEL SECURITY;

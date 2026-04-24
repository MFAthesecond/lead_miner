-- IG related profiles cron'unun ilerlemesini takip etmek icin.
-- NULL olanlar henuz related_profiles cekilmemis demek.

ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS related_fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ig_leads_related
  ON instagram_leads (related_fetched_at)
  WHERE related_fetched_at IS NULL;

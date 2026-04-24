const { getSupabase, verifyCron } = require('../_lib/supabase');
const { fetchProfile, buildEnrichedRow } = require('../_lib/ig');

const BATCH_SIZE = parseInt(process.env.IG_ENRICH_BATCH || '3', 10);
const DELAY_MS = parseInt(process.env.IG_ENRICH_DELAY_MS || '3000', 10);

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from('instagram_leads')
    .select('id, username, source, niche, shopify_url, full_name, followers')
    .is('ig_fetched_at', null)
    .is('enrich_failed_at', null)
    .order('lite_score', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) {
    return res.json({ ok: true, enriched: 0, message: 'Nothing to enrich' });
  }

  let enriched = 0;
  let failed = 0;
  let rateLimited = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = await fetchProfile(row.username);

    if (result.rateLimited) {
      rateLimited = true;
      break;
    }

    if (result.notFound) {
      await supabase.from('instagram_leads')
        .update({ enrich_failed_at: new Date().toISOString() })
        .eq('id', row.id);
      failed++;
    } else if (result.ok) {
      const update = buildEnrichedRow(result.profile);
      await supabase.from('instagram_leads')
        .update(update)
        .eq('id', row.id);
      enriched++;
    } else {
      // Gecici hata - bir daha dene, failed_at isaretleme
    }

    if (i < rows.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return res.json({
    ok: true,
    batch: rows.length,
    enriched,
    failed,
    rateLimited,
  });
};

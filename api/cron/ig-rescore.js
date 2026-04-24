const { getSupabase, verifyCron } = require('../_lib/supabase');
const { fetchProfile, buildEnrichedRow } = require('../_lib/ig');

const BATCH_SIZE = parseInt(process.env.IG_RESCORE_BATCH || '3', 10);
const DELAY_MS = parseInt(process.env.IG_RESCORE_DELAY_MS || '3000', 10);
const TTL_DAYS = parseInt(process.env.IG_CACHE_TTL_DAYS || '30', 10);

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from('instagram_leads')
    .select('id, username')
    .lt('ig_fetched_at', cutoff)
    .is('enrich_failed_at', null)
    .order('ig_fetched_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) {
    return res.json({ ok: true, rescored: 0, message: 'Cache fresh' });
  }

  let rescored = 0;
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
      rescored++;
    }

    if (i < rows.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return res.json({
    ok: true,
    cutoff,
    batch: rows.length,
    rescored,
    failed,
    rateLimited,
    ttl_days: TTL_DAYS,
  });
};

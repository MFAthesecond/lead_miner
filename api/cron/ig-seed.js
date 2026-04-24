const { getSupabase, verifyCron } = require('../_lib/supabase');
const { extractUsername, calcLiteScore } = require('../_lib/ig');

// Default 0: tum IG'leri al. Eskiden 5000+ siniri vardi, kaldirdik.
// instagram_leads dashboard'unda follower araligi filtrelemesi var.
const SEED_MIN_FOLLOWERS = parseInt(process.env.SEED_MIN_FOLLOWERS || '0', 10);
const PAGE_SIZE = 1000;

const CATEGORY_TO_NICHE = {
  'Moda / Giyim': 'moda',
  'Taki / Aksesuar': 'taki',
  'Deri / Canta': 'deri',
  'Saat': 'saat',
  'Kozmetik': 'kozmetik',
  'Gida / Gurme': 'gurme',
  'Spor': 'spor',
  'Ev / Mobilya': 'ev',
  'Bebek / Cocuk': 'bebek',
  'Pet': 'pet',
  'Muzik': 'muzik',
  'Sanat': 'sanat',
};

const SOURCE_MAP = {
  'storeleads': 'seed_shopify',
  'tsoft': 'seed_tsoft',
  'ticimax': 'seed_ticimax',
  'ideasoft': 'seed_ideasoft',
  'manual': 'seed_manual',
};

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  const allRows = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from('shopify_stores')
      .select('instagram, ig_followers, store_name, url, category, source')
      .not('instagram', 'is', null);
    if (SEED_MIN_FOLLOWERS > 0) q = q.gte('ig_followers', SEED_MIN_FOLLOWERS);
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const seen = new Set();
  const upserts = [];
  let skipped = 0;

  for (const r of allRows) {
    const username = extractUsername(r.instagram);
    if (!username) { skipped++; continue; }
    if (seen.has(username)) continue;
    seen.add(username);

    const followers = Number(r.ig_followers) || 0;
    const lite_score = calcLiteScore({
      followers,
      has_dm_signal: false,
      has_wa_signal: false,
      has_website: true,
      is_business: false,
      is_private: false,
      post_count: 0,
    });

    upserts.push({
      username,
      full_name: r.store_name || null,
      followers,
      has_website: true,
      lite_score,
      shopify_url: r.url,
      niche: CATEGORY_TO_NICHE[r.category] || null,
      source: SOURCE_MAP[r.source] || 'seed_shopify',
    });
  }

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const slice = upserts.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('instagram_leads')
      .upsert(slice, { onConflict: 'username', ignoreDuplicates: true })
      .select('id');
    if (error) return res.status(500).json({ error: error.message, inserted });
    if (data) inserted += data.length;
  }

  return res.json({
    ok: true,
    eligible: allRows.length,
    candidates: upserts.length,
    inserted,
    skipped,
    seed_min_followers: SEED_MIN_FOLLOWERS,
  });
};

const { getSupabase, verifyCron } = require('../_lib/supabase');

const IG_UA = 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)';
const IG_APP_ID = '936619743392459';
const BATCH_SIZE = 5;
const DELAY_MS = 1000;

const JUNK_IG_USERS = new Set([
  'shopify','instagram','facebook','twitter','tiktok',
  'reel','reels','explore','share','sharer','intent','dialog',
  'accounts','about','developer','legal','privacy','terms',
  'stories','direct','tv','p',
]);

async function getFollowers(username) {
  const endpoints = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': IG_UA, 'X-IG-App-ID': IG_APP_ID },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.status === 401 || resp.status === 429) return { count: 0, rateLimited: true };
      if (!resp.ok) continue;
      const data = await resp.json();
      const count = data?.data?.user?.edge_followed_by?.count || 0;
      if (count) return { count, rateLimited: false };
    } catch {}
  }

  return { count: 0, rateLimited: false };
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  // Oncelik 1: ig_fetched_at NULL olanlar
  let { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, instagram')
    .not('instagram', 'is', null)
    .is('ig_fetched_at', null)
    .limit(BATCH_SIZE);

  // Oncelik 2: Takipci 0 olup tekrar denenmesi gerekenler
  if (!error && (!rows || rows.length === 0)) {
    const retry = await supabase
      .from('shopify_stores')
      .select('id, instagram')
      .not('instagram', 'is', null)
      .eq('ig_followers', 0)
      .eq('is_shopify', true)
      .not('enriched_at', 'is', null)
      .limit(BATCH_SIZE);
    if (!retry.error && retry.data) rows = retry.data;
  }

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.json({ ok: true, fetched: 0, message: 'All done' });

  let fetched = 0;
  let cleaned = 0;
  let rateLimited = false;

  for (const row of rows) {
    const username = row.instagram
      .replace('https://instagram.com/', '')
      .replace('https://www.instagram.com/', '')
      .replace('@', '')
      .replace(/\/$/, '');

    if (!username || JUNK_IG_USERS.has(username.toLowerCase())) {
      await supabase.from('shopify_stores')
        .update({ instagram: null, ig_followers: 0, ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      cleaned++;
      continue;
    }

    const result = await getFollowers(username);

    if (result.rateLimited) {
      rateLimited = true;
      break;
    }

    await supabase.from('shopify_stores')
      .update({
        ig_followers: result.count,
        ig_fetched_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (result.count) fetched++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return res.json({
    ok: true,
    fetched,
    cleaned,
    total: rows.length,
    rateLimited,
  });
};

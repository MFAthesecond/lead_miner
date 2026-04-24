const { getSupabase } = require('./_lib/supabase');
const { extractUsername, calcLiteScore } = require('./_lib/ig');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    const {
      niche, source, tag, search,
      min_followers, max_followers,
      dm, wa, web,
      enriched, business,
    } = req.query;

    let query = supabase
      .from('instagram_leads')
      .select('*', { count: 'exact' })
      .order('lite_score', { ascending: false, nullsFirst: false })
      .order('followers', { ascending: false, nullsFirst: false });

    if (niche) query = query.eq('niche', niche);
    if (source) query = query.eq('source', source);
    if (tag === '_none') query = query.is('tag', null);
    else if (tag) query = query.eq('tag', tag);
    if (min_followers) query = query.gte('followers', parseInt(min_followers));
    if (max_followers) query = query.lte('followers', parseInt(max_followers));
    if (dm === 'true') query = query.eq('has_dm_signal', true);
    if (wa === 'true') query = query.eq('has_wa_signal', true);
    if (web === 'true') query = query.eq('has_website', true);
    if (business === 'true') query = query.eq('is_business', true);
    if (enriched === 'true') query = query.not('ig_fetched_at', 'is', null);
    else if (enriched === 'false') query = query.is('ig_fetched_at', null);

    if (search) {
      const s = String(search).replace(/[%_]/g, '\\$&');
      query = query.or(`username.ilike.%${s}%,full_name.ilike.%${s}%,bio.ilike.%${s}%`);
    }

    const allData = [];
    const PAGE = 1000;
    let from = 0;
    let totalCount = null;
    while (true) {
      const { data, error, count } = await query.range(from, from + PAGE - 1);
      if (error) return res.status(500).json({ error: error.message });
      if (totalCount === null) totalCount = count;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    return res.json({ rows: allData, total: totalCount });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const ALLOWED = [
      'tag','notes','business_phone','business_email','whatsapp',
      'category','niche','full_name','bio','external_url',
    ];
    const update = {};
    for (const key of ALLOWED) {
      if (key in body) update[key] = body[key] === '' ? null : body[key];
    }

    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'no fields to update' });

    const { error } = await supabase
      .from('instagram_leads')
      .update(update)
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const username = extractUsername(body.username || body.instagram || '');
    if (!username) return res.status(400).json({ error: 'invalid username' });

    const niche = body.niche || null;
    const followers = Number(body.followers) || 0;
    const lite_score = calcLiteScore({
      followers,
      has_dm_signal: false,
      has_wa_signal: false,
      has_website: false,
      is_business: false,
      is_private: false,
      post_count: 0,
    });

    const { data, error } = await supabase
      .from('instagram_leads')
      .upsert(
        { username, niche, followers, lite_score, source: 'manual' },
        { onConflict: 'username', ignoreDuplicates: false }
      )
      .select('id, username')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, lead: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

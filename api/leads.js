const { getSupabase } = require('./_lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { phone, whatsapp, instagram, category, min_followers, max_followers, tag } = req.query;

    let query = supabase
      .from('shopify_stores')
      .select('*')
      .eq('is_shopify', true)
      .not('enriched_at', 'is', null)
      .order('ig_followers', { ascending: false, nullsFirst: false });

    if (phone === 'true') query = query.not('phones', 'eq', '{}');
    if (whatsapp === 'true') query = query.not('whatsapp', 'is', null);
    if (instagram === 'true') query = query.not('instagram', 'is', null);
    if (category) query = query.eq('category', category);
    if (tag) query = query.eq('tag', tag);
    if (min_followers) query = query.gte('ig_followers', parseInt(min_followers));
    if (max_followers) query = query.lte('ig_followers', parseInt(max_followers));

    const { data, error } = await query.limit(500);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, tag } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase
      .from('shopify_stores')
      .update({ tag: tag || null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

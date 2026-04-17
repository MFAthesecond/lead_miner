const { getSupabase, verifyCron } = require('./_lib/supabase');

const JUNK_PATTERNS = [
  'log in','login','sign in','signin','sign up','signup','register',
  'test','test store','my store','my shop','example','demo',
  '404','not found','page not found','sayfa bulunamadı',
  'access denied','forbidden','error','hata',
  'coming soon','under construction','maintenance','bakımda',
  'password','parola','şifre',
  'account','hesap','hesabım',
  'cart','checkout','sepet','ödeme',
  'untitled','başlıksız','homepage','anasayfa',
  'welcome to','just another','powered by shopify',
  'create account','reset password','verify',
];

function isJunk(name) {
  if (!name || name.length < 2) return true;
  const t = name.toLowerCase().trim();
  if (t.length > 100) return true;
  if (JUNK_PATTERNS.some(j => t === j || t.startsWith(j + ' ') || t === j.replace(/ /g, ''))) return true;
  if (/^[^a-zA-ZçğıöşüÇĞİÖŞÜ]{3,}$/.test(t)) return true;
  if (/^(test|demo|example)\d*$/i.test(t)) return true;
  return false;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, store_name, url')
    .eq('is_shopify', true)
    .not('enriched_at', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const junkRows = rows.filter(r => isJunk(r.store_name));

  if (req.query.dry === 'true') {
    return res.json({
      total_stores: rows.length,
      junk_count: junkRows.length,
      junk_samples: junkRows.slice(0, 50).map(r => ({ id: r.id, name: r.store_name, url: r.url })),
    });
  }

  const ids = junkRows.map(r => r.id);
  let cleaned = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: upErr } = await supabase
      .from('shopify_stores')
      .update({ is_shopify: false })
      .in('id', batch);
    if (!upErr) cleaned += batch.length;
  }

  return res.json({ ok: true, total_stores: rows.length, cleaned });
};

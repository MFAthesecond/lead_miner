const { getSupabase, verifyCron, UA, isBigBrand } = require('../_lib/supabase');
const cheerio = require('cheerio');

// Tsoft + Ticimax referans/musteri sayfalarindan TR mağaza domain'leri kesfeder.
// shopify_stores tablosuna is_shopify=false, source='tsoft'/'ticimax' ile yazar.
// Mevcut enrich.js bu sitelerden IG/email/footer cikarir.
// Sonra ig-seed bu IG'leri instagram_leads'e tasiyacak.

const SOURCES = [
  { name: 'tsoft',   url: 'https://www.tsoft.com.tr/referanslar' },
  { name: 'ticimax', url: 'https://www.ticimax.com/referanslarimiz' },
];

const PANEL_INTERNAL = new Set([
  'tsoft.com.tr','tsoftapps.com','tsoftthemes.com','tsoftmobil.com','tsoft360.com',
  'developer.tsoftapps.com','connectprof.com','smartydata.com','cargong.com',
  'helorobo.com','sendheap.com','nildesk.com',
  'ticimax.com','destekalani.com',
  'facebook.com','twitter.com','x.com','instagram.com','youtube.com',
  'linkedin.com','tiktok.com','pinterest.com','google.com','apple.com',
  'play.google.com','itunes.apple.com',
]);

function isJunkHost(host) {
  if (!host) return true;
  const h = host.toLowerCase().replace(/^www\./, '');
  if (PANEL_INTERNAL.has(h)) return true;
  for (const skip of PANEL_INTERNAL) {
    if (h.endsWith('.' + skip)) return true;
  }
  return false;
}

async function fetchDomains(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'tr-TR,tr;q=0.9' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return { error: `status_${resp.status}`, domains: [] };
  const html = await resp.text();
  const $ = cheerio.load(html);
  const found = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, '');
      if (isJunkHost(host)) return;
      if (isBigBrand && isBigBrand(host)) return;
      // TR-related domains: .tr, .com.tr, .com (cogu Turk butik .com)
      if (!/\.(tr|com|net|co|org|shop|store)$/i.test(host)) return;
      found.add(host);
    } catch {}
  });

  return { error: null, domains: [...found] };
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const stats = {};
  const allDomains = new Map(); // domain -> source

  for (const src of SOURCES) {
    const { error, domains } = await fetchDomains(src.url);
    stats[src.name] = { error, count: domains.length };
    for (const d of domains) {
      if (!allDomains.has(d)) allDomains.set(d, src.name);
    }
  }

  if (allDomains.size === 0) {
    return res.json({ ok: true, sources: stats, found: 0, inserted: 0 });
  }

  // Mevcutlari kontrol et
  const domainList = [...allDomains.keys()];
  const existing = new Set();
  for (let i = 0; i < domainList.length; i += 200) {
    const chunk = domainList.slice(i, i + 200);
    const { data } = await supabase
      .from('shopify_stores')
      .select('domain')
      .in('domain', chunk);
    for (const r of data || []) existing.add(r.domain);
  }

  const newRows = [];
  for (const [domain, source] of allDomains) {
    if (existing.has(domain)) continue;
    newRows.push({
      url: `https://${domain}`,
      domain,
      is_shopify: false,
      source,
    });
  }

  let inserted = 0;
  if (newRows.length) {
    for (let i = 0; i < newRows.length; i += 100) {
      const batch = newRows.slice(i, i + 100);
      const { data, error } = await supabase
        .from('shopify_stores')
        .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
        .select('id');
      if (error) return res.status(500).json({ error: error.message, inserted });
      if (data) inserted += data.length;
    }
  }

  return res.json({
    ok: true,
    sources: stats,
    found: allDomains.size,
    existing: existing.size,
    inserted,
    sample: newRows.slice(0, 10).map(r => r.domain),
  });
};

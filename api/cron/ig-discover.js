const { getSupabase, verifyCron, UA } = require('../_lib/supabase');
const { extractUsername } = require('../_lib/ig');
const cheerio = require('cheerio');

const NICHES = [
  'butik','online butik','tesettur butik','kadin giyim','erkek giyim','cocuk giyim',
  'taki tasarim','el yapimi taki','gumus taki','aksesuar',
  'kozmetik','dogal kozmetik','makyaj','cilt bakim','parfum',
  'gelinlik','abiye','nisanlik','dugun',
  'kuafor','berber','guzellik salonu','manikur','nail artist',
  'kas kirpik','microblading','kalici makyaj','epilasyon',
  'estetik','dermatoloji','dis klinigi','agiz dis sagligi','klinik',
  'fizyoterapi','psikolog','diyetisyen','beslenme uzmani',
  'kafe','kahveci','restoran','pastane','tatlici','dondurma',
  'food blogger','yemek tarifleri','ev yemekleri','catering',
  'beauty blogger','moda blogger','lifestyle blogger',
  'fitness','spor egitmeni','yoga','pilates','kisisel antrenor',
  'kurs','egitim','dil kursu','muzik kursu','dans kursu',
  'pet shop','veteriner','kopek egitimi','kedi maması',
  'oto galeri','araç bakim','oto detailing',
  'emlak danismani','gayrimenkul',
  'el yapimi','handmade','seramik atolye','mum atolye','sabun atolye',
  'gurme','organik gida','dogal urun','baharatci',
  'cicek','cicekci','dugun cicegi',
  'fotografci','dugun fotografcisi','newborn fotografcisi',
  'organizasyon','dugun organizasyonu','event planner',
];

const CITIES = [
  'istanbul','ankara','izmir','bursa','antalya','adana','konya',
  'gaziantep','kayseri','mersin','eskisehir','denizli','samsun','trabzon',
];

const TEMPLATES = [
  'site:instagram.com {nis} {sehir}',
  'site:instagram.com {nis}',
  'site:instagram.com online {nis}',
  '{nis} instagram {sehir}',
  '{nis} instagram turkiye',
  'instagram {nis} hesabi',
];

const DDG_QUERIES_PER_RUN = parseInt(process.env.IG_DISCOVER_DDG_PER_RUN || '2', 10);

function generateQueries(count) {
  const out = new Set();
  while (out.size < count) {
    const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const n = NICHES[Math.floor(Math.random() * NICHES.length)];
    const c = CITIES[Math.floor(Math.random() * CITIES.length)];
    out.add(t.replace('{nis}', n).replace('{sehir}', c));
  }
  return [...out];
}

function nicheFromQuery(q) {
  const lower = q.toLowerCase();
  for (const n of NICHES) {
    if (lower.includes(n)) return n;
  }
  return null;
}

function extractInstagramUsernamesFromDDG(html) {
  const $ = cheerio.load(html);
  const found = new Map();

  $('a.result__a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const decoded = decodeURIComponent(href);
    const m = decoded.match(/uddg=(https?[^&]+)/);
    if (!m) return;
    try {
      const u = new URL(m[1]);
      if (!u.hostname.endsWith('instagram.com')) return;
      const path = u.pathname.replace(/^\//, '').replace(/\/$/, '');
      if (!path || path.includes('/')) return;
      const username = extractUsername(path);
      if (!username) return;
      found.set(username, (found.get(username) || 0) + 1);
    } catch {}
  });

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})(?:\/|\?|$)/i);
    if (!m) return;
    const username = extractUsername(m[1]);
    if (!username) return;
    found.set(username, (found.get(username) || 0) + 1);
  });

  return found;
}

async function searchDDG(query) {
  const usernames = new Map();
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return usernames;
    const html = await resp.text();
    const found = extractInstagramUsernamesFromDDG(html);
    for (const [u, n] of found) usernames.set(u, n);
  } catch {}
  return usernames;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const queries = generateQueries(DDG_QUERIES_PER_RUN);

  const all = new Map();
  const queryNiche = new Map();

  await Promise.all(queries.map(async (q) => {
    const niche = nicheFromQuery(q);
    const found = await searchDDG(q);
    for (const [username, hits] of found) {
      const prev = all.get(username) || { hits: 0, niche: null };
      all.set(username, {
        hits: prev.hits + hits,
        niche: prev.niche || niche,
      });
      if (niche) queryNiche.set(username, niche);
    }
  }));

  if (all.size === 0) {
    return res.json({ ok: true, queries, found: 0, inserted: 0 });
  }

  const usernames = [...all.keys()];
  const { data: existing } = await supabase
    .from('instagram_leads')
    .select('username')
    .in('username', usernames);

  const existingSet = new Set((existing || []).map(r => r.username));
  const newRows = [];
  for (const [username, info] of all) {
    if (existingSet.has(username)) continue;
    newRows.push({
      username,
      niche: info.niche,
      source: 'ddg_discover',
    });
  }

  let inserted = 0;
  if (newRows.length) {
    const { data, error } = await supabase
      .from('instagram_leads')
      .upsert(newRows, { onConflict: 'username', ignoreDuplicates: true })
      .select('id');
    if (error) return res.status(500).json({ error: error.message });
    if (data) inserted = data.length;
  }

  return res.json({
    ok: true,
    queries,
    found: all.size,
    new_candidates: newRows.length,
    inserted,
    sample: newRows.slice(0, 10).map(r => r.username),
  });
};

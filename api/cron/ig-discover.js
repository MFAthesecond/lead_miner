const { getSupabase, verifyCron } = require('../_lib/supabase');
const { extractUsername } = require('../_lib/ig');

const NICHES = [
  // Moda / Giyim
  'butik','online butik','tesettur butik','kadin giyim','erkek giyim','cocuk giyim',
  'bebek giyim','buyuk beden butik','vintage butik','streetwear',
  // Taki / Aksesuar / Deri
  'taki tasarim','el yapimi taki','gumus taki','aksesuar','dogal tas taki',
  'deri canta','el yapimi canta','cuzdan',
  // Kozmetik / Guzellik
  'kozmetik','dogal kozmetik','organik kozmetik','makyaj','cilt bakim','parfum',
  'kuafor','berber','guzellik salonu','manikur','nail artist',
  'kas kirpik','microblading','kalici makyaj','epilasyon','spa',
  // Saglik / Klinik
  'estetik','dermatoloji','dis klinigi','klinik','fizyoterapi',
  'psikolog','diyetisyen','beslenme uzmani','aile hekimi',
  // Dugun / Etkinlik
  'gelinlik','abiye','nisanlik','dugun','dugun organizasyonu','event planner',
  'dugun fotografcisi','newborn fotografcisi','dugun cicegi',
  // Yeme / Icme
  'kafe','kahveci','restoran','pastane','tatlici','dondurma','baklava',
  'food blogger','yemek tarifleri','ev yemekleri','catering','butik tatli',
  // Blogger / Icerik
  'beauty blogger','moda blogger','lifestyle blogger','seyahat blogger',
  'anne blogger','baba blogger','dekor blogger',
  // Spor / Wellness
  'fitness','spor egitmeni','yoga','pilates','kisisel antrenor',
  'crossfit','kickbox','dans egitmeni',
  // Egitim
  'kurs','egitim','dil kursu','muzik kursu','dans kursu','ozel ders',
  // Pet
  'pet shop','veteriner','kopek egitimi','kedi maması','pet otel',
  // Oto / Emlak
  'oto galeri','araç bakim','oto detailing','emlak danismani','gayrimenkul',
  // El yapimi / Atelye
  'el yapimi','handmade','seramik atolye','mum atolye','sabun atolye',
  'cicek atolye','resin atolye','epoksi atolye',
  // Gida / Gurme
  'gurme','organik gida','dogal urun','baharatci','kahve dukkani',
  // Cicek / Dekor
  'cicek','cicekci','ev dekorasyon','dekor magaza',
  // Fotograf
  'fotografci','urun fotografcisi','portre fotografcisi',
];

const TEMPLATES = [
  'site:instagram.com {nis}',
  'site:instagram.com {nis} turkiye',
  'site:instagram.com "{nis}"',
  'site:instagram.com {nis} dm siparis',
  'site:instagram.com {nis} whatsapp',
];

const QUERIES_PER_RUN = parseInt(process.env.IG_DISCOVER_QUERIES_PER_RUN || '1', 10);
const RESULTS_PER_QUERY = parseInt(process.env.IG_DISCOVER_RESULTS_PER_QUERY || '20', 10);
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';

const NON_USER_PATHS = new Set([
  'reel','reels','p','tv','explore','accounts','stories','direct',
  'about','developer','legal','privacy','terms','blog','press','help',
  'web','api','oauth','login','signup','share','sharer',
]);

function generateQueries(count) {
  const out = new Set();
  while (out.size < count) {
    const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const n = NICHES[Math.floor(Math.random() * NICHES.length)];
    out.add(t.replace('{nis}', n));
  }
  return [...out];
}

function nicheFromQuery(q) {
  const lower = q.toLowerCase();
  const sorted = [...NICHES].sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    if (lower.includes(n)) return n;
  }
  return null;
}

function tryExtractFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith('instagram.com')) return null;
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const first = segments[0].toLowerCase();
    if (NON_USER_PATHS.has(first)) return null;
    return extractUsername(first);
  } catch {
    return null;
  }
}

async function searchBrave(query) {
  const usernames = new Map();
  if (!BRAVE_API_KEY) return { usernames, error: 'no_api_key' };
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&country=TR&search_lang=tr&count=${RESULTS_PER_QUERY}&safesearch=off`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.status === 429) return { usernames, error: 'rate_limited' };
    if (!resp.ok) return { usernames, error: `http_${resp.status}` };

    const data = await resp.json();
    const results = data?.web?.results || [];
    for (const r of results) {
      const candidates = [r.url, r.profile?.url].filter(Boolean);
      for (const u of candidates) {
        const username = tryExtractFromUrl(u);
        if (!username) continue;
        usernames.set(username, (usernames.get(username) || 0) + 1);
      }
      // description ve title icindeki ig.com/USERNAME pattern'leri
      const text = `${r.title || ''} ${r.description || ''}`;
      const inlineRx = /instagram\.com\/([a-zA-Z0-9_.]{2,30})/gi;
      let m;
      while ((m = inlineRx.exec(text)) !== null) {
        const seg = m[1].toLowerCase();
        if (NON_USER_PATHS.has(seg)) continue;
        const username = extractUsername(seg);
        if (!username) continue;
        usernames.set(username, (usernames.get(username) || 0) + 1);
      }
    }

    return { usernames, count: results.length };
  } catch (e) {
    return { usernames, error: e.message };
  }
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!BRAVE_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'BRAVE_API_KEY env var tanimlanmamis. brave.com/search/api/ uzerinden free key al, Vercel env vars\'a ekle.',
    });
  }

  const supabase = getSupabase();
  const queries = generateQueries(QUERIES_PER_RUN);

  const all = new Map();
  const errors = [];
  let totalResults = 0;

  await Promise.all(queries.map(async (q) => {
    const niche = nicheFromQuery(q);
    const { usernames, count, error } = await searchBrave(q);
    if (error) errors.push({ query: q, error });
    if (count) totalResults += count;
    for (const [username, hits] of usernames) {
      const prev = all.get(username) || { hits: 0, niche: null };
      all.set(username, {
        hits: prev.hits + hits,
        niche: prev.niche || niche,
      });
    }
  }));

  if (all.size === 0) {
    return res.json({
      ok: true,
      queries,
      brave_results: totalResults,
      found: 0,
      inserted: 0,
      errors,
    });
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
      source: 'brave_discover',
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
    brave_results: totalResults,
    found: all.size,
    existing: usernames.length - newRows.length,
    new_candidates: newRows.length,
    inserted,
    sample: newRows.slice(0, 10).map(r => r.username),
    errors,
  });
};

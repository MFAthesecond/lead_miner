const { getSupabase, verifyCron, UA } = require('../_lib/supabase');
const { extractUsername } = require('../_lib/ig');
const cheerio = require('cheerio');

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
  '{nis} instagram turkiye',
  '{nis} instagram hesabi',
  'instagram {nis} turkiye',
];

const DDG_QUERIES_PER_RUN = parseInt(process.env.IG_DISCOVER_DDG_PER_RUN || '3', 10);
const GOOGLE_QUERIES_PER_RUN = parseInt(process.env.IG_DISCOVER_GOOGLE_PER_RUN || '2', 10);
const YANDEX_QUERIES_PER_RUN = parseInt(process.env.IG_DISCOVER_YANDEX_PER_RUN || '2', 10);

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
  // Once en uzun nisleri dene (false positive azaltir)
  const sorted = [...NICHES].sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    if (lower.includes(n)) return n;
  }
  return null;
}

const NON_USER_PATHS = new Set([
  'reel','reels','p','tv','explore','accounts','stories','direct',
  'about','developer','legal','privacy','terms','blog','press','help',
  'web','api','oauth','login','signup','share','sharer',
]);

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

function extractInstagramUsernamesFromDDG(html) {
  const $ = cheerio.load(html);
  const found = new Map();
  const formData = {};

  $('a.result__a, a.result__url').each((_, el) => {
    const href = $(el).attr('href') || '';
    const decoded = decodeURIComponent(href);
    const m = decoded.match(/uddg=(https?[^&]+)/);
    const target = m ? m[1] : (href.startsWith('http') ? href : null);
    if (!target) return;
    const username = tryExtractFromUrl(target);
    if (!username) return;
    found.set(username, (found.get(username) || 0) + 1);
  });

  // Snippet/text icindeki instagram.com/USERNAME pattern'leri
  const html_text = $.html();
  const inlineRx = /instagram\.com\/([a-zA-Z0-9_.]{2,30})(?:[\/?#"'\s]|$)/gi;
  let m;
  while ((m = inlineRx.exec(html_text)) !== null) {
    const seg = m[1].toLowerCase();
    if (NON_USER_PATHS.has(seg)) continue;
    const username = extractUsername(seg);
    if (!username) continue;
    found.set(username, (found.get(username) || 0) + 1);
  }

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value');
    if (name && val !== undefined) formData[name] = val;
  });

  return { found, formData };
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
    const { found, formData } = extractInstagramUsernamesFromDDG(html);
    for (const [u, n] of found) usernames.set(u, (usernames.get(u) || 0) + n);

    // Pagination - 2. sayfa
    if (formData.q && formData.s) {
      try {
        const body = Object.entries(formData)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        const resp2 = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Language': 'tr-TR,tr;q=0.9',
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (resp2.ok) {
          const html2 = await resp2.text();
          const { found: f2 } = extractInstagramUsernamesFromDDG(html2);
          for (const [u, n] of f2) usernames.set(u, (usernames.get(u) || 0) + n);
        }
      } catch {}
    }
  } catch {}
  return usernames;
}

function extractIgUsernamesFromHtml(html) {
  const usernames = new Map();
  const inlineRx = /instagram\.com\/([a-zA-Z0-9_.]{2,30})(?:[\/?#"'\s]|$)/gi;
  let m;
  while ((m = inlineRx.exec(html)) !== null) {
    const seg = m[1].toLowerCase();
    if (NON_USER_PATHS.has(seg)) continue;
    const username = extractUsername(seg);
    if (!username) continue;
    usernames.set(username, (usernames.get(username) || 0) + 1);
  }
  return usernames;
}

async function searchGoogle(query) {
  const start = Math.floor(Math.random() * 5) * 10;
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=30&start=${start}&hl=tr&gl=tr`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return new Map();
    return extractIgUsernamesFromHtml(await resp.text());
  } catch { return new Map(); }
}

async function searchYandex(query) {
  // Yandex Turkiye - lr=11508 Istanbul region kodu, TR sonuclari onceler
  try {
    const url = `https://yandex.com.tr/search/?text=${encodeURIComponent(query)}&lr=11508&numdoc=30`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://yandex.com.tr/',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return new Map();
    const html = await resp.text();
    // Yandex captcha sayfasini tespit et
    if (html.includes('showcaptcha') || html.includes('captcha-page')) return new Map();
    return extractIgUsernamesFromHtml(html);
  } catch { return new Map(); }
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const ddgQueries = generateQueries(DDG_QUERIES_PER_RUN);
  const googleQueries = generateQueries(GOOGLE_QUERIES_PER_RUN);
  const yandexQueries = generateQueries(YANDEX_QUERIES_PER_RUN);

  const all = new Map();
  const sources = { ddg: 0, google: 0, yandex: 0 };

  function merge(searchName, niche, found) {
    sources[searchName] += found.size;
    for (const [username, hits] of found) {
      const prev = all.get(username) || { hits: 0, niche: null };
      all.set(username, {
        hits: prev.hits + hits,
        niche: prev.niche || niche,
      });
    }
  }

  const ddgPromises = ddgQueries.map(async (q) => {
    merge('ddg', nicheFromQuery(q), await searchDDG(q));
  });
  const googlePromises = googleQueries.map(async (q) => {
    merge('google', nicheFromQuery(q), await searchGoogle(q));
  });
  const yandexPromises = yandexQueries.map(async (q) => {
    merge('yandex', nicheFromQuery(q), await searchYandex(q));
  });

  await Promise.all([...ddgPromises, ...googlePromises, ...yandexPromises]);

  if (all.size === 0) {
    return res.json({
      ok: true,
      ddg_queries: ddgQueries,
      google_queries: googleQueries,
      yandex_queries: yandexQueries,
      sources,
      found: 0,
      inserted: 0,
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
    ddg_queries: ddgQueries,
    google_queries: googleQueries,
    yandex_queries: yandexQueries,
    sources,
    found: all.size,
    existing: usernames.length - newRows.length,
    new_candidates: newRows.length,
    inserted,
    sample: newRows.slice(0, 10).map(r => r.username),
  });
};

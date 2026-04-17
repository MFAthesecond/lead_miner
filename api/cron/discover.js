const { getSupabase, verifyCron, UA, BIG_BRANDS, isBigBrand, domainFromUrl } = require('../_lib/supabase');
const cheerio = require('cheerio');

const ALL_PAGES = [
  // Store Leads - ana sayfa
  'https://storeleads.app/reports/shopify/TR/top-stores',
  // Store Leads - sehirler (25 sehir)
  'https://storeleads.app/reports/shopify/TR/city/%c4%b0stanbul',
  'https://storeleads.app/reports/shopify/TR/city/Ankara',
  'https://storeleads.app/reports/shopify/TR/city/%c4%b0zmir',
  'https://storeleads.app/reports/shopify/TR/city/Bursa',
  'https://storeleads.app/reports/shopify/TR/city/Antalya',
  'https://storeleads.app/reports/shopify/TR/city/Denizli',
  'https://storeleads.app/reports/shopify/TR/city/Kayseri',
  'https://storeleads.app/reports/shopify/TR/city/Konya',
  'https://storeleads.app/reports/shopify/TR/city/Mersin',
  'https://storeleads.app/reports/shopify/TR/city/Adana',
  'https://storeleads.app/reports/shopify/TR/city/Gaziantep',
  'https://storeleads.app/reports/shopify/TR/city/Kocaeli',
  'https://storeleads.app/reports/shopify/TR/city/Trabzon',
  'https://storeleads.app/reports/shopify/TR/city/Samsun',
  'https://storeleads.app/reports/shopify/TR/city/Malatya',
  'https://storeleads.app/reports/shopify/TR/city/Manisa',
  'https://storeleads.app/reports/shopify/TR/city/Hatay',
  'https://storeleads.app/reports/shopify/TR/city/Diyarbak%c4%b1r',
  'https://storeleads.app/reports/shopify/TR/city/%c5%9eanl%c4%b1urfa',
  'https://storeleads.app/reports/shopify/TR/city/Eski%c5%9fehir',
  'https://storeleads.app/reports/shopify/TR/city/Tekirda%c4%9f',
  'https://storeleads.app/reports/shopify/TR/city/Sakarya',
  'https://storeleads.app/reports/shopify/TR/city/Ayd%c4%b1n',
  'https://storeleads.app/reports/shopify/TR/city/Bal%c4%b1kesir',
  'https://storeleads.app/reports/shopify/TR/city/Mu%c4%9fla',
  // Store Leads - bolgeler (region, sehirden farkli veriler doner)
  'https://storeleads.app/reports/shopify/TR/region/%C4%B0stanbul',
  'https://storeleads.app/reports/shopify/TR/region/Ankara',
  'https://storeleads.app/reports/shopify/TR/region/%C4%B0zmir',
  'https://storeleads.app/reports/shopify/TR/region/Bursa',
  'https://storeleads.app/reports/shopify/TR/region/Antalya',
  'https://storeleads.app/reports/shopify/TR/region/Denizli',
  'https://storeleads.app/reports/shopify/TR/region/Kayseri',
  'https://storeleads.app/reports/shopify/TR/region/Konya',
  'https://storeleads.app/reports/shopify/TR/region/Gaziantep',
  'https://storeleads.app/reports/shopify/TR/region/Kocaeli',
  'https://storeleads.app/reports/shopify/TR/region/Mersin',
  'https://storeleads.app/reports/shopify/TR/region/Adana',
  'https://storeleads.app/reports/shopify/TR/region/Trabzon',
  'https://storeleads.app/reports/shopify/TR/region/Samsun',
  'https://storeleads.app/reports/shopify/TR/region/Mu%C4%9Fla',
  // Store Leads - kategoriler (12 kategori)
  'https://storeleads.app/reports/shopify/TR/category/Apparel',
  'https://storeleads.app/reports/shopify/TR/category/Home%20%26%20Garden',
  'https://storeleads.app/reports/shopify/TR/category/Beauty%20%26%20Fitness',
  'https://storeleads.app/reports/shopify/TR/category/Food%20%26%20Drink',
  'https://storeleads.app/reports/shopify/TR/category/Health',
  'https://storeleads.app/reports/shopify/TR/category/Pets%20%26%20Animals',
  'https://storeleads.app/reports/shopify/TR/category/Sports',
  'https://storeleads.app/reports/shopify/TR/category/Consumer%20Electronics',
  'https://storeleads.app/reports/shopify/TR/category/Toys%20%26%20Hobbies',
  'https://storeleads.app/reports/shopify/TR/category/Arts%20%26%20Entertainment',
  'https://storeleads.app/reports/shopify/TR/category/Gifts%20%26%20Special%20Events',
  'https://storeleads.app/reports/shopify/TR/category/Autos%20%26%20Vehicles',
  'https://storeleads.app/reports/shopify/TR/category/People%20%26%20Society',
  'https://storeleads.app/reports/shopify/TR/category/Business%20%26%20Industrial',
  'https://storeleads.app/reports/shopify/TR/category/Books%20%26%20Literature',
  'https://storeleads.app/reports/shopify/TR/category/Computers',
  'https://storeleads.app/reports/shopify/TR/category/Games',
  'https://storeleads.app/reports/shopify/TR/category/Travel',
  // Store Leads - Turk Shopify app kullanicilari
  'https://storeleads.app/reports/shopify/app/e-ticaret-sozlesmeleri',
  'https://storeleads.app/reports/shopify/app/kargo-yonetimi',
  'https://storeleads.app/reports/shopify/app/judgeme',
  'https://storeleads.app/reports/shopify/app/pagefly',
  'https://storeleads.app/reports/shopify/app/loox',
  'https://storeleads.app/reports/shopify/app/instafeed',
  // Diger kaynaklar
  'https://www.cartinsight.io/shopify-stores-in-turkey/',
  'https://www.skailama.com/shopify-stores/turkey',
  'https://www.aftership.com/store-list/top-100-tr-shopify-stores',
  'https://analyzify.com/shopify-stores/l/turkey',
];

const DDG_QUERIES = [
  'myshopify.com türkiye mağaza',
  'myshopify.com istanbul alışveriş',
  'myshopify.com kozmetik türkiye',
  'myshopify.com spor giyim türkiye',
  'myshopify.com takı aksesuar istanbul',
  'myshopify.com kahve türk',
  'myshopify.com organik doğal türkiye',
  'myshopify.com giyim moda türkiye',
  'myshopify.com ev dekorasyon türkiye',
  'myshopify.com bebek çocuk türkiye',
  'myshopify.com ayakkabı çanta türkiye',
  'myshopify.com pet evcil hayvan türkiye',
  'myshopify.com elektronik aksesuar türkiye',
  'myshopify.com bijuteri gümüş türkiye',
  'myshopify.com mobilya türkiye',
  'myshopify.com halı kilim türkiye',
  '.com.tr shopify mağaza',
  '.com.tr "Powered by Shopify"',
  'myshopify.com ankara izmir',
  'myshopify.com antalya bursa',
];

const PAGES_PER_RUN = 3;

function extractDomains(html, isSkailama) {
  const $ = cheerio.load(html);
  const domains = new Set();

  if (isSkailama) {
    const skip = ['Top','FAQ','How','Explore','Conclusion','Success','Curated','Ecommerce'];
    $('h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 40 && !skip.some(w => text.includes(w))) {
        const slug = text.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!BIG_BRANDS.has(slug)) domains.add(`https://${slug}.myshopify.com`);
      }
    });
    return domains;
  }

  if (html.includes('<table')) {
    $('table tr').slice(1).each((_, row) => {
      const name = $(row).find('td').first().text().trim();
      if (name.startsWith('http')) {
        domains.add(name.includes('://') ? name : `https://${name}`);
      } else if (name) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (slug) domains.add(`https://${slug}.myshopify.com`);
      }
    });
  }

  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes('.') && (text.includes('com') || text.includes('tr'))
        && !text.includes('storeleads') && !text.includes('shopify')
        && text.length < 60) {
      const d = text.startsWith('http') ? text : `https://${text}`;
      if (!isBigBrand(d)) domains.add(d);
    }
  });

  return domains;
}

async function searchDDG(query) {
  const domains = new Set();
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return domains;
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const decoded = decodeURIComponent(href);
      const m = decoded.match(/uddg=(https?[^&]+)/);
      if (!m) return;
      try {
        const u = new URL(m[1]);
        const host = u.hostname.toLowerCase();
        if (host.includes('myshopify.com') ||
            (host.endsWith('.com.tr') && !host.includes('shopify.com') && !host.includes('google'))) {
          const d = 'https://' + host;
          if (!isBigBrand(d)) domains.add(d);
        }
      } catch {}
    });
  } catch {}
  return domains;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const allUrls = new Set();
  let source = '';

  // %50 ihtimalle DuckDuckGo, %50 ihtimalle sayfa tarama
  const useDDG = Math.random() < 0.5;

  if (useDDG) {
    source = 'duckduckgo';
    const query = DDG_QUERIES[Math.floor(Math.random() * DDG_QUERIES.length)];
    const found = await searchDDG(query);
    for (const d of found) allUrls.add(d);
  } else {
    source = 'pages';
    const shuffled = [...ALL_PAGES].sort(() => Math.random() - 0.5);
    const pages = shuffled.slice(0, PAGES_PER_RUN);
    for (const url of pages) {
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) continue;
        const html = await resp.text();
        const isSkailama = url.includes('skailama');
        for (const d of extractDomains(html, isSkailama)) allUrls.add(d);
      } catch {}
    }
  }

  // Upsert
  const rows = [...allUrls]
    .filter(u => !isBigBrand(u))
    .map(url => ({ url, domain: domainFromUrl(url) }));

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await supabase
      .from('shopify_stores')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    if (!error && data) inserted = data.length;
  }

  return res.json({
    ok: true,
    source,
    domains_found: allUrls.size,
    inserted,
  });
};

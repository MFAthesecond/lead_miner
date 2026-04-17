const { getSupabase, verifyCron, UA, BIG_BRANDS, isBigBrand, domainFromUrl } = require('../_lib/supabase');

const SEED_DOMAINS = [
  'https://aliscoppershop.com','https://altinbasak.com','https://balpdijital.com',
  'https://bikafa.com','https://birinci1926.com','https://cilek.com',
  'https://coolhali.com','https://cottonbox.com.tr','https://ecanta.com.tr',
  'https://elvishoney.com','https://evle.com.tr','https://fatmaatasoy.com',
  'https://gettoderi.com','https://goodpack.com.tr','https://iloveshoes.com.tr',
  'https://irya.com','https://jly.com.tr','https://kolayoto.com',
  'https://leblebicarsisi.com','https://limmolimonata.com','https://mambakid.com.tr',
  'https://mocacocoffee.com','https://navimarine.com.tr','https://nssposa.com',
  'https://osmanlikahvecisi.com','https://petekboncuk.com','https://purealco.com',
  'https://roarcraft.com.tr','https://sleeppeople.com.tr','https://sohoantiq.com',
  'https://ugurbisiklet.com','https://ulugames.com.tr','https://wraithesports.com',
  'https://www.balasagun.com.tr','https://www.bisan.com.tr','https://www.hobium.com',
  'https://www.incicicegi.com.tr','https://www.interpharm.com.tr','https://www.mclocks.com',
  'https://www.rani.com.tr','https://www.silifkesepeti.com','https://www.wolfdizayn.com',
  'https://zihnibaba.com','https://alba-ebikes.com',
  'https://www.antregourmet.com','https://www.boxxcoffee.com','https://www.birdiejay.com',
  'https://www.dodobazaar.com','https://selmacilek.com','https://www.normaillot.com',
  'https://www.aidabergsen.com','https://www.annalaudel.gallery',
  'https://paulkenzie.com','https://www.korendy.com','https://takehiq.com',
  'https://kudenrugs.com','https://due2store.com','https://www.butikbira.com',
  'https://www.studionkistanbul.com','https://erkandemiroglu.com',
  'https://www.galenleather.com','https://atolyestone.com','https://davidguner.com',
  'https://www.solastore.com.tr',
  'https://abkcase.com','https://aishaclub.com','https://akyuzmobilya.com',
  'https://alpbx.com.tr','https://birdunyaesarp.com','https://chimommy.com',
  'https://ciravonline.com','https://elektroyou.com','https://gurmeenginar.com.tr',
  'https://hevselbahcesi.com','https://hysavm.com','https://izgikuyumculuk.com',
  'https://kumaskumas.com','https://lanaturel.com','https://oleamea.com.tr',
  'https://petrapetrova.com','https://pierhali.com','https://pratikhomee.com',
  'https://reeder.com.tr','https://smartsaat.com','https://svgcosmos.com',
  'https://tabia.com.tr','https://tanisonline.com','https://terraedessa.com',
  'https://teveddud.com','https://ucel.com.tr','https://urfamisotcun.com',
  'https://vavrattan.com','https://vizyoniletisim.com.tr',
  'https://www.aurorajewerlly.com','https://www.babybaby.com.tr',
  'https://www.crystalstore.com.tr','https://www.ecumann.com',
  'https://www.karaoklar.com','https://www.kinary.com.tr',
  'https://www.lilacosmetics.com.tr','https://www.loagen.com.tr',
  'https://www.novatoys.com.tr','https://www.postifull.com.tr',
  'https://www.swordwatchstrap.com','https://www.zentoratr.com','https://yagderesi.com',
];

const SL_CITIES = [
  '%c4%b0stanbul','Ankara','%c4%b0zmir','Bursa','Antalya','Denizli',
  'Kayseri','Konya','Mersin','Adana','Mu%c4%9fla','Gaziantep',
  'Tekirda%c4%9f','Eski%c5%9fehir','Sakarya','Kocaeli','Trabzon',
  'Samsun','Malatya','Manisa','Ayd%c4%b1n','Bal%c4%b1kesir','Hatay',
];

const SL_CATEGORIES = [
  'Apparel','Home%20%26%20Garden','Beauty%20%26%20Fitness',
  'Food%20%26%20Drink','Health','Pets%20%26%20Animals','Sports',
  'Arts%20%26%20Entertainment','Consumer%20Electronics',
  'Toys%20%26%20Hobbies','Gifts%20%26%20Special%20Events',
  'Autos%20%26%20Vehicles',
];

async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) return '';
  return resp.text();
}

function extractDomains(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const domains = new Set();
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

async function scrapeStoreLeads() {
  const allDomains = new Set();
  const urls = [];
  for (const c of SL_CITIES) urls.push(`https://storeleads.app/reports/shopify/TR/city/${c}`);
  for (const c of SL_CATEGORIES) urls.push(`https://storeleads.app/reports/shopify/TR/category/${c}`);
  urls.push('https://storeleads.app/reports/shopify/TR/top-stores');

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      if (html) for (const d of extractDomains(html)) allDomains.add(d);
    } catch {}
    await new Promise(r => setTimeout(r, 800));
  }
  return allDomains;
}

async function scrapeCartInsight() {
  const domains = new Set();
  try {
    const html = await fetchHtml('https://www.cartinsight.io/shopify-stores-in-turkey/');
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    $('table tr').slice(1).each((_, row) => {
      const name = $(row).find('td').first().text().trim();
      if (name.startsWith('http')) {
        domains.add(name.includes('://') ? name : `https://${name}`);
      } else if (name) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        domains.add(`https://${slug}.myshopify.com`);
      }
    });
  } catch {}
  return domains;
}

async function scrapeSkailama() {
  const domains = new Set();
  try {
    const html = await fetchHtml('https://www.skailama.com/shopify-stores/turkey');
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const skip = new Set(['Top','FAQ','How','Explore','Conclusion','Success','Curated','Ecommerce']);
    $('h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 40 && ![...skip].some(w => text.includes(w))) {
        const slug = text.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!BIG_BRANDS.has(slug)) domains.add(`https://${slug}.myshopify.com`);
      }
    });
  } catch {}
  return domains;
}

async function resolveMyshopify(urls) {
  const resolved = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'HEAD', redirect: 'follow',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok && !resp.url.includes('/password')) {
        resolved.push(resp.url.replace(/\/$/, ''));
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return resolved;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const allUrls = new Set();
  const myshopifyUrls = [];

  // 1) Seed list
  for (const url of SEED_DOMAINS) {
    if (url.includes('.myshopify.com')) myshopifyUrls.push(url);
    else allUrls.add(url);
  }

  // 2) Store Leads
  const sl = await scrapeStoreLeads();
  for (const url of sl) {
    if (url.includes('.myshopify.com')) myshopifyUrls.push(url);
    else allUrls.add(url);
  }

  // 3) CartInsight
  const ci = await scrapeCartInsight();
  for (const url of ci) {
    if (url.includes('.myshopify.com')) myshopifyUrls.push(url);
    else allUrls.add(url);
  }

  // 4) Skailama
  const sk = await scrapeSkailama();
  for (const url of sk) myshopifyUrls.push(url);

  // 5) Resolve myshopify domains
  const unique = [...new Set(myshopifyUrls)];
  const resolved = await resolveMyshopify(unique);
  for (const url of resolved) allUrls.add(url);

  // Bulk upsert
  const rows = [...allUrls]
    .filter(u => !isBigBrand(u))
    .map(url => ({ url, domain: domainFromUrl(url) }));

  let inserted = 0;
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('shopify_stores')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    if (!error && data) inserted += data.length;
  }

  return res.json({
    ok: true,
    sources: { seed: SEED_DOMAINS.length, storeLeads: sl.size, cartInsight: ci.size, skailama: sk.size },
    resolved: resolved.length,
    total_urls: allUrls.size,
    inserted,
  });
};

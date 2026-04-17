const { getSupabase, verifyCron, UA } = require('../_lib/supabase');

const JUNK_EMAIL_DOMAINS = new Set([
  'sentry.io','sentry-next.wixpress.com','sentry.wixpress.com',
  'shopify.com','cloudflare.com','google.com','facebook.com',
  'example.com','wixpress.com','schema.org','googleapis.com',
  'jquery.com','w3.org','gmail.com','hotjar.com','intercom.io',
  'zendesk.com','crisp.chat','tawk.to','hubspot.com','mailchimp.com',
]);

const CONTACT_PATHS = [
  '/pages/contact','/pages/contact-us','/pages/iletisim',
  '/pages/bize-ulasin','/pages/about','/pages/about-us','/pages/hakkimizda',
];

const SHOPIFY_SIGS = ['cdn.shopify.com','Shopify.theme','shopify-section','myshopify.com','shopify_analytics'];

const SOCIAL_RX = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i,
  facebook:  /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.]+)/i,
  tiktok:    /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
};

const EMAIL_RX    = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const WA_RX       = /(?:wa\.me\/|whatsapp\.com\/send[^"]*phone=)(\d+)/gi;
const BATCH_SIZE  = 5;

async function fetchPage(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    return resp.text();
  } catch { return null; }
}

function extractEmails(html) {
  const raw = html.match(EMAIL_RX) || [];
  const seen = new Set();
  return raw.filter(e => {
    e = e.toLowerCase();
    const domain = e.split('@')[1];
    if (JUNK_EMAIL_DOMAINS.has(domain)) return false;
    if (/\.(png|jpg|gif|svg|css|js)$/i.test(e)) return false;
    if (e.length > 80 || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}

function extractPhones(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const phones = [];
  const seen = new Set();

  $('a[href^="tel:"]').each((_, el) => {
    const num = $(el).attr('href').replace('tel:', '').replace(/[^\d+]/g, '');
    if (num.length >= 10 && num.length <= 15) {
      const norm = num.replace(/^\+?0*(?:90)?/, '');
      if (!seen.has(norm)) { seen.add(norm); phones.push(num); }
    }
  });

  $('a[href*="whatsapp"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/phone=(\d+)/);
    if (m && m[1].length >= 10) {
      const norm = m[1].replace(/^\+?0*(?:90)?/, '');
      if (!seen.has(norm)) { seen.add(norm); phones.push(m[1]); }
    }
  });

  return phones.slice(0, 5);
}

function extractSocials(html) {
  const result = {};
  for (const [platform, rx] of Object.entries(SOCIAL_RX)) {
    const m = html.match(rx);
    if (m) {
      const user = m[1].replace(/\/$/, '');
      if (!['share','sharer','intent','dialog'].includes(user.toLowerCase())) {
        result[platform] = user;
      }
    }
  }
  return result;
}

function extractWhatsapp(html) {
  const m = html.match(WA_RX);
  if (m) {
    const num = m[0].match(/(\d+)/);
    return num ? num[1] : '';
  }
  return '';
}

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  const cats = {
    'Moda / Giyim': ['giyim','elbise','moda','fashion','wear','tekstil','tunik','pantolon','streetwear','athleisure'],
    'Taki / Aksesuar': ['jewel','taki','aksesuar','bracelet','ring','necklace'],
    'Deri / Canta': ['leather','deri','canta','bag','wallet'],
    'Saat': ['watch','saat','timepiece'],
    'Kozmetik': ['kozmetik','cosmetic','beauty','guzellik','cilt','skin'],
    'Gida / Gurme': ['gida','food','gurme','gourmet','peynir','bal','zeytin','kahve','coffee'],
    'Spor': ['spor','sport','fitness','gym','bisiklet'],
    'Ev / Mobilya': ['mobilya','furniture','home','dekor','ev'],
    'Bebek / Cocuk': ['bebek','baby','cocuk','kid'],
    'Pet': ['pet','hayvan','evcil'],
    'Muzik': ['music','muzik','instrument'],
    'Sanat': ['art','sanat','galeri','gallery'],
  };
  for (const [cat, kws] of Object.entries(cats)) {
    if (kws.some(k => text.includes(k))) return cat;
  }
  return null;
}

async function enrichOne(url) {
  // Tum istekleri paralel baslat
  const contactPs = CONTACT_PATHS.slice(0, 3).map(p =>
    fetchPage(new URL(p, url).href).catch(() => null)
  );
  const productsP = fetch(new URL('/products.json?limit=250', url).href, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(4000),
  }).then(r => r.ok ? r.json() : null).catch(() => null);

  const [mainHtml, ...contactResults] = await Promise.all([
    fetchPage(url), ...contactPs
  ]);
  const productsData = await productsP;

  if (!mainHtml) return { error: 'unreachable' };

  const isShopify = SHOPIFY_SIGS.some(s => mainHtml.toLowerCase().includes(s.toLowerCase()));
  const contactHtml = contactResults.find(h => h) || '';
  const allHtml = mainHtml + '\n' + contactHtml;

  const cheerio = require('cheerio');
  const $ = cheerio.load(mainHtml);
  const title = $('title').text().trim().split(/[|–-]/)[0].trim();
  const descMeta = $('meta[name="description"]').attr('content') || '';
  const description = descMeta.slice(0, 200);

  let currency = null;
  if (mainHtml.includes('₺') || mainHtml.includes('TRY')) currency = 'TRY';
  else if (mainHtml.includes('€') || mainHtml.includes('EUR')) currency = 'EUR';
  else if (mainHtml.includes('$') || mainHtml.includes('USD')) currency = 'USD';

  return {
    store_name: title || null,
    emails: extractEmails(allHtml),
    phones: extractPhones(allHtml),
    instagram: extractSocials(allHtml).instagram ? `https://instagram.com/${extractSocials(allHtml).instagram}` : null,
    facebook: extractSocials(allHtml).facebook ? `https://facebook.com/${extractSocials(allHtml).facebook}` : null,
    tiktok: extractSocials(allHtml).tiktok ? `https://tiktok.com/@${extractSocials(allHtml).tiktok}` : null,
    whatsapp: extractWhatsapp(allHtml) || null,
    category: guessCategory(title, description),
    currency,
    product_count: productsData ? (productsData.products || []).length : null,
    description,
    is_shopify: isShopify,
  };
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, url')
    .is('enriched_at', null)
    .limit(BATCH_SIZE);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.json({ ok: true, enriched: 0, message: 'Nothing to enrich' });

  const results = await Promise.all(rows.map(async (row) => {
    const data = await enrichOne(row.url);
    if (data.error) {
      await supabase.from('shopify_stores')
        .update({ enriched_at: new Date().toISOString(), is_shopify: false })
        .eq('id', row.id);
      return false;
    }
    await supabase.from('shopify_stores')
      .update({ ...data, enriched_at: new Date().toISOString() })
      .eq('id', row.id);
    return true;
  }));

  return res.json({ ok: true, enriched: results.filter(Boolean).length, total: rows.length });
};

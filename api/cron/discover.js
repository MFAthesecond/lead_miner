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
  'https://storeleads.app/reports/shopify/TR/city/Elaz%c4%b1%c4%9f',
  'https://storeleads.app/reports/shopify/TR/city/Van',
  'https://storeleads.app/reports/shopify/TR/city/Erzurum',
  'https://storeleads.app/reports/shopify/TR/city/Kahramanmara%c5%9f',
  'https://storeleads.app/reports/shopify/TR/city/Afyonkarahisar',
  'https://storeleads.app/reports/shopify/TR/city/Sivas',
  'https://storeleads.app/reports/shopify/TR/city/Tokat',
  'https://storeleads.app/reports/shopify/TR/city/Aksaray',
  'https://storeleads.app/reports/shopify/TR/city/Ordu',
  'https://storeleads.app/reports/shopify/TR/city/Rize',
  'https://storeleads.app/reports/shopify/TR/city/Bolu',
  'https://storeleads.app/reports/shopify/TR/city/D%c3%bczce',
  'https://storeleads.app/reports/shopify/TR/city/Giresun',
  'https://storeleads.app/reports/shopify/TR/city/Kastamonu',
  'https://storeleads.app/reports/shopify/TR/city/%c3%87orum',
  'https://storeleads.app/reports/shopify/TR/city/U%c5%9fak',
  'https://storeleads.app/reports/shopify/TR/city/Isparta',
  'https://storeleads.app/reports/shopify/TR/city/Burdur',
  'https://storeleads.app/reports/shopify/TR/city/Ni%c4%9fde',
  'https://storeleads.app/reports/shopify/TR/city/Nev%c5%9fehir',
  'https://storeleads.app/reports/shopify/TR/city/Yalova',
  'https://storeleads.app/reports/shopify/TR/city/Karaman',
  'https://storeleads.app/reports/shopify/TR/city/K%c4%b1r%c5%9fehir',
  'https://storeleads.app/reports/shopify/TR/city/Sinop',
  'https://storeleads.app/reports/shopify/TR/city/Bart%c4%b1n',
  'https://storeleads.app/reports/shopify/TR/city/Zonguldak',
  'https://storeleads.app/reports/shopify/TR/city/%c3%87anakkale',
  'https://storeleads.app/reports/shopify/TR/city/Edirne',
  'https://storeleads.app/reports/shopify/TR/city/K%c4%b1rklareli',
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
  'https://storeleads.app/reports/shopify/TR/region/Erzurum',
  'https://storeleads.app/reports/shopify/TR/region/Diyarbak%C4%B1r',
  'https://storeleads.app/reports/shopify/TR/region/Malatya',
  'https://storeleads.app/reports/shopify/TR/region/Hatay',
  'https://storeleads.app/reports/shopify/TR/region/Manisa',
  'https://storeleads.app/reports/shopify/TR/region/Tekirda%C4%9F',
  'https://storeleads.app/reports/shopify/TR/region/Bal%C4%B1kesir',
  'https://storeleads.app/reports/shopify/TR/region/Ayd%C4%B1n',
  'https://storeleads.app/reports/shopify/TR/region/Eski%C5%9Fehir',
  'https://storeleads.app/reports/shopify/TR/region/Sakarya',
  // Store Leads - kategoriler (18 kategori)
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
  'https://storeleads.app/reports/shopify/TR/category/Shopping',
  'https://storeleads.app/reports/shopify/TR/category/Finance',
  'https://storeleads.app/reports/shopify/TR/category/Jewelry%20%26%20Watches',
  // Store Leads - Turk Shopify app kullanicilari (TR filtreli)
  'https://storeleads.app/reports/shopify/TR/app/e-ticaret-sozlesmeleri',
  'https://storeleads.app/reports/shopify/TR/app/kargo-yonetimi',
  'https://storeleads.app/reports/shopify/TR/app/judgeme',
  'https://storeleads.app/reports/shopify/TR/app/pagefly',
  'https://storeleads.app/reports/shopify/TR/app/loox',
  'https://storeleads.app/reports/shopify/TR/app/instafeed',
  'https://storeleads.app/reports/shopify/TR/app/omnisend',
  'https://storeleads.app/reports/shopify/TR/app/klaviyo',
  'https://storeleads.app/reports/shopify/TR/app/privy',
  'https://storeleads.app/reports/shopify/TR/app/tidio',
  'https://storeleads.app/reports/shopify/TR/app/ali-reviews',
  'https://storeleads.app/reports/shopify/TR/app/opinew',
  'https://storeleads.app/reports/shopify/TR/app/growave',
  'https://storeleads.app/reports/shopify/TR/app/stamped-io',
  'https://storeleads.app/reports/shopify/TR/app/yotpo',
  'https://storeleads.app/reports/shopify/TR/app/smile-io',
  'https://storeleads.app/reports/shopify/TR/app/bold-product-options',
  'https://storeleads.app/reports/shopify/TR/app/oberlo',
  'https://storeleads.app/reports/shopify/TR/app/dsers',
  'https://storeleads.app/reports/shopify/TR/app/spocket',
  'https://storeleads.app/reports/shopify/TR/app/printful',
  'https://storeleads.app/reports/shopify/TR/app/shopify-email',
  'https://storeleads.app/reports/shopify/TR/app/shopify-inbox',
  'https://storeleads.app/reports/shopify/TR/app/google-channel',
  'https://storeleads.app/reports/shopify/TR/app/facebook-channel',
  // Store Leads - teknoloji / platform filtresi
  'https://storeleads.app/reports/shopify/TR/technology/Google%20Analytics',
  'https://storeleads.app/reports/shopify/TR/technology/Facebook%20Pixel',
  'https://storeleads.app/reports/shopify/TR/technology/Google%20Tag%20Manager',
  'https://storeleads.app/reports/shopify/TR/technology/Hotjar',
  'https://storeleads.app/reports/shopify/TR/technology/TikTok%20Pixel',
  // Turk Shopify ajans portfoyleri ve rehberler
  'https://www.shopifyuzmani.com.tr/projeler/',
  'https://digitalexchange.com.tr/shopify-e-ticaret-site-kurulum/',
  'https://eticaret.pro/shopify-ile-eticaret/',
  'https://webrazzi.com/kategori/e-ticaret/',
  // Hala calisan diger kaynaklar
  'https://analyzify.com/shopify-stores/l/turkey',
  'https://www.skailama.com/shopify-stores/turkey',
];

const DDG_QUERIES = [
  // Kanitlanmis calisan kaliplar (niche + turkiye)
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
  'myshopify.com mobilya türkiye',
  'myshopify.com halı kilim türkiye',
  'myshopify.com türk çikolata',
  'myshopify.com gelinlik türkiye',
  'myshopify.com perde türkiye',
  'myshopify.com parfüm türkiye',
  'myshopify.com oyuncak türkiye',
  'myshopify.com bahçe türkiye',
  'myshopify.com örgü tığ türkiye',
  'myshopify.com deri cüzdan türkiye',
  'myshopify.com çay baklava türkiye',
  'myshopify.com balık deniz türkiye',
  '"Powered by Shopify" "com.tr" giyim',
  '"Powered by Shopify" "com.tr" kozmetik',
  '"Powered by Shopify" "₺"',
  // Mikro nişler
  'myshopify.com mum kokulu türkiye',
  'myshopify.com seramik el yapımı türkiye',
  'myshopify.com ahşap dekorasyon türkiye',
  'myshopify.com kumaş türkiye',
  'myshopify.com çanta deri istanbul',
  'myshopify.com saat aksesuar türkiye',
  'myshopify.com yoga pilates türkiye',
  'myshopify.com bisiklet türkiye',
  'myshopify.com kamp outdoor türkiye',
  'myshopify.com kitap kırtasiye türkiye',
  'myshopify.com çiçek yapay türkiye',
  'myshopify.com puzzle hobi türkiye',
  'myshopify.com vitamin takviye türkiye',
  'myshopify.com mayo bikini türkiye',
  'myshopify.com gözlük güneş türkiye',
  'myshopify.com tesettür türkiye',
  'myshopify.com streetwear türkiye',
  'myshopify.com eşarp türkiye',
  'myshopify.com çorap iç giyim türkiye',
  'myshopify.com süs akvaryum türkiye',
  'myshopify.com zeytinyağı bal türkiye',
  'myshopify.com lokum şekerleme türkiye',
  'myshopify.com elektronik aksesuar türkiye',
  'myshopify.com telefon kılıf türkiye',
  'myshopify.com hediye hediyelik türkiye',
  'myshopify.com düğün nikah türkiye',
  'myshopify.com oto aksesuar türkiye',
  'myshopify.com sanat tablo türkiye',
  'myshopify.com müzik enstrüman türkiye',
  'myshopify.com promosyon baskı türkiye',
  'myshopify.com ambalaj paketleme türkiye',
  'myshopify.com temizlik hijyen türkiye',
  'myshopify.com aydınlatma lamba türkiye',
  'myshopify.com mutfak gereçleri türkiye',
  'myshopify.com havlu bornoz türkiye',
  // .com.tr kaliplari
  '"Powered by Shopify" site:.com.tr',
  'shopify mağaza "com.tr" 2026',
  'shopify "com.tr" online mağaza',
  // Ajans / referans / vaka calismasi kaliplari
  '"shopify" "referanslarımız" "com.tr"',
  '"shopify" "başarı hikayesi" türkiye',
  '"shopify ajansı" türkiye referans',
  '"shopify uzmanı" "com.tr" portfolio',
  '"shopify ile yaptık" "com.tr"',
  '"shopify mağaza" "com.tr" açtık',
  // Shopify footer + Turk icerik
  '"Powered by Shopify" "kargo" "₺"',
  '"Powered by Shopify" "kapıda ödeme"',
  '"Powered by Shopify" "havale" "EFT"',
  '"Powered by Shopify" "sepete ekle"',
  '"Powered by Shopify" istanbul mağaza',
  '"Powered by Shopify" ankara mağaza',
  '"Powered by Shopify" izmir mağaza',
  // Instagram baglantili
  '"myshopify.com" "instagram.com" türk',
  'site:instagram.com "myshopify.com" türkiye',
  'site:instagram.com "shopify" "com.tr"',
  // Yeni e-ticaret trend kaliplari
  'shopify türkiye "2025"',
  'shopify türkiye "2026"',
  '"shopify" "e-ticaret" "com.tr" yeni',
  'shopify mağaza "TL" online alışveriş',
];

const PAGES_PER_RUN = 2;
const DDG_PER_RUN = 5;

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

    const href = $(el).attr('href') || '';
    if (!href.startsWith('http')) return;
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase();
      if (host.endsWith('.myshopify.com') || host.endsWith('.com.tr')) {
        if (!host.includes('storeleads') && !host.includes('shopify.com')
            && !host.includes('google') && !isBigBrand('https://' + host)) {
          domains.add('https://' + host);
        }
      }
    } catch {}
  });

  return domains;
}

const DDG_SKIP_HOSTS = new Set([
  'shopify.com','www.shopify.com','apps.shopify.com','help.shopify.com',
  'community.shopify.com','themes.shopify.com',
  'google.com','www.google.com','google.com.tr',
  'youtube.com','www.youtube.com',
  'facebook.com','www.facebook.com','instagram.com','www.instagram.com',
  'twitter.com','x.com','linkedin.com','www.linkedin.com',
  'pinterest.com','www.pinterest.com','tiktok.com','www.tiktok.com',
  'reddit.com','www.reddit.com','quora.com','www.quora.com',
  'wikipedia.org','en.wikipedia.org','tr.wikipedia.org',
  'medium.com','wordpress.com','blogger.com','github.com',
  'amazon.com','amazon.com.tr','ebay.com','etsy.com','aliexpress.com',
  'trendyol.com','www.trendyol.com','hepsiburada.com','www.hepsiburada.com',
  'n11.com','www.n11.com','sahibinden.com','www.sahibinden.com',
  'storeleads.app','www.storeleads.app',
  'analyzify.com','www.analyzify.com',
  'webrazzi.com','www.webrazzi.com',
  'cloudflare.com','vercel.app','netlify.app','herokuapp.com',
  'apple.com','play.google.com','apps.apple.com',
]);

async function searchDDG(query) {
  const domains = new Set();
  const isShopifyFooterQuery = query.includes('Powered by Shopify') ||
    query.includes('sepete ekle') || query.includes('kapıda ödeme') ||
    query.includes('havale') || query.includes('₺');
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
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (DDG_SKIP_HOSTS.has(host) || DDG_SKIP_HOSTS.has('www.' + host)) return;
        if (host.includes('google.') || host.includes('facebook.')) return;

        if (host.includes('myshopify.com') || host.endsWith('.com.tr')) {
          const d = 'https://' + host;
          if (!isBigBrand(d)) domains.add(d);
        } else if (isShopifyFooterQuery && host.endsWith('.com') && !host.includes('.com.')) {
          const d = 'https://' + host;
          if (!isBigBrand(d)) domains.add(d);
        }
      } catch {}
    });
  } catch {}
  return domains;
}

async function searchCrtSh() {
  const domains = new Set();
  try {
    const resp = await fetch(
      'https://crt.sh/?q=%25.myshopify.com&output=json&limit=200',
      { signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) return domains;
    const data = await resp.json();
    const valid = data
      .map(c => (c?.common_name || '').toLowerCase())
      .filter(n => n.endsWith('.myshopify.com') && !n.startsWith('*') && n.length < 60);
    const shuffled = valid.sort(() => Math.random() - 0.5).slice(0, 50);
    for (const name of shuffled) {
      if (!isBigBrand(`https://${name}`)) {
        domains.add(`https://${name}`);
      }
    }
  } catch {}
  return domains;
}

const COMTR_KEYWORDS = [
  'shop','store','magaza','butik','market','outlet','online',
  'moda','giyim','kozmetik','deri','taki','spor','gurme',
  'kahve','ev','mobilya','bebek','pet','organik','dogal',
];

async function isShopifyDomain(domain) {
  try {
    const resp = await fetch(`https://${domain}/products.json?limit=1`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(3000),
      redirect: 'follow',
    });
    if (!resp.ok) return false;
    const text = await resp.text();
    return text.includes('"products"') && text.includes('cdn.shopify.com');
  } catch { return false; }
}

const TR_WORDS = [
  'aksesuar','alin','altun','altin','amber','ankara','antep','antalya',
  'asil','atelier','atolye','ayakkabi','ayna','azra',
  'bahar','bahce','bal','baran','bebek','bella','beyaz','boncuk','butik',
  'cafe','canim','canta','cicek','cocuk','concept','cuzdan',
  'deco','dekor','deri','design','dijital','dogal','doga','dream','dukkan',
  'ege','el','elbise','elif','elit','emir','erdem','erzurum','esarp',
  'fashion','felt','fit','flora','fresh',
  'galeri','gala','giyim','gold','green','gumus','gurme','guzel','guzellik',
  'hali','hamam','hanim','hayat','hediye','home','house',
  'ipek','istanbul','izmir',
  'jewel','joy',
  'kahve','kedi','kent','kilim','konak','kozmetik','kraft','kutu',
  'lavanta','leziz','lila','lokum','luna','lux','luxury',
  'mango','marka','market','maya','mercan','misk','moda','mobilya','mutfak',
  'narin','naturel','nazar','nil','nova','nur',
  'olive','onyx','organic','organik','orient','ottoman','ozel',
  'pasha','pastel','pearl','peri','petra','premier','premium','pure',
  'retro','rose','royal','ruh','ruya',
  'sanat','sapka','sari','seker','selvi','sepet','seramik','shop',
  'silver','sofra','star','stil','stone','store','sultan','sun',
  'taki','tasarim','tekne','tekstil','terra','toptan','trend','turk','turkish',
  'unique','urba',
  'vera','vibe','vida','vintage','vita',
  'yali','yesil','yildiz','yore','yoresel',
  'zehra','zeytin','zen','zara',
];

const TR_PREFIXES = [
  'istanbul','ankara','izmir','antalya','turk','turkish','tr',
  'my','the','casa','maison','haus','la','el',
];
const TR_SUFFIXES = [
  'shop','store','butik','moda','home','deri','design','art',
  'style','wear','life','craft','made','co','hub','tr',
];

function generateBruteCandidates(count) {
  const candidates = new Set();
  const words = [...TR_WORDS].sort(() => Math.random() - 0.5);

  for (const w of words) {
    if (candidates.size >= count) break;
    candidates.add(w);
  }

  while (candidates.size < count) {
    const prefix = TR_PREFIXES[Math.floor(Math.random() * TR_PREFIXES.length)];
    const suffix = TR_SUFFIXES[Math.floor(Math.random() * TR_SUFFIXES.length)];
    const word = TR_WORDS[Math.floor(Math.random() * TR_WORDS.length)];
    const r = Math.random();
    if (r < 0.33) candidates.add(`${word}-${suffix}`);
    else if (r < 0.66) candidates.add(`${prefix}-${word}`);
    else candidates.add(`${word}${suffix}`);
  }

  return [...candidates].slice(0, count);
}

async function bruteForceMyshopify() {
  const domains = new Set();
  const candidates = generateBruteCandidates(15);

  const checks = await Promise.all(candidates.map(async (slug) => {
    const host = `${slug}.myshopify.com`;
    try {
      const resp = await fetch(`https://${host}/products.json?limit=1`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) return null;
      const text = await resp.text();
      if (text.includes('"products"')) return `https://${host}`;
    } catch {}
    return null;
  }));

  for (const url of checks) {
    if (url && !isBigBrand(url)) domains.add(url);
  }
  return domains;
}

async function discoverComTr() {
  const domains = new Set();
  const keyword = COMTR_KEYWORDS[Math.floor(Math.random() * COMTR_KEYWORDS.length)];
  try {
    const resp = await fetch(
      `https://crt.sh/?q=%25${keyword}%25.com.tr&output=json&limit=100`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return domains;
    const data = await resp.json();
    const hosts = [...new Set(
      data
        .map(c => (c?.common_name || '').toLowerCase().replace(/^\*\./, '').replace(/^www\./, ''))
        .filter(n => n.endsWith('.com.tr') && n.length < 50 && !n.includes('*'))
    )];
    const shuffled = hosts.sort(() => Math.random() - 0.5).slice(0, 5);

    const checks = await Promise.all(
      shuffled.map(async (host) => {
        if (isBigBrand(`https://${host}`)) return null;
        const isShopify = await isShopifyDomain(host);
        return isShopify ? `https://${host}` : null;
      })
    );
    for (const url of checks) {
      if (url) domains.add(url);
    }
  } catch {}
  return domains;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const allUrls = new Set();
  let source = 'pages+ddg+crtsh';

  const shuffledPages = [...ALL_PAGES].sort(() => Math.random() - 0.5).slice(0, PAGES_PER_RUN);
  const shuffledDDG = [...DDG_QUERIES].sort(() => Math.random() - 0.5).slice(0, DDG_PER_RUN);

  const pagePs = shuffledPages.map(async (url) => {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      return [...extractDomains(html, url.includes('skailama'))];
    } catch { return []; }
  });

  const ddgPs = shuffledDDG.map(q => searchDDG(q).then(s => [...s]).catch(() => []));
  const crtP = searchCrtSh().then(s => [...s]).catch(() => []);
  const comTrP = discoverComTr().then(s => [...s]).catch(() => []);
  const bruteP = bruteForceMyshopify().then(s => [...s]).catch(() => []);

  const results = await Promise.all([...pagePs, ...ddgPs, crtP, comTrP, bruteP]);
  for (const domains of results) {
    for (const d of domains) allUrls.add(d);
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

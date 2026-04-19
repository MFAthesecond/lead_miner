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
  // === BUTIK / MAGAZA / DUKKAN KALIPLARI ===
  'butik online mağaza',
  'butik giyim online',
  'butik kadın giyim online mağaza',
  'butik erkek giyim online',
  'butik bebek giyim online',
  'butik tesettür online',
  'butik takı aksesuar online',
  'butik kozmetik online',
  'butik ayakkabı online',
  'butik çanta online',
  'online butik istanbul',
  'online butik ankara',
  'online butik izmir',
  'online butik antalya',
  'online butik bursa',
  'atölye online satış türkiye',
  'atölye el yapımı online mağaza',
  'dükkan online sipariş türkiye',
  // === GENEL TURK E-TICARET ===
  'online giyim mağazası türkiye',
  'kadın giyim online mağaza',
  'erkek giyim online sipariş',
  'tesettür giyim online mağaza',
  'çocuk giyim online alışveriş',
  'streetwear türkiye online mağaza',
  'spor giyim online mağaza',
  'gelinlik online satış',
  'iç giyim pijama online mağaza',
  'abiye elbise online sipariş',
  'büyük beden giyim online',
  'eşarp şal online mağaza',
  // Aksesuar / Takı / Deri
  'takı aksesuar online mağaza',
  'el yapımı takı online satış türkiye',
  'deri çanta cüzdan online',
  'gümüş takı online mağaza türkiye',
  'saat online satış türkiye',
  'gözlük online mağaza',
  'ayakkabı online sipariş',
  'bijuteri online mağaza türkiye',
  // Kozmetik / Güzellik
  'kozmetik online mağaza',
  'doğal kozmetik online satış türkiye',
  'cilt bakım ürünleri online',
  'parfüm online mağaza',
  'makyaj ürünleri online sipariş',
  'organik güzellik ürünleri online',
  'saç bakım ürünleri online mağaza',
  // Ev / Dekorasyon
  'ev dekorasyon online mağaza',
  'mobilya online sipariş',
  'halı kilim online satış türkiye',
  'aydınlatma online mağaza',
  'mutfak gereçleri online',
  'ev tekstili online mağaza',
  'perde online sipariş türkiye',
  'banyo aksesuarları online mağaza',
  // Gıda / Gurme
  'gurme gıda online sipariş',
  'organik gıda online mağaza türkiye',
  'kahve online satış',
  'çay online sipariş türkiye',
  'baklava lokum online mağaza',
  'zeytinyağı online satış',
  'bal online sipariş türkiye',
  'kuruyemiş online mağaza',
  'çikolata online satış türkiye',
  // Bebek / Pet
  'bebek ürünleri online mağaza',
  'oyuncak online sipariş',
  'evcil hayvan online mağaza türkiye',
  'kedi köpek online mağaza',
  // Spor / Outdoor
  'spor malzemesi online satış',
  'outdoor kamp online mağaza türkiye',
  'bisiklet online sipariş',
  'fitness ürünleri online',
  'yoga pilates online mağaza',
  // Hobi / El yapımı
  'el yapımı ürünler online mağaza',
  'hobi malzemesi online sipariş türkiye',
  'seramik atölye online satış',
  'boncuk örgü online mağaza',
  'ahşap dekorasyon online satış',
  'mum kokulu online mağaza',
  'doğal sabun online satış türkiye',
  'puzzle yapboz online mağaza',
  'baskılı tişört online sipariş',
  'poster tablo online mağaza',
  'doğal taş takı online satış türkiye',
  'vintage kıyafet online mağaza',
  'kumaş online satış türkiye',
  // Diğer nişler
  'telefon aksesuar online mağaza',
  'elektronik aksesuar online satış türkiye',
  'oto aksesuar online mağaza',
  'müzik enstrüman online sipariş',
  'kitap kırtasiye online mağaza',
  'hediye online sipariş türkiye',
  'çiçek online mağaza',
  'düğün malzemeleri online sipariş',
  'promosyon ürünleri online satış',
  'medikal ürünler online mağaza türkiye',
  // Turkce e-ticaret sinyalleri
  '"sepete ekle" "₺" giyim',
  '"sepete ekle" "₺" kozmetik',
  '"sepete ekle" "₺" takı',
  '"sepete ekle" "₺" ev dekorasyon',
  '"sepete ekle" "kargo" türkiye',
  '"kapıda ödeme" online mağaza türkiye',
  '"ücretsiz kargo" online mağaza',
  '"havale" "EFT" online mağaza',
  // Shopify sinyalleri
  '"Powered by Shopify" "₺"',
  '"Powered by Shopify" "kargo"',
  '"Powered by Shopify" "sepete ekle"',
  '"Powered by Shopify" site:.com.tr',
];

const DDG_TEMPLATES = [
  '{word} online mağaza',
  '{word} online satış',
  '{word} online sipariş',
  '{word} online alışveriş',
  'online {word} mağaza türkiye',
  'online {word} satış',
  '{word} online mağaza istanbul',
  '{word} online mağaza ankara',
  '{word} online mağaza izmir',
  '{word} online mağaza antalya',
  '{word} online mağaza bursa',
  'butik {word} online',
  'butik {word} mağaza',
  '{word} atölye online satış',
  '{word} dükkan online',
  '"{word}" "sepete ekle" "₺"',
  '"{word}" online "kargo" türkiye',
  '"{word}" online "kapıda ödeme"',
  '"Powered by Shopify" "{word}"',
];

const DDG_NICHE_WORDS = [
  'giyim','moda','elbise','tişört','pantolon','ceket','mont','triko',
  'tesettür','eşarp','şal','başörtüsü','ferace','abiye',
  'ayakkabı','çanta','cüzdan','kemer','çorap','iç giyim','pijama',
  'takı','bileklik','kolye','yüzük','küpe','broş','gümüş','altın',
  'saat','gözlük','şapka',
  'kozmetik','makyaj','parfüm','cilt bakım','saç bakım','güzellik',
  'doğal kozmetik','organik kozmetik',
  'ev dekorasyon','mobilya','halı','kilim','perde','aydınlatma','lamba',
  'mutfak','banyo','havlu','nevresim','yastık','battaniye',
  'kahve','çay','bal','zeytinyağı','baklava','lokum','peynir',
  'gurme','organik gıda','baharat','kuruyemiş','çikolata','şekerleme',
  'bebek','çocuk','oyuncak','mama','biberon',
  'evcil hayvan','kedi','köpek','akvaryum',
  'spor','fitness','yoga','bisiklet','kamp','outdoor',
  'telefon kılıf','tablet aksesuar','elektronik',
  'kitap','kırtasiye','hobi','puzzle','boncuk','örgü','iplik',
  'deri','çanta deri','cüzdan deri','kemer deri',
  'seramik','cam','ahşap','bambu','hasır','rattan',
  'mum','sabun','aromaterapi','buhurdanlık',
  'poster','tablo','kanvas','çerçeve',
  'bahçe','saksı','tohum','fide',
  'düğün','nikah şekeri','gelin','damat',
  'hediye','hediyelik','promosyon',
  'vitamin','takviye','protein','doğal ilaç',
  'pet giyim','tasma','mama kabı',
  'müzik','gitar','bağlama','ud',
  'oto aksesuar','araç parfüm','araç koku',
  'havuz','şişme','deniz','plaj',
];

function generateDynamicDDGQueries(count) {
  const queries = new Set();
  while (queries.size < count) {
    const template = DDG_TEMPLATES[Math.floor(Math.random() * DDG_TEMPLATES.length)];
    const word = DDG_NICHE_WORDS[Math.floor(Math.random() * DDG_NICHE_WORDS.length)];
    queries.add(template.replace('{word}', word));
  }
  return [...queries];
}

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
  'sikayetvar.com','www.sikayetvar.com','eksisozluk.com',
  'donanimhaber.com','www.donanimhaber.com',
  'hurriyet.com.tr','milliyet.com.tr','sabah.com.tr',
  'haberturk.com','ntv.com.tr','cnnturk.com',
  'gittigidiyor.com','www.gittigidiyor.com',
  'akakce.com','www.akakce.com','cimri.com','www.cimri.com',
  'ikas.com','www.ikas.com','ticimax.com','www.ticimax.com',
  'ideasoft.com.tr','www.ideasoft.com.tr',
]);

const DDG_OFFSETS = [0, 30, 60, 90];

function extractDomainsFromDDG(html) {
  const $ = cheerio.load(html);
  const domains = new Set();
  const nextFormData = {};

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

      const dots = host.split('.').length;
      const isEcommerce = host.endsWith('.com.tr') || host.endsWith('.com') ||
        host.endsWith('.shop') || host.endsWith('.store') ||
        host.includes('myshopify.com');
      if (isEcommerce && dots <= 3) {
        const d = 'https://' + host;
        if (!isBigBrand(d)) domains.add(d);
      }
    } catch {}
  });

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value');
    if (name && val !== undefined) nextFormData[name] = val;
  });

  return { domains, nextFormData };
}

async function searchDDG(query) {
  const allDomains = new Set();
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return allDomains;
    const html = await resp.text();
    const { domains, nextFormData } = extractDomainsFromDDG(html);
    for (const d of domains) allDomains.add(d);

    if (nextFormData.q && nextFormData.s) {
      try {
        const formBody = Object.entries(nextFormData)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        const resp2 = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody,
          signal: AbortSignal.timeout(4000),
        });
        if (resp2.ok) {
          const html2 = await resp2.text();
          const { domains: d2 } = extractDomainsFromDDG(html2);
          for (const d of d2) allDomains.add(d);
        }
      } catch {}
    }
  } catch {}
  return allDomains;
}

async function searchGoogle(query) {
  const domains = new Set();
  const start = Math.floor(Math.random() * 10) * 10;
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&start=${start}&hl=tr&gl=tr`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return domains;
    const html = await resp.text();

    const urlRx = /https?:\/\/(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/gi;
    let m;
    while ((m = urlRx.exec(html)) !== null) {
      const host = m[1].toLowerCase();
      if (DDG_SKIP_HOSTS.has(host) || DDG_SKIP_HOSTS.has('www.' + host)) continue;
      if (host.includes('google') || host.includes('gstatic') || host.includes('googleapis')) continue;
      if (host.includes('facebook') || host.includes('youtube') || host.includes('schema.org')) continue;
      const dots = host.split('.').length;
      const isEcommerce = host.endsWith('.com.tr') || host.endsWith('.com') ||
        host.endsWith('.shop') || host.endsWith('.store') ||
        host.includes('myshopify.com');
      if (isEcommerce && dots <= 3 && host.length > 5) {
        if (!isBigBrand('https://' + host)) domains.add('https://' + host);
      }
    }
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
  'aksesuar','anadolu','ankara','antep','antalya','atolye','ayakkabi','ayna',
  'bahar','bahce','bakir','bal','bebek','beyaz','beyoglu','boncuk','bogazici','butik',
  'canim','canta','cesme','cicek','cocuk','cuzdan',
  'defne','dekor','deri','doga','dogal','dukkan',
  'ege','elbise','emir','erdem','erzurum','esarp',
  'galata','galeri','giyim','gonul','gumus','gurme','guzel','guzellik',
  'hali','hamam','hanim','hatay','hayat','hediye',
  'ipek','istanbul','izmir',
  'kadife','kahve','kapadokya','kedi','kent','kilim','konak','kozmetik','kutu',
  'lavanta','leziz','lokum',
  'marka','mardin','mercan','misk','moda','mobilya','mutfak',
  'narin','nazar','nil','nur',
  'organik','ozel','ottoman',
  'pasha','peri',
  'ruh','ruya',
  'safran','sanat','sapka','sari','seker','selvi','sepet','seramik',
  'sofra','sultan',
  'taki','tasarim','tekstil','toptan','trabzon','turk',
  'yali','yesil','yildiz','yore','yoresel',
  'zehra','zeytin',
];

const TR_PREFIXES = [
  'istanbul','ankara','izmir','antalya','turk','tr','my',
  'ege','anadolu','karadeniz','akdeniz',
];
const TR_SUFFIXES = [
  'shop','store','butik','moda','home','deri','art',
  'style','wear','craft','tr','online','market',
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
  const staticDDG = [...DDG_QUERIES].sort(() => Math.random() - 0.5).slice(0, 2);
  const dynamicDDG = generateDynamicDDGQueries(3);
  const allDDG = [...staticDDG, ...dynamicDDG];

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

  const googleQueries = generateDynamicDDGQueries(2);
  const ddgPs = allDDG.map(q => searchDDG(q).then(s => [...s]).catch(() => []));
  const googlePs = googleQueries.map(q => searchGoogle(q).then(s => [...s]).catch(() => []));
  const crtP = searchCrtSh().then(s => [...s]).catch(() => []);
  const comTrP = discoverComTr().then(s => [...s]).catch(() => []);
  const bruteP = bruteForceMyshopify().then(s => [...s]).catch(() => []);

  const results = await Promise.all([...pagePs, ...ddgPs, ...googlePs, crtP, comTrP, bruteP]);
  for (const domains of results) {
    for (const d of domains) allUrls.add(d);
  }

  const seen = new Set();
  const rows = [...allUrls]
    .filter(u => !isBigBrand(u))
    .map(u => {
      const d = domainFromUrl(u);
      const normalized = 'https://' + d;
      return { url: normalized, domain: d };
    })
    .filter(r => {
      if (seen.has(r.domain)) return false;
      seen.add(r.domain);
      if (r.domain.length <= 3) return false;
      if (r.domain.includes('@')) return false;
      if (r.domain.includes('info@') || r.domain.includes('mailto')) return false;
      return true;
    });

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
    queries: allDDG,
    domains_found: allUrls.size,
    domains: [...allUrls].slice(0, 30),
    inserted,
  });
};

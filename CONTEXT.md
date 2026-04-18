# Lead Miner - Proje Bağlamı

## Ne Yapıyor
Türkiye'deki KOBİ ölçeğindeki Shopify mağazalarını otomatik bulan, iletişim bilgilerini (telefon, WhatsApp, email, Instagram) çeken ve Instagram takipçi sayısını toplayan bir lead generation sistemi. Erkam'ın dijital reklam ajansı için müşteri adayı buluyor.

## Mimari
- **Vercel** serverless functions (Node.js)
- **Supabase** PostgreSQL veritabanı
- **cron-job.org** harici cron servisi (Vercel'e bağlı değil)
- **Repo**: https://github.com/MFAthesecond/lead_miner
- **Canlı site**: https://lead-miner-plum.vercel.app

## Veritabanı
Supabase'de tek tablo: `shopify_stores`

Kolonlar: `id, url, domain, store_name, emails (text[]), phones (text[]), instagram, ig_followers (int), whatsapp, facebook, tiktok, category, currency, product_count, description, is_shopify (bool), tag (text), discovered_at, enriched_at, ig_fetched_at, created_at`

Tag değerleri: `Arandi, Ilgileniyor, Teklif Verildi, Musteri, Reddetti, Sonra Ara`

## Dosya Yapısı
```
lead_miner/
  api/
    _lib/supabase.js        # Shared: Supabase client, CRON_SECRET, BIG_BRANDS filtresi, isBigBrand(), domainFromUrl()
    cron/
      discover.js            # Yeni mağaza bulma - Store Leads + DDG + crt.sh + .com.tr tarama, paralel çalışır
      enrich.js              # İletişim bilgisi çekme + snowball keşif - enriched_at IS NULL olanlardan 5'er batch
    leads.js                 # GET: filtreli JSON API (pagination ile tüm veri), PATCH: tag güncelleme
    cleanup.js               # Tek seferlik çöp temizleme endpoint'i (?dry=true ile önizleme)
  public/
    leads.html               # Dashboard - arama, filtreleme, sıralama, tag dropdown
  schema.sql                 # Tablo tanımı
  migration-add-tag.sql      # Tag kolonu ekleme
  vercel.json                # Rewrites: / -> /leads.html (cron yok, harici cron kullanılıyor)
  package.json               # Deps: @supabase/supabase-js, cheerio
```

## Cron Jobs (cron-job.org'da tanımlı)
| Job | URL | Schedule | Batch |
|---|---|---|---|
| Discover | /api/cron/discover | */3 * * * * | 3 sayfa veya 1 DDG sorgusu |
| Enrich | /api/cron/enrich | */1 * * * * | 2 site |
| Instagram | /api/cron/instagram | */30 * * * * | 5 hesap |

## Önemli Kısıtlar
- Vercel Hobby plan: fonksiyon timeout **10 saniye** - bu yüzden batch'ler küçük
- Instagram API rate limit: 401 dönerse o batch duruyor, sonraki cron'da devam
- BIG_BRANDS seti ile büyük markalar (Mavi, LCW, Derimod vs.) filtreleniyor - sadece KOBİ'ler hedef
- DuckDuckGo `html.duckduckgo.com/html/` endpoint'i kullanılıyor, rate limit yok

## Env Variables (Vercel'de tanımlı)
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CRON_SECRET` (opsiyonel)

## Keşif Kaynakları
1. **Store Leads** (storeleads.app) - 55 şehir, 24 region, 21 kategori, 24 app (TR filtreli), 5 teknoloji sayfası
2. **Skailama** - Türk mağaza listesi
3. **Analyzify** - Türk mağaza listesi
4. **Türk Ajans Portföyleri** - shopifyuzmani.com.tr, digitalexchange.com.tr, eticaret.pro
5. **Webrazzi** - E-ticaret haberleri ve mağaza referansları
6. **DuckDuckGo** - 80+ Türkçe arama sorgusu (niche, ajans referans, "Powered by Shopify" + TR sinyalleri)
7. **crt.sh** - SSL sertifika keşfi (myshopify.com subdomainleri)
8. **crt.sh + products.json** - .com.tr domain tarama ve Shopify doğrulama
9. **Snowball** - Enrich sırasında mağaza sayfalarındaki outbound linklerden yeni mağaza keşfi

## Akış
1. **Discover** yeni URL bulur → `shopify_stores`'a `enriched_at=NULL` olarak ekler
2. **Enrich** `enriched_at IS NULL` olanları alır → siteyi ziyaret eder → email/tel/insta/wa çeker → `enriched_at` doldurur → **sayfadaki outbound linklerden yeni mağaza keşfeder (snowball)**
3. **Instagram** DDG araması ile IG bulamazsa enrich içinde DDG ile arar
4. **Dashboard** sadece `enriched_at IS NOT NULL` ve `is_shopify=true` olanları gösterir (pagination ile tüm veri)

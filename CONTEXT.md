# Lead Miner - Proje Bağlamı

## Ne Yapıyor

İki ayrı lead havuzu:

1. **Shopify Lead Finder** (orijinal): Türkiye'deki KOBİ ölçeğindeki Shopify mağazalarını otomatik bulan, iletişim bilgilerini (telefon, WhatsApp, email, Instagram) çeken ve Instagram takipçi sayısını toplayan bir lead generation sistemi. Erkam'ın dijital reklam ajansı için müşteri adayı buluyor.

2. **Instagram Lead Finder** (yeni): Instagram comment/DM otomasyon SaaS için potansiyel müşteri havuzu. Mesaj trafiği yüksek hesapları (butik, e-ticaret, influencer, kuaför, restoran, klinik vs.) topluyor.

## Mimari

- **Vercel** serverless functions (Node.js)
- **Supabase** PostgreSQL veritabanı
- **cron-job.org** harici cron servisi (Vercel'e bağlı değil)
- **Repo**: https://github.com/MFAthesecond/lead_miner
- **Canlı site**: https://lead-miner-plum.vercel.app

## Veritabanı

### Tablo 1: `shopify_stores` (Lead havuzu - Shopify olmayanlar dahil)

Kolonlar: `id, url, domain, store_name, emails (text[]), phones (text[]), instagram, ig_followers (int), whatsapp, facebook, tiktok, category, currency, product_count, description, is_shopify (bool), source (text), tag (text), notes (text), discovered_at, enriched_at, ig_fetched_at, created_at`

`source` değerleri: `storeleads` (default - Shopify magazasi), `tsoft`, `ticimax`, `ideasoft`, `manual`

`is_shopify=false` ise Tsoft/Ticimax gibi non-Shopify e-ticaret platformu mağazası demek.

Tag değerleri: `Ulasilamadi, Tekrar Aranacak, Numara Yanlis, Mail Iletildi, Mesgul, Toplanti Alindi, Ilgileniyor, Musteri, Reddetti`

### Tablo 2: `instagram_leads` (Instagram Lead Finder)

Kolonlar: `id, username (UNIQUE), full_name, bio, external_url, business_email, business_phone, whatsapp, followers (int), following (int), post_count (int), is_business (bool), is_private (bool), is_verified (bool), category, niche, has_dm_signal (bool), has_wa_signal (bool), has_website (bool), lite_score (int), shopify_url, source, tag, notes, discovered_at, ig_fetched_at, enrich_failed_at, related_fetched_at`

`source` değerleri:
- `seed_shopify`: shopify_stores'tan (storeleads kaynaklı) kopyalanmış
- `seed_tsoft`, `seed_ticimax`, `seed_ideasoft`: shopify_stores'tan (non-shopify panel) kopyalanmış
- `related`: ig-related cron'unun IG "önerilen profiller"den keşfettiği
- `manual`: panel üzerinden eklenmiş
- `ddg_discover`, `brave_discover`: eski (artık aktif değil)

`tag` değerleri shopify_stores ile aynı.

## Dosya Yapısı

```
lead_miner/
  api/
    _lib/
      supabase.js              # Shared: Supabase client, CRON_SECRET, BIG_BRANDS, isBigBrand, domainFromUrl
      ig.js                    # Shared: IG_UA, extractUsername, detectBioSignals, calcLiteScore, fetchProfile, buildEnrichedRow
    cron/
      discover.js              # Shopify: storeleads.app'ten yeni Shopify mağaza bulma (PAGES_PER_RUN env ile ayarlanır, default 5)
      enrich.js                # Shopify: iletişim bilgisi çekme + snowball (TÜM domainleri scrape eder, sadece shopify değil)
      tr-extra-domains.js      # Lead havuzu: Tsoft + Ticimax referans sayfalarindan domain çek
      ig-seed.js               # IG: shopify_stores'tan TÜM IG'leri instagram_leads'e kopyala (sıfır IG API)
      ig-enrich.js             # IG: web_profile_info ile bio + business contact + skor (batch=3, delay=3s)
      ig-rescore.js            # IG: 30 günden eski cache yenileme (haftalık)
    leads.js                   # Shopify: GET filtreli, PATCH tag/notes
    ig-leads.js                # IG: GET filtreli, PATCH tag/notes, POST manuel ekleme
    cleanup.js                 # Shopify: çöp temizleme endpoint'i
  public/
    leads.html                 # Shopify dashboard
    ig-leads.html              # IG dashboard
  schema.sql                   # shopify_stores tanımı
  migration-add-tag.sql        # shopify_stores tag kolonu
  migration-add-notes.sql      # shopify_stores notes kolonu
  migration-ig-leads.sql       # instagram_leads tablosu (YENİ)
  vercel.json                  # Rewrites: / -> leads.html, /leads -> leads.html, /ig -> ig-leads.html
  package.json                 # Deps: @supabase/supabase-js, cheerio
```

## Cron Jobs (cron-job.org'da tanımlı)

### Shopify Pipeline
| Job | URL | Schedule | Batch |
|---|---|---|---|
| Discover | /api/cron/discover | */3 * * * * | 3 sayfa veya 1 DDG sorgusu |
| Enrich | /api/cron/enrich | */1 * * * * | 5 site |
| Instagram (eski) | /api/cron/instagram | DEVRE DIŞI | - |

### Instagram Lead Pipeline
| Job | URL | Schedule | Batch | IG API |
|---|---|---|---|---|
| TR Extra Domains | /api/cron/tr-extra-domains | 0 5 * * 0 (haftada 1) | Tsoft + Ticimax referansları | 0 |
| IG Seed | /api/cron/ig-seed | 0 3 * * * (günde 1) | shopify_stores'tan TÜM IG'ler | 0 |
| IG Enrich | /api/cron/ig-enrich | */15 * * * * | 3 hesap, 3sn delay | ~12/saat |
| IG Rescore | /api/cron/ig-rescore | 0 4 * * 0 (haftalık) | 3 hesap | düşük |

**Neden IG Related/Discover/Hashtag yok?**

Instagram 2024-2025'te login'siz public API'leri sıkı kapattı. **`web_profile_info`** dışındaki tüm endpoint'ler (`discover/chaining`, `tags/web_info`, `friendships/.../followers`, `fbsearch/places/`) `require_login: true` döndürüyor. Vercel datacenter IP'sinden login'siz keşif imkânsız. Sadece bilinen username için profil enrichment yapılabiliyor.

**Yeni IG keşfi nasıl olur?** İki kanaldan:
1. `discover.js` (Shopify) → storeleads/crt.sh'den yeni TR mağaza domain'i
2. `enrich.js` mağaza site footer'ından IG link'i çıkarır
3. `ig-seed.js` günde 1 kez bunları instagram_leads'e taşır

Bu yavaş ama tek güvenli yol. Yıllık ~5K-10K yeni TR IG hedefi.

**Eski iptal edilen cron'lar**: `instagram.js`, `ig-discover.js` (Brave), `ig-related.js` (chaining endpoint login lazım çıktı).

## Önemli Kısıtlar

- Vercel Hobby plan: fonksiyon timeout **10 saniye** - bu yüzden batch'ler küçük
- Instagram API rate limit: 401/429 dönerse o batch duruyor, sonraki cron'da devam
- BIG_BRANDS seti ile büyük markalar (Mavi, LCW, Derimod vs.) filtreleniyor - sadece KOBİ'ler hedef
- DuckDuckGo `html.duckduckgo.com/html/` endpoint'i kullanılıyor, rate limit yok

## Env Variables (Vercel'de tanımlı)

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CRON_SECRET` (opsiyonel)
- `SEED_MIN_FOLLOWERS` (default: 0) - ig-seed eşiği. 0 = TÜM IG'leri al
- `PAGES_PER_RUN` (default: 5) - discover.js her run'da kaç storeleads sayfası tarayacak
- `IG_ENRICH_BATCH` (default: 3)
- `IG_ENRICH_DELAY_MS` (default: 3000)
- `IG_RESCORE_BATCH` (default: 3)
- `IG_RESCORE_DELAY_MS` (default: 3000)
- `IG_CACHE_TTL_DAYS` (default: 30)

## Lite Score Formülü

Sadece web_profile_info'dan gelen veriyle:

- Takipçi: `min(log10(followers+1) * 20, 60)`  (max 60)
- DM sinyali (bio'da `dm`, `mesaj`, `inbox`, `direct`, `siparis`): +15
- WhatsApp sinyali (bio'da `wa.me`, `whatsapp`, `+90 5xx`): +10
- Website sinyali (external_url): +5
- Business hesap: +5
- Aktiflik (post_count >= 50): +5
- Penalty: is_private → score = 0

Max ~100 puan.

## Akış

### Shopify
1. **Discover** yeni URL bulur → `shopify_stores`'a `enriched_at=NULL` olarak ekler
2. **Enrich** `enriched_at IS NULL` olanları alır → email/tel/insta/wa çeker → snowball ile yeni mağaza bulur
3. **Dashboard** `/leads` - sadece `enriched_at IS NOT NULL` ve `is_shopify=true` olanları gösterir

### Instagram
1. **TR Extra Domains** haftada 1: Tsoft + Ticimax referans sayfalarından TR mağaza domain'leri çekip `shopify_stores`'a `is_shopify=false, source='tsoft'/'ticimax'` ile yazar
2. **Enrich** (mevcut Shopify pipeline) bu non-shopify mağazaların sitesinden footer'dan IG/email/wa çıkarır
3. **IG Seed** günde 1 kez `shopify_stores`'tan TÜM IG'leri (kaynak ne olursa olsun) `instagram_leads`'e kopyalar (UPSERT)
4. **IG Enrich** her 15dk `ig_fetched_at IS NULL` olanlardan 3 tanesini alır, bio + business contact + lite skor çeker
5. **IG Rescore** haftada 1 kez 30 günden eski cache'leri yeniler
6. **Dashboard** `/ig` - filtreler: niche, source, takipçi aralığı, DM/WA/Web sinyalleri, tag

## Neden Search Engine Scraping VE IG Discovery API'leri Çalışmıyor

**Search engine scraping**: DDG/Google/Yandex/Bing/Brave (free tier) hepsi datacenter IP'lerini (Vercel + AWS + Cursor Cloud) blokluyor:
- DDG: 202 + CAPTCHA, Google: no-JS sentinel page, Yandex: CAPTCHA banner, Brave: free tier credit card.

**IG keşif endpoint'leri**: 2024-2025'te Meta login'siz API'leri kapattı:
- `discover/chaining` → 429 / `require_login: true`
- `tags/web_info`, `tags/.../sections` → 429
- `friendships/.../followers` → 401 + Türkçe `"Tekrar denemeden önce birkaç dakika bekle"`
- `fbsearch/places/` → 429
- `edge_related_profiles` (web_profile_info içinde) → çoğu zaman boş array

**Hâlâ çalışan tek IG endpoint'i**: `web_profile_info` (browser-style headers ile). Bilinen username için profil bilgisi çeker. Yeni keşif için elverişli değil.

**Sonuç**: IG keşif zinciri Shopify pipeline'ına bağlı - storeleads.app + mağaza site footer'ı + ig-seed.

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

### Tablo 1: `shopify_stores` (Shopify Lead Finder)

Kolonlar: `id, url, domain, store_name, emails (text[]), phones (text[]), instagram, ig_followers (int), whatsapp, facebook, tiktok, category, currency, product_count, description, is_shopify (bool), tag (text), notes (text), discovered_at, enriched_at, ig_fetched_at, created_at`

Tag değerleri: `Ulasilamadi, Tekrar Aranacak, Numara Yanlis, Mail Iletildi, Mesgul, Toplanti Alindi, Ilgileniyor, Musteri, Reddetti`

### Tablo 2: `instagram_leads` (Instagram Lead Finder)

Kolonlar: `id, username (UNIQUE), full_name, bio, external_url, business_email, business_phone, whatsapp, followers (int), following (int), post_count (int), is_business (bool), is_private (bool), is_verified (bool), category, niche, has_dm_signal (bool), has_wa_signal (bool), has_website (bool), lite_score (int), shopify_url, source, tag, notes, discovered_at, ig_fetched_at, enrich_failed_at`

`source` değerleri: `seed_shopify` (shopify_stores'tan kopyalanmış), `ddg_discover` (DDG ile keşfedilmiş), `manual` (panel üzerinden eklenmiş)

`tag` değerleri shopify_stores ile aynı.

## Dosya Yapısı

```
lead_miner/
  api/
    _lib/
      supabase.js              # Shared: Supabase client, CRON_SECRET, BIG_BRANDS, isBigBrand, domainFromUrl
      ig.js                    # Shared: IG_UA, extractUsername, detectBioSignals, calcLiteScore, fetchProfile, buildEnrichedRow
    cron/
      discover.js              # Shopify: yeni mağaza bulma
      enrich.js                # Shopify: iletişim bilgisi çekme + snowball
      instagram.js             # Shopify: IG takipçi sayısı (DEVRE DIŞI - cron-job.org'da kapalı)
      ig-seed.js               # IG: shopify_stores'tan 5K+ takipçili IG'leri kopyala (sıfır IG API)
      ig-discover.js           # IG: DDG ile yeni IG username keşfi (sıfır IG API)
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

### Instagram Lead Pipeline (YENİ)
| Job | URL | Schedule | Batch | IG API |
|---|---|---|---|---|
| IG Seed | /api/cron/ig-seed | 0 3 * * * (günde 1) | tüm 5K+ IG'ler | 0 |
| IG Discover | /api/cron/ig-discover | */30 * * * * | 2 DDG sorgusu | 0 |
| IG Enrich | /api/cron/ig-enrich | */15 * * * * | 3 hesap, 3sn delay | ~12/saat |
| IG Rescore | /api/cron/ig-rescore | 0 4 * * 0 (haftalık) | 3 hesap | düşük |

**Önemli**: Eski `instagram.js` cron'u DEVRE DIŞI, IG API havuzunu sadece `ig-enrich` ve `ig-rescore` kullanır → rate limit çakışması yok.

## Önemli Kısıtlar

- Vercel Hobby plan: fonksiyon timeout **10 saniye** - bu yüzden batch'ler küçük
- Instagram API rate limit: 401/429 dönerse o batch duruyor, sonraki cron'da devam
- BIG_BRANDS seti ile büyük markalar (Mavi, LCW, Derimod vs.) filtreleniyor - sadece KOBİ'ler hedef
- DuckDuckGo `html.duckduckgo.com/html/` endpoint'i kullanılıyor, rate limit yok

## Env Variables (Vercel'de tanımlı)

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CRON_SECRET` (opsiyonel)
- `SEED_MIN_FOLLOWERS` (default: 5000) - ig-seed eşiği
- `IG_DISCOVER_DDG_PER_RUN` (default: 2)
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
1. **IG Seed** günde 1 kez `shopify_stores`'tan 5K+ takipçili IG'leri `instagram_leads`'e kopyalar (UPSERT)
2. **IG Discover** her 30dk DDG'de `site:instagram.com {nis} {sehir}` arar, yeni username'leri ekler
3. **IG Enrich** her 15dk `ig_fetched_at IS NULL` olanlardan 3 tanesini alır, bio + business contact + lite skor çeker
4. **IG Rescore** haftada 1 kez 30 günden eski cache'leri yeniler
5. **Dashboard** `/ig` - filtreler: niche, source, takipçi aralığı, DM/WA/Web sinyalleri, tag

## Niş Listesi (ig-discover içinde)

butik, kuaför, kafe, restoran, pastane, klinik, estetik, kurs, oto galeri, emlak, food blogger, beauty blogger, lifestyle blogger, el yapımı, handmade, takı, gelinlik, tesettür, nail artist, kaş kirpik, pet shop, fizyoterapi, psikolog, diyetisyen, fotografçı, organizasyon, vs. (~50 niş)

Şehirler: istanbul, ankara, izmir, bursa, antalya, adana, konya, gaziantep, kayseri, mersin, eskişehir, denizli, samsun, trabzon

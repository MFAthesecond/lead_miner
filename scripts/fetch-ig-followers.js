#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const IG_UA = 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)';
const IG_APP_ID = '936619743392459';
const DELAY = 2000;

const JUNK = new Set([
  'shopify','instagram','facebook','twitter','tiktok',
  'reel','reels','explore','share','sharer','intent','dialog',
  'accounts','about','developer','legal','privacy','terms',
  'stories','direct','tv','p',
]);

async function getFollowers(username) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': IG_UA, 'X-IG-App-ID': IG_APP_ID },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.status === 401 || resp.status === 429) return { count: 0, rateLimited: true };
    if (!resp.ok) return { count: 0, rateLimited: false };
    const data = await resp.json();
    return { count: data?.data?.user?.edge_followed_by?.count || 0, rateLimited: false };
  } catch (e) {
    return { count: 0, rateLimited: false };
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('.env dosyasinda SUPABASE_URL ve SUPABASE_KEY tanimlanmali');
    console.error('Ornek .env:\n  SUPABASE_URL=https://xxx.supabase.co\n  SUPABASE_KEY=eyJ...');
    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, instagram, ig_followers, store_name')
    .not('instagram', 'is', null)
    .eq('is_shopify', true)
    .not('enriched_at', 'is', null)
    .or('ig_followers.eq.0,ig_followers.is.null')
    .order('created_at', { ascending: true });

  if (error) { console.error('DB hatasi:', error.message); process.exit(1); }

  console.log(`\n${rows.length} magaza icin IG takipci cekilecek\n`);

  let updated = 0, cleaned = 0, failed = 0, rateLimitHit = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const username = row.instagram
      .replace('https://instagram.com/', '')
      .replace('https://www.instagram.com/', '')
      .replace('@', '')
      .replace(/\/$/, '');

    if (!username || JUNK.has(username.toLowerCase())) {
      await supabase.from('shopify_stores')
        .update({ instagram: null, ig_followers: 0, ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      cleaned++;
      process.stdout.write(`[${i+1}/${rows.length}] @${username} -> TEMIZLENDI (junk)\n`);
      continue;
    }

    const result = await getFollowers(username);

    if (result.rateLimited) {
      rateLimitHit++;
      console.log(`\n⚠ Rate limit! ${DELAY * 3}ms bekleniyor...`);
      await new Promise(r => setTimeout(r, DELAY * 3));
      i--;
      if (rateLimitHit > 10) {
        console.log('\nCok fazla rate limit, durduruluyor.');
        break;
      }
      continue;
    }

    rateLimitHit = 0;

    if (result.count > 0) {
      await supabase.from('shopify_stores')
        .update({ ig_followers: result.count, ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      updated++;
      process.stdout.write(`[${i+1}/${rows.length}] @${username} -> ${result.count.toLocaleString()} takipci\n`);
    } else {
      await supabase.from('shopify_stores')
        .update({ ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      failed++;
      process.stdout.write(`[${i+1}/${rows.length}] @${username} -> bulunamadi\n`);
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  console.log(`\n--- Sonuc ---`);
  console.log(`Guncellenen: ${updated}`);
  console.log(`Temizlenen (junk): ${cleaned}`);
  console.log(`Bulunamayan: ${failed}`);
  console.log(`Toplam: ${rows.length}`);
}

main().catch(console.error);

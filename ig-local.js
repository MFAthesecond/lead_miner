#!/usr/bin/env node
/**
 * Lokal IG takipci cekici.
 * Supabase'den ig_followers=0 ve instagram != null olanlari alir,
 * IG API'den takipci ceker, geri yazar.
 *
 * Kullanim: node ig-local.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const IG_UA = 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)';
const DELAY = 3000;

async function getFollowers(username) {
  const { execSync } = require('child_process');
  try {
    const cmd = `curl -s "https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}" -H "User-Agent: ${IG_UA}" -H "X-IG-App-ID: 936619743392459"`;
    const out = execSync(cmd, { timeout: 8000 }).toString();
    const data = JSON.parse(out);
    if (data?.message?.includes('wait')) return { count: 0, limited: true };
    return { count: data?.data?.user?.edge_followed_by?.count || 0, limited: false };
  } catch {
    return { count: 0, limited: false };
  }
}

async function main() {
  const { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, instagram, ig_followers')
    .not('instagram', 'is', null)
    .or('ig_followers.is.null,ig_followers.eq.0')
    .limit(500);

  if (error) { console.error('DB hata:', error.message); return; }
  if (!rows.length) { console.log('Hepsi cekilmis, bekleyen yok.'); return; }

  console.log(`${rows.length} hesap cekilecek...\n`);

  let fetched = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const username = row.instagram.replace('https://instagram.com/', '').replace('@', '');

    if (!username || username === 'reel') {
      await supabase.from('shopify_stores').update({ ig_fetched_at: new Date().toISOString() }).eq('id', row.id);
      continue;
    }

    const { count, limited } = await getFollowers(username);

    if (limited) {
      console.log(`\n  Rate limit! ${i} hesap islendi, ${rows.length - i} kaldi.`);
      console.log('  5 dk bekleyip tekrar deniyor...\n');
      await new Promise(r => setTimeout(r, 300000));
      i--;
      continue;
    }

    if (count) {
      await supabase.from('shopify_stores')
        .update({ ig_followers: count, ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      fetched++;
      console.log(`  [${i + 1}/${rows.length}] @${username}: ${count.toLocaleString('tr-TR')}`);
    } else {
      await supabase.from('shopify_stores')
        .update({ ig_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      failed++;
      console.log(`  [${i + 1}/${rows.length}] @${username}: -`);
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  console.log(`\nBitti: ${fetched} cekildi, ${failed} bulunamadi`);
}

main();

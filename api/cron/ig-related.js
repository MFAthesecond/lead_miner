const { getSupabase, verifyCron } = require('../_lib/supabase');
const { extractUsername, JUNK_IG_USERS, IG_UA, IG_APP_ID, calcLiteScore } = require('../_lib/ig');

// Mevcut instagram_leads kayitlari icin "related profiles" cek.
// IG'nin kendi onerdigi (genelde benzer sektor + ayni dil) hesaplari ekler.
// EN BUYUK kesif kanali - Turk shopify magazasi -> Turk butik onerileri zinciri.
//
// IKI ENDPOINT KULLANIRIZ:
//   1) web_profile_info.edge_related_profiles (login gerekirse bos doner)
//   2) discover/chaining (user_id ile, public)

const BATCH_SIZE = parseInt(process.env.RELATED_BATCH_SIZE || '5', 10);
const DELAY_MS   = parseInt(process.env.RELATED_DELAY_MS || '2500', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchProfileWithId(username) {
  const endpoints = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': IG_UA, 'X-IG-App-ID': IG_APP_ID },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 401 || r.status === 429) return { rateLimited: true };
      if (r.status === 404) return { notFound: true };
      if (!r.ok) continue;
      const data = await r.json();
      const u = data?.data?.user;
      if (!u) continue;
      return {
        ok: true,
        id: u.id || u.pk,
        related: (u.edge_related_profiles?.edges || []).map(e => e.node).filter(Boolean),
      };
    } catch {}
  }
  return { error: true };
}

async function fetchChaining(targetId) {
  const url = `https://i.instagram.com/api/v1/discover/chaining/?target_id=${targetId}&include_chaining=true`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': IG_UA, 'X-IG-App-ID': IG_APP_ID },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401 || r.status === 429) return { rateLimited: true };
    if (!r.ok) return { error: true, status: r.status };
    const data = await r.json();
    return { ok: true, users: data?.users || [] };
  } catch {
    return { error: true };
  }
}

function isUsableUser(node) {
  if (!node) return false;
  const username = (node.username || '').toLowerCase();
  if (!username || JUNK_IG_USERS.has(username)) return false;
  if (!/^[a-z0-9._]{2,30}$/.test(username)) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  // Onceligimiz: takipci sayisi yuksek + henuz related cekilmemis hesaplar
  // Onlarin onerileri daha kaliteli olur
  const { data: rows, error } = await supabase
    .from('instagram_leads')
    .select('id, username, followers')
    .is('related_fetched_at', null)
    .order('followers', { ascending: false, nullsFirst: false })
    .limit(BATCH_SIZE);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) {
    return res.json({ ok: true, processed: 0, message: 'All leads have related fetched' });
  }

  const newCandidates = new Map(); // username -> {full_name, followers, source_username}
  const processedIds = [];
  let rateLimited = false;
  let viaWeb = 0, viaChaining = 0, errors = 0;

  for (const row of rows) {
    const username = extractUsername(row.username);
    if (!username) {
      processedIds.push(row.id);
      continue;
    }

    const profile = await fetchProfileWithId(username);
    if (profile.rateLimited) { rateLimited = true; break; }
    if (profile.error || profile.notFound) { errors++; processedIds.push(row.id); await sleep(DELAY_MS); continue; }

    // 1) edge_related_profiles
    let added = 0;
    for (const node of profile.related || []) {
      if (!isUsableUser(node)) continue;
      const u = node.username.toLowerCase();
      if (!newCandidates.has(u)) {
        newCandidates.set(u, {
          username: u,
          full_name: node.full_name || null,
          is_private: !!node.is_private,
          is_verified: !!node.is_verified,
          source_username: username,
        });
        added++;
      }
    }
    if (added > 0) viaWeb += added;

    // 2) chaining (her zaman dene; web related cogu zaman bos olur)
    if (profile.id) {
      await sleep(800);
      const chain = await fetchChaining(profile.id);
      if (chain.rateLimited) { rateLimited = true; processedIds.push(row.id); break; }
      if (chain.ok) {
        let chainAdded = 0;
        for (const u of chain.users || []) {
          if (!isUsableUser(u)) continue;
          const un = u.username.toLowerCase();
          if (!newCandidates.has(un)) {
            newCandidates.set(un, {
              username: un,
              full_name: u.full_name || null,
              is_private: !!u.is_private,
              is_verified: !!u.is_verified,
              source_username: username,
            });
            chainAdded++;
          }
        }
        viaChaining += chainAdded;
      }
    }

    processedIds.push(row.id);
    await sleep(DELAY_MS);
  }

  // Yeni adaylari instagram_leads'e ekle (sadece username + temel bilgi).
  // Detay enrich'i ig-enrich cron'u sonradan yapacak.
  const upserts = [...newCandidates.values()].map(c => ({
    username: c.username,
    full_name: c.full_name,
    is_private: c.is_private,
    is_verified: c.is_verified,
    notes: `related from @${c.source_username}`,
    source: 'related',
    lite_score: 0,
  }));

  let inserted = 0;
  if (upserts.length) {
    for (let i = 0; i < upserts.length; i += 500) {
      const slice = upserts.slice(i, i + 500);
      const { data, error: upErr } = await supabase
        .from('instagram_leads')
        .upsert(slice, { onConflict: 'username', ignoreDuplicates: true })
        .select('id');
      if (upErr) return res.status(500).json({ error: upErr.message, inserted });
      if (data) inserted += data.length;
    }
  }

  // Islenen kayitlari isaretle
  if (processedIds.length) {
    const ts = new Date().toISOString();
    await supabase
      .from('instagram_leads')
      .update({ related_fetched_at: ts })
      .in('id', processedIds);
  }

  return res.json({
    ok: true,
    processed: processedIds.length,
    candidates_found: upserts.length,
    inserted,
    via_web_related: viaWeb,
    via_chaining: viaChaining,
    errors,
    rate_limited: rateLimited,
    seed_usernames: rows.map(r => r.username),
  });
};

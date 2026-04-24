const { verifyCron } = require('../_lib/supabase');
const { igHeaders } = require('../_lib/ig');

// Tek seferlik debug endpoint: IG'nin hangi public endpoint'i Vercel'den
// login'siz calisiyor bilmek icin. Silmeden once test sonuclarini kaydet.

async function probe(url, referer) {
  try {
    const r = await fetch(url, {
      headers: igHeaders(referer),
      signal: AbortSignal.timeout(8000),
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      status: r.status,
      size: text.length,
      has_data: json?.data ? Object.keys(json.data) : null,
      top_keys: json ? Object.keys(json).slice(0, 10) : null,
      users_count: (json?.users || []).length,
      media_count: (json?.data?.top?.sections?.[0]?.layout_content?.medias || json?.items || json?.data?.hashtag?.edge_hashtag_to_top_posts?.edges || []).length,
      body_snippet: text.substring(0, 300),
    };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const username = req.query?.username || 'kotonturkey';
  const tag = req.query?.tag || 'butik';

  // 1) Profil (kontrol icin)
  const u1 = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
  const profile = await probe(u1, username);

  // Profile'den id al
  let userId = null;
  try {
    const r = await fetch(u1, { headers: igHeaders(username), signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    userId = j?.data?.user?.id;
  } catch {}

  // 2) Chaining
  const chain = userId ? await probe(
    `https://www.instagram.com/api/v1/discover/chaining/?target_id=${userId}&include_chaining=true`,
    username
  ) : { skipped: 'no_user_id' };

  // 3) Hashtag web info (public'tir genelde)
  const hashtag = await probe(
    `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`,
    `explore/tags/${tag}`
  );

  // 4) Explore tags (eski ama bazen calisir)
  const exploreTag = await probe(
    `https://www.instagram.com/explore/tags/${tag}/?__a=1&__d=dis`,
    `explore/tags/${tag}`
  );

  // 5) Hashtag sections (top/recent ayri)
  const tagSections = await probe(
    `https://www.instagram.com/api/v1/tags/${tag}/sections/?tab=top`,
    `explore/tags/${tag}`
  );

  // 6) Location search (location-based discovery)
  const location = await probe(
    `https://www.instagram.com/api/v1/fbsearch/places/?query=istanbul`,
    'explore/locations/'
  );

  // 7) User followers (mevcut IG'nin takipcileri - Turk butik -> Turk musteri zinciri)
  const followers = userId ? await probe(
    `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=20`,
    username
  ) : { skipped: 'no_user_id' };

  return res.json({
    ok: true,
    params: { username, tag, userId },
    profile,
    chain,
    hashtag_web_info: hashtag,
    explore_tag_legacy: exploreTag,
    tag_sections: tagSections,
    location_search: location,
    user_followers: followers,
  });
};

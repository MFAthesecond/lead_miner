// Instagram lead mining icin paylasilan yardimcilar.
// Tek bir API havuzunu yonetiriz: rate limit dostu olmak sart.
//
// IG'nin yeni bot kontrolu: Sec-Fetch-* header'larini denetliyor.
// Mobile UA + bos Sec-Fetch = "SecFetch Policy violation" 400 doner.
// Cozum: IG web sayfasinin XHR fetch'iyle birebir ayni header set.

const IG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';

function igHeaders(username) {
  const h = {
    'User-Agent': IG_UA,
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-IG-App-ID': IG_APP_ID,
    'X-ASBD-ID': '198387',
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Origin': 'https://www.instagram.com',
    'Referer': username
      ? `https://www.instagram.com/${username}/`
      : 'https://www.instagram.com/',
  };
  return h;
}

const JUNK_IG_USERS = new Set([
  'shopify','instagram','facebook','twitter','tiktok','meta','threads',
  'reel','reels','explore','share','sharer','intent','dialog',
  'accounts','about','developer','legal','privacy','terms',
  'stories','direct','tv','p','web','help','press','api',
  'login','signup','accounts.login','oauth',
]);

function extractUsername(input) {
  if (!input) return '';
  let u = String(input).trim();
  u = u.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  u = u.replace(/^@/, '');
  u = u.replace(/[\/?#].*$/, '');
  u = u.toLowerCase();
  if (!/^[a-z0-9._]{2,30}$/.test(u)) return '';
  if (JUNK_IG_USERS.has(u)) return '';
  return u;
}

const DM_SIGNAL_RX = /\b(dm|dms|mesaj|inbox|direct|d\.m)\b/i;
const ORDER_SIGNAL_RX = /\b(siparis|sipariş|order|sat[ıi]n al|whatsapp.?tan|dm.?den)\b/i;
const WA_SIGNAL_RX = /(wa\.me\/|api\.whatsapp\.com|whatsapp|\+?9?0?5\d{2}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2})/i;
const PHONE_EXTRACT_RX = /(\+?9?0?5\d{2}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2})/;
const WAME_RX = /wa\.me\/(\+?\d{10,15})/i;

function detectBioSignals(bio, externalUrl) {
  const text = (bio || '') + ' ' + (externalUrl || '');
  const has_dm_signal = DM_SIGNAL_RX.test(text) || ORDER_SIGNAL_RX.test(text);
  const has_wa_signal = WA_SIGNAL_RX.test(text);
  const has_website = !!(externalUrl && /^https?:\/\//i.test(externalUrl));

  let whatsapp = null;
  const wm = text.match(WAME_RX);
  if (wm) whatsapp = wm[1].replace(/\D/g, '');
  if (!whatsapp) {
    const pm = text.match(PHONE_EXTRACT_RX);
    if (pm) whatsapp = pm[1].replace(/\D/g, '');
  }

  return { has_dm_signal, has_wa_signal, has_website, whatsapp };
}

function calcLiteScore({ followers, has_dm_signal, has_wa_signal, has_website, is_business, is_private, post_count }) {
  if (is_private) return 0;
  let score = 0;
  const f = Math.max(0, Number(followers) || 0);
  score += Math.min(Math.log10(f + 1) * 20, 60);
  if (has_dm_signal) score += 15;
  if (has_wa_signal) score += 10;
  if (has_website) score += 5;
  if (is_business) score += 5;
  if ((Number(post_count) || 0) >= 50) score += 5;
  return Math.round(score);
}

async function fetchProfile(username) {
  // www.instagram.com'a same-origin gibi gidiyoruz (i.instagram.com same-origin degil).
  const endpoints = [
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: igHeaders(username),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.status === 401 || resp.status === 429) {
        return { rateLimited: true };
      }
      if (resp.status === 404) {
        return { notFound: true };
      }
      if (!resp.ok) continue;
      const data = await resp.json();
      const u = data?.data?.user;
      if (!u) continue;
      return {
        ok: true,
        profile: {
          full_name: u.full_name || null,
          bio: u.biography || null,
          external_url: u.external_url || null,
          business_email: u.business_email || null,
          business_phone: u.business_phone_number || null,
          followers: u.edge_followed_by?.count || 0,
          following: u.edge_follow?.count || 0,
          post_count: u.edge_owner_to_timeline_media?.count || 0,
          is_business: !!u.is_business_account,
          is_private: !!u.is_private,
          is_verified: !!u.is_verified,
          category: u.category_name || u.category_enum || null,
        },
      };
    } catch {}
  }

  return { error: true };
}

function buildEnrichedRow(profile, base = {}) {
  const signals = detectBioSignals(profile.bio, profile.external_url);
  const lite_score = calcLiteScore({
    followers: profile.followers,
    has_dm_signal: signals.has_dm_signal,
    has_wa_signal: signals.has_wa_signal,
    has_website: signals.has_website,
    is_business: profile.is_business,
    is_private: profile.is_private,
    post_count: profile.post_count,
  });

  return {
    ...base,
    full_name: profile.full_name,
    bio: profile.bio,
    external_url: profile.external_url,
    business_email: profile.business_email,
    business_phone: profile.business_phone,
    whatsapp: signals.whatsapp || base.whatsapp || null,
    followers: profile.followers,
    following: profile.following,
    post_count: profile.post_count,
    is_business: profile.is_business,
    is_private: profile.is_private,
    is_verified: profile.is_verified,
    category: profile.category,
    has_dm_signal: signals.has_dm_signal,
    has_wa_signal: signals.has_wa_signal,
    has_website: signals.has_website,
    lite_score,
    ig_fetched_at: new Date().toISOString(),
    enrich_failed_at: null,
  };
}

module.exports = {
  IG_UA,
  IG_APP_ID,
  igHeaders,
  JUNK_IG_USERS,
  extractUsername,
  detectBioSignals,
  calcLiteScore,
  fetchProfile,
  buildEnrichedRow,
};

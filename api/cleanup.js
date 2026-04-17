const { getSupabase, verifyCron } = require('./_lib/supabase');

const JUNK_NAME_PATTERNS = [
  /^test/i, /test$/i, /test\s*(store|shop|app|lab)/i, /\btest\d+/i, /\d+test/i,
  /hackerone/i, /hacker0/i, /hack0/i, /whitehat/i, /pentest/i, /h4x/i,
  /^0x00/i, /^0x52/i, /xss/i, /alert\(/i, /onerror/i,
  /^">/,  /script/i,
  /please log in/i, /please contact shopify/i,
  /lock iconshopify/i, /shopify logo/i,
  /dev store/i, /dev shop/i, /dev partner/i,
  /^my store/i, /^my shop/i, /^my awesome/i, /^my dev/i,
  /^test$/i, /^demo$/i, /^example$/i,
  /^coming soon/i, /^under construction/i,
  /^maintenance/i, /^404$/i, /^not found/i,
  /^password/i, /^log in$/i, /^sign in$/i, /^sign up$/i,
  /^untitled$/i, /^homepage$/i, /^home$/i,
  /partner_webscael/i, /partnertest/i,
];

const JUNK_URL_PATTERNS = [
  /img-src.*onerror/i, /alert\d/i, /script.*alert/i,
  /hackerone/i, /hacker0/i, /hack0/i, /whitehat/i,
  /0x00-\d/i, /pentest/i,
  /test-\d{3,}/i,
];

function hasPaymentSpam(name) {
  if (!name) return false;
  const payments = ['American Express', 'Apple Pay', 'Diners Club', 'Discover',
    'Google Pay', 'Mastercard', 'PayPal', 'Shop Pay', 'Visa', 'Union Pay',
    'Maestro', 'JCB', 'Boleto', 'Elo', 'Hypercard', 'Bancontact', 'iDEAL'];
  const count = payments.filter(p => name.includes(p)).length;
  return count >= 2;
}

function isGibberish(name) {
  if (!name || name.length < 3) return true;
  const clean = name.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, '').trim();
  if (clean.length < 2) return true;
  if (/^[a-z]{15,}$/i.test(name.trim()) && !name.includes(' ')) return true;
  if (name.length > 120) return true;
  return false;
}

function isJunkStore(row) {
  const name = (row.store_name || '').trim();
  const url = row.url || '';
  const currency = row.currency || '';
  const followers = row.ig_followers || 0;
  const products = row.product_count;

  if (!name || name.length < 2) return 'no_name';
  if (JUNK_NAME_PATTERNS.some(rx => rx.test(name))) return 'junk_name';
  if (JUNK_URL_PATTERNS.some(rx => rx.test(url))) return 'junk_url';
  if (hasPaymentSpam(name)) return 'payment_spam';
  if (isGibberish(name)) return 'gibberish';

  const isMyshopify = url.includes('myshopify.com');
  if (isMyshopify && (currency === 'USD' || currency === 'EUR') && followers === 0 && !products) {
    return 'foreign_empty_myshopify';
  }

  return null;
}

const NON_TURKISH_IDS = [
  571,  // Blackstone Products - USD, US
  517,  // Anova Culinary - USD, US sous vide
  572,  // Atari - EUR, global brand
  574,  // TUSHY - USD, US bidet
  575,  // Altenew - EUR, US craft
  520,  // Vinegar Syndrome - EUR, US film
  578,  // C Fresh Foods - USD, Australian
  518,  // Curacao - USD, US electronics
  524,  // Lentes de Sol Noxen - USD, Latin American
  525,  // Protech Brasil - USD, Brazilian
];

const WHITELIST_IDS = new Set([
  183,  // Üç (ucel.com.tr) - gerçek Türk mağaza
  614,  // Ab (ab-igul.com) - gerçek Türk mağaza
  573,  // Limited Run Games - kullanıcı istedi
  835,  // Artinart - payment spam ama gerçek TR mağaza
  976,  // Veyro Tech Global - payment spam ama gerçek
  977,  // royalapexllc - My Store ama kullanıcı karar verdi
  676,  // MEBU Concept - payment spam ama gerçek TR
  1325, // Sculpture - payment spam ama gerçek TR
  3300, // Turgay's Watches - payment spam ama gerçek TR
  533,  // Birdiejay - payment spam ama gerçek TR
  1349, // Healthco - payment spam ama gerçek TR
  2181, // Yontu - payment spam ama gerçek TR
  577,  // Opti+Life - payment spam
]);

module.exports = async function handler(req, res) {
  if (!verifyCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('shopify_stores')
    .select('id, store_name, url, currency, ig_followers, product_count')
    .eq('is_shopify', true)
    .not('enriched_at', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const junkRows = [];
  for (const r of rows) {
    if (WHITELIST_IDS.has(r.id)) continue;
    const reason = isJunkStore(r);
    if (reason) {
      junkRows.push({ ...r, reason });
    } else if (NON_TURKISH_IDS.includes(r.id)) {
      junkRows.push({ ...r, reason: 'non_turkish' });
    }
  }

  if (req.query.dry === 'true') {
    const byReason = {};
    for (const r of junkRows) {
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    }
    return res.json({
      total_stores: rows.length,
      junk_count: junkRows.length,
      remaining: rows.length - junkRows.length,
      by_reason: byReason,
      junk_samples: junkRows.slice(0, 100).map(r => ({
        id: r.id, name: (r.store_name || '').slice(0, 80), url: r.url, reason: r.reason
      })),
    });
  }

  const ids = junkRows.map(r => r.id);
  let cleaned = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: upErr } = await supabase
      .from('shopify_stores')
      .update({ is_shopify: false })
      .in('id', batch);
    if (!upErr) cleaned += batch.length;
  }

  const PAYMENT_WORDS = ['American Express','Apple Pay','Diners Club','Discover',
    'Google Pay','Mastercard','PayPal','Shop Pay','Visa','Union Pay',
    'Maestro','JCB','Boleto','Elo','Hypercard','Bancontact','iDEAL','Wero',
    'Visa Electron','Person','Lock icon','Shopify logo','arrow',
    'SearchRight','Right arrow long','belluserminusplusbarsfile','iconYouTube','iconPinterest',
    'icon','account icon'];
  const whitelistRows = rows.filter(r => WHITELIST_IDS.has(r.id));
  let namesFixed = 0;
  for (const r of whitelistRows) {
    let name = r.store_name || '';
    if (!name) continue;
    let cleaned_name = name.split('\n')[0].trim();
    for (const pw of PAYMENT_WORDS) {
      cleaned_name = cleaned_name.replaceAll(pw, '');
    }
    cleaned_name = cleaned_name.replace(/\s{2,}/g, ' ').trim();
    if (cleaned_name !== name) {
      await supabase.from('shopify_stores').update({ store_name: cleaned_name }).eq('id', r.id);
      namesFixed++;
    }
  }

  return res.json({ ok: true, total_stores: rows.length, cleaned, remaining: rows.length - cleaned, names_fixed: namesFixed });
};

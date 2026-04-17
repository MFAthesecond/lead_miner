const { createClient } = require('@supabase/supabase-js');

let _supabase;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL veya SUPABASE_KEY tanımlı değil');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return _supabase;
}

const CRON_SECRET = process.env.CRON_SECRET || '';

function verifyCron(req) {
  if (CRON_SECRET && req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
    return false;
  }
  return true;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BIG_BRANDS = new Set([
  'derimod','lesbenjamins','mavi','lcwaikiki','kigili','colins',
  'pierrecardin','hatemoglu','damat','tween','avva','uspoloassn',
  'defacto','vakko','beymen','ipekyol','machka','network','koton',
  'boyner','english-home','madamecoco','karaca','teknosa','mediamarkt',
  'hepsiburada','trendyol','n11','ciceksepeti','yemeksepeti',
]);

function isBigBrand(url) {
  try {
    let host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const name = host.split('.')[0].replace(/-/g, '');
    return BIG_BRANDS.has(name);
  } catch { return false; }
}

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

module.exports = { getSupabase, verifyCron, UA, BIG_BRANDS, isBigBrand, domainFromUrl };

const QRCode = require('qrcode');
const brand = require('./brand');

// Words we never allow as a card slug (they are real routes).
const RESERVED = new Set([
  'admin', 'login', 'logout', 'public', 'assets', 'static',
  'api', 'favicon.ico', 'robots.txt', 'health', 'vcard'
]);

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')    // strip accents
    .replace(/[^a-z0-9]+/g, '-')        // non-alphanumerics -> dash
    .replace(/^-+|-+$/g, '')            // trim dashes
    .replace(/-{2,}/g, '-')             // collapse dashes
    .slice(0, 60);
}

// Build a unique slug, checking the DB for collisions.
function uniqueSlug(db, desired, ignoreId = null) {
  let base = slugify(desired) || 'card';
  if (RESERVED.has(base)) base = `${base}-1`;
  let slug = base;
  let n = 1;
  const stmt = db.prepare('SELECT id FROM cards WHERE slug = ?');
  while (true) {
    const row = stmt.get(slug);
    if (!row || row.id === ignoreId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

async function qrDataUrl(text, opts = {}) {
  return QRCode.toDataURL(text, {
    // 'H' (30% recovery) keeps the code scannable with the brand mark over its centre.
    errorCorrectionLevel: 'H',
    margin: 1,
    scale: 8,
    color: { dark: '#0b2a4a', light: '#ffffff00' },
    ...opts
  });
}

// Escape a value for inclusion inside a vCard field.
function vcardEscape(s) {
  return String(s || '').replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

function buildVCard(card) {
  const names = String(card.full_name || '').trim().split(/\s+/);
  const last = names.length > 1 ? names[names.length - 1] : '';
  const first = names.slice(0, names.length > 1 ? -1 : 1).join(' ');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${vcardEscape(last)};${vcardEscape(first)};;;`,
    `FN:${vcardEscape(card.full_name)}`,
    `ORG:${vcardEscape(brand.org)}`,
  ];
  if (card.job_title) lines.push(`TITLE:${vcardEscape(card.job_title)}`);
  if (card.phone) lines.push(`TEL;TYPE=CELL:${vcardEscape(card.phone)}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${vcardEscape(card.email)}`);
  if (card.website) lines.push(`URL:${vcardEscape(card.website)}`);
  if (card.location) lines.push(`ADR;TYPE=WORK:;;${vcardEscape(card.location)};;;;`);
  const tg = telegramLink(card.telegram);
  if (tg) lines.push(`X-SOCIALPROFILE;TYPE=Telegram:${vcardEscape(tg)}`);
  if (card.wechat) lines.push(`NOTE:WeChat: ${vcardEscape(card.wechat)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

// Normalise a phone number for tel: / wa.me links (digits only, keep leading +).
function phoneDigits(phone) {
  if (!phone) return '';
  const plus = String(phone).trim().startsWith('+');
  const digits = String(phone).replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}

// Build a t.me link from a Telegram handle or URL. Returns '' if empty.
function telegramLink(handle) {
  if (!handle) return '';
  let h = String(handle).trim();
  if (/^https?:\/\//i.test(h)) return h; // already a full URL
  h = h.replace(/^@/, '')
       .replace(/^(?:t|telegram)\.me\//i, '')
       .replace(/[^A-Za-z0-9_]/g, '');
  return h ? `https://t.me/${h}` : '';
}

function normalizeUrl(url) {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

module.exports = {
  RESERVED, slugify, uniqueSlug, qrDataUrl,
  buildVCard, phoneDigits, normalizeUrl, telegramLink
};

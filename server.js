require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const helmet = require('helmet');

const db = require('./src/db');
const brand = require('./src/brand');
const {
  uniqueSlug, slugify, qrDataUrl, buildVCard,
  phoneDigits, normalizeUrl, telegramLink, RESERVED
} = require('./src/util');

const app = express();
const PORT = process.env.PORT || 8020;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

// The app is expected to sit behind an nginx/Caddy reverse proxy.
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Build the public base URL for a request (used for share links / QR / OG tags).
function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.urlencoded({ extended: true }));

// Brand name/URL are available to every template as `brand`.
app.use((req, res, next) => {
  res.locals.brand = brand;
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14 // 14 days
  }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.redirect('/admin/login');
}

// ---------- Health ----------
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.get('/admin/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get((username || '').trim());
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).render('login', { error: 'Invalid username or password.' });
  }
  req.session.adminId = admin.id;
  req.session.adminUser = admin.username;
  res.redirect('/admin');
});

app.post('/admin/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ---------- Dashboard ----------
app.get('/admin', requireAuth, (req, res) => {
  const cards = db.prepare('SELECT * FROM cards ORDER BY datetime(updated_at) DESC').all();
  res.render('dashboard', {
    cards,
    adminUser: req.session.adminUser,
    base: baseUrl(req),
    flash: req.session.flash || null
  });
  req.session.flash = null;
});

// New / edit form
app.get('/admin/cards/new', requireAuth, (req, res) => {
  res.render('card-form', { card: null, errors: [], base: baseUrl(req), adminUser: req.session.adminUser });
});

app.get('/admin/cards/:id/edit', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.redirect('/admin');
  res.render('card-form', { card, errors: [], base: baseUrl(req), adminUser: req.session.adminUser });
});

function readForm(body) {
  return {
    full_name: (body.full_name || '').trim(),
    job_title: (body.job_title || '').trim(),
    phone: (body.phone || '').trim(),
    email: (body.email || '').trim(),
    linkedin_url: normalizeUrl((body.linkedin_url || '').trim()),
    website: normalizeUrl((body.website || '').trim()) || brand.url,
    location: (body.location || '').trim() || 'Dubai, United Arab Emirates',
    wechat: (body.wechat || '').trim(),
    telegram: (body.telegram || '').trim(),
    slug_raw: (body.slug || '').trim()
  };
}

function validate(data) {
  const errors = [];
  if (!data.full_name) errors.push('Full name is required.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Email looks invalid.');
  return errors;
}

// Create
app.post('/admin/cards', requireAuth, (req, res) => {
  const data = readForm(req.body);
  const errors = validate(data);
  if (errors.length) {
    return res.status(400).render('card-form', {
      card: data, errors, base: baseUrl(req), adminUser: req.session.adminUser
    });
  }
  const slug = uniqueSlug(db, data.slug_raw || data.full_name);
  const info = db.prepare(`
    INSERT INTO cards (slug, full_name, job_title, phone, email, linkedin_url, website, location, wechat, telegram)
    VALUES (@slug, @full_name, @job_title, @phone, @email, @linkedin_url, @website, @location, @wechat, @telegram)
  `).run({ ...data, slug });
  req.session.flash = { type: 'created', id: info.lastInsertRowid, slug };
  res.redirect('/admin');
});

// Update
app.post('/admin/cards/:id', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.redirect('/admin');
  const data = readForm(req.body);
  const errors = validate(data);
  if (errors.length) {
    return res.status(400).render('card-form', {
      card: { ...card, ...data }, errors, base: baseUrl(req), adminUser: req.session.adminUser
    });
  }
  const desired = data.slug_raw || card.slug;
  const slug = uniqueSlug(db, desired, card.id);
  db.prepare(`
    UPDATE cards SET
      slug=@slug, full_name=@full_name, job_title=@job_title, phone=@phone,
      email=@email, linkedin_url=@linkedin_url, website=@website, location=@location,
      wechat=@wechat, telegram=@telegram,
      updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...data, slug, id: card.id });
  req.session.flash = { type: 'updated', id: card.id, slug };
  res.redirect('/admin');
});

// Toggle active
app.post('/admin/cards/:id/toggle', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (card) {
    db.prepare('UPDATE cards SET is_active = ?, updated_at=datetime(\'now\') WHERE id = ?')
      .run(card.is_active ? 0 : 1, card.id);
  }
  res.redirect('/admin');
});

// Delete
app.post('/admin/cards/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  req.session.flash = { type: 'deleted' };
  res.redirect('/admin');
});

// ---------- Public vCard download ----------
app.get('/:slug/vcard', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!card) return res.status(404).send('Not found');
  const vcf = buildVCard(card);
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${card.slug}.vcf"`);
  res.send(vcf);
});

// ---------- Public card page ----------
app.get('/:slug', async (req, res, next) => {
  if (RESERVED.has(req.params.slug)) return next();
  const card = db.prepare('SELECT * FROM cards WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!card) return next();

  const base = baseUrl(req);
  const url = `${base}/${card.slug}`;
  // QR encodes the contact as a vCard so scanning it offers "Add to Contacts".
  const qr = await qrDataUrl(buildVCard(card));
  const wa = phoneDigits(card.phone).replace(/^\+/, '');

  res.render('card', {
    card,
    url,
    qr,
    tel: phoneDigits(card.phone),
    whatsapp: wa ? `https://wa.me/${wa}` : '',
    telegram: telegramLink(card.telegram),
    website: card.website,
    base,
    // Show the branded blue side first; tap (or ?face=front) reveals the details.
    flipped: req.query.face !== 'front'
  });
});

// ---------- Root ----------
app.get('/', (req, res) => {
  // No public homepage — send visitors to the admin login.
  res.redirect('/admin/login');
});

// 404
app.use((req, res) => {
  res.status(404).render('notfound');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`${brand.name} e-cards running on http://127.0.0.1:${PORT}`);
});

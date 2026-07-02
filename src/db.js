const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ecards.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cards (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT UNIQUE NOT NULL,
    full_name     TEXT NOT NULL,
    job_title     TEXT,
    phone         TEXT,
    email         TEXT,
    linkedin_url  TEXT,
    website       TEXT,
    location      TEXT,
    wechat        TEXT,
    telegram      TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Lightweight migrations for columns added after the initial release.
const cardCols = db.prepare('PRAGMA table_info(cards)').all().map((c) => c.name);
if (!cardCols.includes('wechat')) db.exec('ALTER TABLE cards ADD COLUMN wechat TEXT');
if (!cardCols.includes('telegram')) db.exec('ALTER TABLE cards ADD COLUMN telegram TEXT');

module.exports = db;

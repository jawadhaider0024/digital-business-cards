# Digital Business Cards (E-Cards)

A self-hosted digital business card platform. Each employee gets a shareable URL
that renders an animated flip card — contact details on one side, branding on the
other — with one-tap Call / WhatsApp / Email / LinkedIn actions, a scannable QR
code, and a downloadable vCard. A single super-admin dashboard manages every card.

Branding is configuration, not code — set two environment variables and drop in
your own logo files. See [Re-branding](#re-branding).

---

## What it does

**Public card** — `https://<your-domain>/<slug>`

- Flip card: white info side ↔ branded colour side
- Call, WhatsApp, Email, LinkedIn and Website buttons
- QR code that encodes the card URL, for scanning off a phone screen or print
- "Save contact" downloads a `.vcf` vCard straight into the phone's address book
- Office location link
- Responsive; designed mobile-first since these are shared over messaging apps

**Admin dashboard** — `https://<your-domain>/admin`

- Single super-admin login (bcrypt-hashed, session-backed)
- Create, edit, enable/disable and delete employee cards
- Each card gets an auto-generated shareable slug URL
- Disabled cards return a branded 404 rather than leaking data

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js + Express 4 |
| Views | EJS server-side templates |
| Database | SQLite via `better-sqlite3` (single file, no DB server) |
| Sessions | `express-session` + `connect-sqlite3` |
| Auth | `bcryptjs` password hashing |
| Security | `helmet` security headers |
| QR codes | `qrcode` |
| Process manager | PM2 |

SQLite was chosen deliberately — the dataset is small (tens of cards), and a single
file means backups are a file copy and there's no second service to keep alive.

## Requirements

- Node.js 18+
- npm

## Running locally

```bash
git clone https://github.com/jawadhaider0024/digital-business-cards.git
cd digital-business-cards
npm install
cp .env.example .env      # then edit the values — see below
npm run seed              # creates the super-admin from .env
npm start                 # http://127.0.0.1:8020
```

### Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` or `development` |
| `PORT` | Port to listen on (default `8020`) |
| `PUBLIC_BASE_URL` | Public origin — used to build card URLs and QR codes |
| `BRAND_NAME` | Name shown in titles, headers, the card back and the footer |
| `BRAND_URL` | Where "visit us" links point; the default website on a new card |
| `BRAND_ORG` | `ORG` field written into downloaded vCards (defaults to `BRAND_NAME`) |
| `SESSION_SECRET` | Long random string; keeps admin sessions secure |
| `ADMIN_USERNAME` | Super-admin login name |
| `ADMIN_PASSWORD` | Super-admin password (hashed at seed time, never stored plain) |

`.env` is gitignored. Never commit real credentials.

To change the admin password later, edit `ADMIN_PASSWORD` in `.env` and re-run
`npm run seed`.

## Project structure

```
server.js               # Express app, routes, session + auth middleware
ecosystem.config.js     # PM2 process definition
src/
├── brand.js            # Brand name/URL read from the environment
├── db.js               # SQLite schema, migrations, queries
├── seed.js             # Creates/updates the super-admin from .env
└── util.js             # Slug generation, vCard building, helpers
views/
├── card.ejs            # Public flip card
├── card-form.ejs       # Create/edit form
├── dashboard.ejs       # Admin card list
├── login.ejs           # Admin login
└── notfound.ejs        # Branded 404
public/
├── style.css           # Public card styles
├── card.js             # Flip interaction, vCard download
├── admin.css           # Dashboard styles
├── admin.js            # Dashboard interactions
└── assets/
    ├── brand-logo.png  # Full lockup — used as a CSS mask, only alpha matters
    ├── brand-mark.png  # Square mark — sits in the centre of the QR code
    ├── favicon.png
    └── og-default.png  # 1200x630 social preview
data/                   # SQLite file — created at runtime, gitignored
```

## Deployment

Runs behind any reverse proxy (nginx, Caddy, CloudPanel). Production setup:

```bash
npm ci --omit=dev
cp .env.example .env      # set real values, especially PUBLIC_BASE_URL
npm run seed
pm2 start ecosystem.config.js
pm2 save
```

Then point your reverse proxy at the app's port and terminate TLS there.

After changing `.env`, restart with `pm2 restart digital-business-cards`.

### Backups

The entire dataset is the SQLite file in `data/`. Back it up with a file copy or
`sqlite3 data/cards.db .dump > backup.sql`.

## Re-branding

No template edits required:

1. Set `BRAND_NAME` and `BRAND_URL` in `.env`. Every page title, header, card back,
   footer and vCard `ORG` field follows.
2. Replace the four image files in `public/assets/` listed above, keeping the same
   filenames. `brand-logo.png` is rendered through a CSS mask, so only its alpha
   channel matters — a transparent PNG of any single colour works.
3. Adjust the colour custom properties at the top of `public/style.css`.
4. Set `PUBLIC_BASE_URL` to your own domain so QR codes and share links resolve.

The images currently in `public/assets/` are the author's personal logo. They are
**not** covered by the MIT licence — replace them.

## Contributing

Issues and pull requests welcome. Useful directions: multi-admin roles with
per-department scoping, card view analytics, and bulk CSV import of employees.

## License

MIT — see [LICENSE](LICENSE). The logo files in `public/assets/` are the author's
personal mark and are **not** covered by that licence; replace them with your own.

---

Built by [Jawad Haider](https://jawadrizvi.com) · [github.com/jawadhaider0024](https://github.com/jawadhaider0024)

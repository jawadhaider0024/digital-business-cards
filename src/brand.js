// Everything that identifies the organisation the cards belong to. Set these in
// .env so a fork carries its own branding without touching a single template.
//
// The logo itself is not configured here — replace the image files in
// public/assets/ instead:
//   brand-logo.png   full lockup, used as a CSS mask (only its alpha matters)
//   brand-mark.png   square mark, sits in the centre of the QR code
//   favicon.png      browser tab icon
//   og-default.png   1200x630 social preview

const name = process.env.BRAND_NAME || 'jawad.';

module.exports = {
  // Shown in page titles, headers, the card back and the footer.
  name,
  // Where the "visit us" links point, and the default website on a new card.
  url: (process.env.BRAND_URL || 'https://jawadrizvi.com').replace(/\/$/, ''),
  // Written into the ORG field of every downloaded vCard.
  org: process.env.BRAND_ORG || name,
};

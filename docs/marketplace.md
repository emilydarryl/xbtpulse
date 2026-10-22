# XBT Market pilot

Public home: https://market.xbtpulse.tech (also `/market` on the main site). The existing Node/SQLite application serves a distinct marketplace frontend; the market hostname exposes only market routes/assets and health. Existing operator Admin stays on https://xbtpulse.tech/admin. This uses the established VPS and shared Caddy; no Sites project or hosting migration is involved.

## Scope

A moderated trading board for genuine goods/services priced in Bitcoin BLAKE2b (XBT). Buyers filter/search offers and contact sellers using a seller-provided public email or HTTPS link. No custody, checkout, escrow, automated emails, seller verification badge or completed-trade verification. No invented initial offers. No marketplace participation affects pool ratings. Images and editing published offers are not included in this pilot: withdraw and submit a replacement.

## Seller lifecycle

Submit title, category, exact decimal XBT price (up to eight decimal places), description, seller name, public contact, delivery method and region. Explicit publication consent and listing rules are required. Submissions start pending. The browser generates a random management secret; only its SHA-256 hash is stored. A private fragment link permits viewing the owner's submission and marking it sold or withdrawn, but cannot publish or edit it. Save the link; no automated recovery or email delivery is implemented. Lost-link requests require manual review and must never expose another seller's private key. Fragment is removed from the URL after opening; authorization travels in a Bearer header.

Ambiguous submission retries reuse the exact ID, secret and data. Validation failures allow correction. A global intake limit of 30 new listings/hour, 32 KiB request limit and honeypot bound the small pilot; authenticated retries do not consume another listing slot. This is not a full anti-abuse system. Admin review remains required.

Offers expire 30 days after submission, disappear when closed/expired, and are deleted after 90 days. Public listings omit management hashes and pending/rejected content. Prices remain decimal strings, never rounded through floating point. No seller or product is pre-approved.

## Moderation

Open the existing **Admin → Marketplace listing review** panel. Pending offers can be published or rejected; published offers can be removed. Review the real offer, contact details, delivery terms and prohibited categories first. Actions require the existing administrator session, parent-site Origin and CSRF token and enter the admin audit. An expired or seller-closed offer cannot be republished. The queue shows the newest 500 submissions. No automatic notifications are sent; check the queue manually.

Public API: `GET/POST /api/market/listings`. Public GET returns only published, unexpired offers. `GET /api/market/manage?id=...` and `POST /api/market/manage` require the per-listing Bearer secret. POST accepts only the configured parent or market Origin and JSON. Admin API is `/api/admin/market`. Production defaults: `ADMIN_ORIGIN=https://xbtpulse.tech`, `MARKET_ORIGIN=https://market.xbtpulse.tech`. Local tests may override these.

## Deployment

User configured DNS A record `market` → `2.25.153.143`. Caddy adds an isolated hostname block using the existing `xbtpulse-web:4317` upstream and automatic HTTPS. Preserve all existing routes and data. Additive SQLite table `market_listings` plus intake-limit metadata. Backups contain pending seller contact details and capability hashes; treat them as private.

Only synthetic offers in an isolated local database are used for testing. Never publish synthetic production listings. Confirm empty production listing API, successful TLS, parent health/readiness, and unauthenticated moderation rejection after deployment.

## Page navigation

The short home page links to `/market/browse` (12 offers per page), `/market/how`, `/market/sell`, and `/market/rules`. Navigation stays visible on phones. Seller capability links use `/market/manage#manage=...`; original `/market#manage=...` links and old section bookmarks redirect to their dedicated page. No secrets are placed in query parameters or persistent browser storage.

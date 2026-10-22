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

## Pseudonymous sellers and private orders (October 22)

`/market/seller` creates a stable UUID profile with a public pseudonym and join date. Names are not unique and identity is not verified. No KYC document, legal name, password or account email is requested. Random 256-bit seller capabilities are created in the browser, hashed in SQLite, carried in URL fragments for access, stripped on opening and sent in Authorization headers. They are not stored in browser storage or emailed; save the link. No automatic recovery or key rotation exists in this pilot. Do not share a private link with support.

A public `/market/profile?id=...` becomes public after its first linked offer is approved and remains available even without active offers (subject to retention). Seller names for linked submissions come from the authenticated profile, not a client claim. Existing listing links require both the listing and seller capabilities to associate, and association returns the listing to pending review. A different profile cannot take over an already linked listing. Listing management keys still close the individual offer; seller profiles control order decisions. Dashboard lists newest 100 offers and requests with 10 per page; public profile offers show 12 per page. There are no ratings or claims of verified completed trades.

### Direct-payment process

The public `/market/payments` and `/market/help` explain the complete process and limitations. `/market/order?listing=...` accepts a buyer pseudonym, private contact, exact total XBT and proposed delivery/refund terms. Only approved, unexpired profile-linked offers accept requests. The order stores an immutable offer snapshot and proposed terms. Buyer receives a separate private capability link; seller accesses orders from their saved desk link. No notifications are sent.

States: requested → agreed → payment_sent → paid → fulfilled → complete. Before acceptance, the buyer can cancel and seller can decline. Seller acceptance requires a receiving address, payment instructions/deadline and required confirmation count, and checks that the offer remains approved and unexpired. Address validation is syntactic only, not chain/network/checksum validation. The buyer pays using their own wallet, then records a 64-hex transaction ID. The seller independently checks their own wallet for the correct amount, recipient, chain and confirmations before recording receipt. Only then can they report fulfilment; only the buyer can confirm delivery. These statements are explicitly not independent payment or delivery verification. There is no wallet connection, chain payment monitor, custody or escrow.

Either participant can open a private issue after acceptance. While open, normal progression pauses. Both may add notes; the opener can record resolution and resume the existing stage. Support sees open issues in Admin → Marketplace order issues and can leave notes to both parties with existing session, Origin, CSRF and audit controls. Support cannot move funds, force refunds or provide binding arbitration. A seller may report a full-refund transaction on a payment-reported/paid/fulfilled/complete order with an open issue. Only the buyer can confirm receipt and close it as refunded. Partial refund arrangements remain discussion notes, not a special status. Each issue thread is bounded to 40 ordinary notes; resolution remains available at the cap. Contact form is the fallback for lost access or a full thread. No guaranteed response time.

Order events record actor, action and timestamp atomically with each state change. Keys never appear in public responses. Private records are not end-to-end encrypted and site operators can access them, as disclosed before submission. Do not enter shipping addresses, identity documents or wallet keys. Orders, payment references, issue notes and history expire 180 days after creation; empty seller profiles are removed after a year when they have no retained offers/orders. Backups may retain historical records under the server's backup lifecycle.

Added tables: `market_sellers`, `market_orders`, `market_order_events`. APIs: `/api/market/seller`, `/api/market/profile`, `/api/market/orders`; issue administration `/api/admin/market-issues` stays on the parent hostname. POSTs require allowed Origin and JSON; private reads/actions require the corresponding capability. Profile creation is capped at 30/hour globally; orders at 60/hour. Idempotent creation retries must match the original contents and capability. Existing API and operator telemetry remain separate.

Escrow is not implemented. Before offering it, decide the custody/signing arrangement, XBT wallet compatibility, funding/release verification, deadlines, evidence and dispute authority, refund paths and operational responsibilities. Do not label the direct-pay pilot as protected trading.

## Private platform-fee pilot

The source now includes an off-by-default 2% seller fee with a separate XBTPay invoice and persistent reconciliation. It is enabled only in an isolated private pilot; the public deployment is unchanged. No seller purchase funds pass through the platform wallet. See [fee policy, configuration, recovery and launch gates](marketplace-fees.md). Verified platform-fee payment would establish payment of that fee only, not purchase completion, seller identity or delivery.

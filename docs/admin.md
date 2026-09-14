# Administration

Open https://xbtpulse.tech/admin. Applications submitted through `/contribute` are stored privately in the VPS SQLite data volume; they are not emailed.

For first access, run `docker exec xbtpulse-xbtpulse-1 node ops.mjs admin-bootstrap` over SSH. The single-use setup code expires after 30 minutes. Enter it on the admin page and choose a password of at least 14 characters. Store the password in your password manager. An expired code can be replaced by rerunning the command. If access is lost, `admin-reset` invalidates the password and all sessions and creates a new setup code. Never share setup codes publicly.

The review desk shows pending, approved and declined applications. Review the operator's identity and reporting scope before approving. Choose a unique public provider ID, confirm your review, and save the token shown once. Deliver it privately to the operator yourself. Approval does not send email, award a rating or map the provider to a pool automatically. Pool mappings still require review in `config/pools.json`.

Declined applications can be reopened. Revoke stops a database provider's new reports. Issue new token replaces the previous token and reactivates access. These controls manage database providers, not legacy `TELEMETRY_KEYS_JSON` entries. Tokens cannot be retrieved later. The activity list records actions without credentials.

Sessions expire after eight hours and use Secure, HttpOnly, SameSite cookies. Mutations require the configured request origin and a session CSRF token. Login attempts are globally limited to 20 per 15-minute window. Passwords use salted scrypt hashes; provider tokens and session tokens are stored as SHA-256 digests. Back up the data volume securely because it contains private applications and authentication data.

`ADMIN_ORIGIN` defaults to `https://xbtpulse.tech`; override it only for another deployment origin. HTTPS is required for the session cookie.

## Pool profiles

Click a pool name on the dashboard to open `/pool?id=...`. Operators can submit optional public details through `/contribute`, including replacements for existing profiles. They must explicitly consent to publication. In admin, review the submitted fields and website, select **Review & publish profile**, enter the exact Pool ID shown on its public page, and confirm identity and scope. Publication replaces the profile details, records the review date, and does not approve telemetry or award ratings. Contact details and setup notes never enter the public profile.

## Researched public profiles

`config/researched-profiles.json` supplies dated public research when no reviewed operator profile exists. Each entry needs official source links and a last-checked date; preserve endpoint-specific fees and disclose conflicting claims. Unknown fields remain blank. Operator publications take precedence over the entire researched profile, so sources are never silently mixed. Research does not enable telemetry or award ratings. Mining observations refresh every 30 seconds; public terms are reviewed snapshots and do not automatically update.

## Private pools

Operators can choose Private pool and supply a public statement about their nodes and template policy. Publication still requires explicit consent and administrator review. For a private pool with no existing attributed profile, use a unique ID such as private:pool-name. These profiles are listed on the main page and show unavailable attribution rather than claiming zero mining share. Link attribution and telemetry only after reviewing evidence in the registry. Public connection guides and fee fields are omitted for private profiles. No badge or rating is awarded merely for publishing a profile; the draft assessment rules apply equally to all pools.

## Automated review checks (v1)

Application cards contain evidence checklists, recomputed on each admin refresh and every minute while the review desk is visible. These are read-only checks, not background website monitoring or rating decisions. Approve a provider for onboarding first, then select Approved or All applications. A Ready for review label requires active database providers, successful credential challenges in the last 30 days, positive work within 30 minutes, at least 95% complete interval coverage in the past 24 hours for each provider, and no detected inconsistencies in accepted intervals. This readiness threshold is separate from Telemetry Contributor eligibility.

Use Issue credential challenge and privately deliver the displayed instructions. Operators POST the code to /api/telemetry/challenge using their existing bearer token. Codes expire in 30 minutes, are single-use, and are bound to the current token digest. Rotation or revocation invalidates the evidence. This establishes credential access only; it does not prove hardware ownership, truthful reports or independent templates.

Reported found/expected ratios are context only and are never scored because mining luck varies. Chain comparisons, public-policy changes, ownership and template control still require human review. Rejected submissions are not retained, so the checklist does not claim to audit rejection history. Profiles created directly through the backend need an application and approved provider before telemetry review is available. No automatic higher-rating award or external messages are sent.

## Private application conversations

Use Messages on an application to read the conversation and send an operator-visible reply. New applicants receive a private link when they submit; they must bookmark it and return to check replies. For existing applicants, create a link from the conversation dialog and share it through their stated contact channel yourself. Creating a replacement link invalidates the previous one. Anyone holding the link can read and reply, so treat it as a credential. Only its hash is stored in the database; the secret is in the URL fragment, not the request path. No email or Discord notifications are sent.

Messages are plain text (4000 characters maximum); operators can send ten per hour and each conversation holds at most 200 messages. Application cards display unread operator replies. The operator view refreshes every 30 seconds. Conversation access ends if the application is removed. Messages stay in the private database and never appear in pool profiles. Never send wallet keys or telemetry tokens through the conversation. Admin sending is explicit through Send reply; opening a conversation or creating a link does not send messages.

## Scorecard workflow

Open an application's Assessment scorecard. Select the observation period and run assessment checks. The assistant examines accepted telemetry intervals and bounded public website sources. It prefills only empty evidence, scope and reason fields; existing entries and numeric scores are preserved. These changes remain unsaved. Review source claims and redact private details before saving.

Accepting a suggested telemetry percentage requires explicit confirmation that the reporting scope and accounting are representative. Automated results cannot establish independent templates or common ownership. Save the draft, inspect the public preview, and publish only when the separate publication checks pass. Publication requires an approved application, consent, a linked published profile, complete evidence, current dates and at least 30 calendar days of observation. See [scorecards](scorecards.md) and [assessment checks](assessment-checks.md).

## Public visibility

Listing consent permits a pending name/status listing; profile consent permits reviewed publication and approved onboarding visibility. The directory includes approved consenting listings as well as public block attributions and profiles. Similar names are not automatically merged. Contact details, conversations and draft assessments remain private. The public change feed records observed participation-status changes, not historical approval dates or scorecard revisions.

Public operators can have reviewed profiles before any attributed blocks. In Admin, use Review & publish profile and leave Pool ID blank to create a stable operator profile (or reuse that application's existing profile). Publication requires profile consent and identity/scope review. It does not establish block attribution, link telemetry, or award a rating. Existing attributed pool IDs should only be selected after verifying the relationship.

## Private token claim links

Admins can select **Create token claim link** beside an approved active provider in Admin. Share that one-use private link with the intended operator through their existing private contact channel. It expires after 24 hours; a newer link supersedes the previous link. Creating or opening it does not change the current token.

The operator confirms replacement, generates the token and downloads `token.txt`. Only claiming replaces the previous token. Tokens are never placed in application conversations or stored in recoverable form; the server stores hashes. Revocation, loss of approval or an intervening token rotation blocks the claim. Anyone holding the private link can claim it, so never publish it. No message is sent automatically. A lost response or lost download requires a new admin-issued link; do not assume the old token still works.

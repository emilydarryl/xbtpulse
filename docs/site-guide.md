# XBT Pulse visitor guide

Mission: **Making XBT mining decentralization visible.** Explore pool concentration, template control and transparency backed by evidence.

| Page | What to use it for |
| --- | --- |
| `/` | Current observed distribution, concentration signals, recipients, template telemetry, recent blocks and onboarding listings |
| `/miner-checker` | Examine hosted or own-DATUM-gateway paths, sourced terms and missing setup evidence |
| `/watchlist` | Browser-saved favorite pools, changes since the previous visit and comparison shortcuts |
| `/compare` | Compare up to three pools by common observation window, sourced terms, evidence freshness and published scores; download a PNG share card |
| `/pools` | Search named pools of every size; filter public/private/unspecified type; find older block observations and published profiles |
| `/pool?id=...` | One pool's observation windows, recipients, public terms, linked telemetry and any published scorecard |
| `/trends` | 24-hour, 7-day and 30-day shares; daily operator bars; public status-change feed |
| `/mining-map` | Explore gateway/upstream relationships and the scope/date of their evidence |
| `/ratings` and `/scoring-rules` | Understand badges, proposed tiers, the numerical pilot rubric and review requirements |
| `/scorecard?pool=...` | A published reviewer scorecard; absent/unpublished assessments are unavailable |
| `/contribute` | Register a public/private operator, update details or submit authorized telemetry |
| `/verify-downloads` | Pinned signing-key fingerprint, detached signatures and archive verification instructions |
| `/adapter` | Operator-controlled upload kit, download, compatibility checklist and scope guidance |
| `/collector` | Install the compatible DATUM telemetry collector; it is an uploader, not the read API |
| `/admin` | Private operator review, token management, conversations and assessment tools |

Every page uses the coin-and-pulse logo. Secondary pages provide an explicit Main site link. The homepage has a compact Find a pool search and links to the directory, map and history. The observation-window selector sits immediately above dashboard statistics, beside the source update timestamp.

## Smaller pools and production ranking

The donut displays the four largest named pools, Other attributed groups and Unknown, ordered by descending share clockwise. Other combines the remaining named pools. Click its label to open a ranked bar chart and statistics for those groups. Network share uses all observed blocks; Share of Other uses only the grouped blocks. Tied counts share a rank among all named pools. The dialog is a dated snapshot; reopen it for newer data.

Production rank is not a decentralization ranking. Use the directory for pools absent from the latest block window. Its last observed time is a block timestamp, not a heartbeat. Two similar names are not automatically merged. An approved listing without a published profile is displayed without inventing a profile link.

## Evidence and participation

Recent onboarding cards display only consenting listings. Explicit listing consent permits pending visibility; legacy profile consent is used only after approval. The directory includes approved consenting operators, not pending applications. Private contact information and conversations are never public listings.

Telemetry Contributor means approved, recent positive reporting, with explicit mapping required for a pool badge. It does not establish independent templates, ownership or complete network coverage. Pilot scorecards contain two out-of-100 totals only after a reviewer satisfies all criteria and publication requirements; higher-tier labels remain proposed.

The Mining map currently contains a dated Soveroot–Lazarus connection inspection. Generic miner/network arrows are explanatory. It does not represent all pools, live network traffic or hashrate. Approved operators are not automatically inserted as verified relationships.

History grows from retained canonical blocks and can be partial during backfill or after resets. The change feed records status observations from when tracking began. No observations, no profile or no recent block must not be presented as evidence that a pool is offline.

For data integrations, use the [public API](api.md). For contributing, follow the [operator decision guide](operators.md).

Pool pages include an attribution section. Where a reviewed map exists, it shows observed tag groups flowing to a collection address and the pool grouping, with dated snapshot counts, source links and limitations. Unmapped pools explicitly state that no reviewed map is published.

Pool pages show evidence freshness for attribution, profile terms and published scorecards, plus each reviewed linked telemetry provider. Reviews are due after 30 days; assessment age uses the oldest criterion check or observation end. Reports older than 30 minutes are stale. These are notices, not automatic rating/attribution changes. Operators can follow the correction link to submit updated evidence.

## Compare and share pools

See the [comparison and sharing guide](comparisons.md) for step-by-step instructions.

Comparison links are available on the homepage navigation, directory and pool profiles. Selection and window are shareable URL parameters (`pool` repeated up to three times, `window=144/576/2016`). Private commercial terms remain not applicable; missing scores are not zero. Each profile is fetched separately, with a notice if snapshot timestamps/sample sizes differ. No automatic winner is selected.

The comparison picker shows suggestions only after a pool name is entered. Adding a pool clears suggestions; removable selected-pool chips sit above the comparison.

On the comparison page, select two or three pools and choose **Share comparison card** to preview and download a PNG for Discord. **Copy comparison link** supplies the live URL to post alongside the image. Cards include their creation time, observation window, source freshness, sourced terms and separate published scores. Missing scores remain unassessed. The preview stays a fixed snapshot while the page refreshes; reopen it for a newer image. Long fields can be shortened, so consult the included profile/source links for full details.

## My watchlist

Open a pool profile and choose **Watch this pool**, then follow **My watchlist** (also linked from the homepage and directory). Up to 20 pools are saved only in this browser; clearing site data removes the list and it does not sync across devices.

The page shows the latest 144-block share, chain source status, sourced fees, telemetry status and separate published scores. Select two or three checkboxes to compare. Remove buttons stop watching a pool. Data refreshes every 30 seconds while visible.

Fee, telemetry-status and published-assessment changes are compared with the saved observation from your previous visit (or when you first watched the pool). That baseline stays fixed during the current visit. Successful observations are saved for the next visit; failed requests preserve previous data. This is a browser snapshot comparison, not a complete event log: changes between visits can be missed. Mining-share movements are displayed in current stats, not listed as change events. No email, Discord or push notifications are sent. Storage errors are shown rather than claiming the list was saved.

## Who builds my block?

Open **Who builds my block?** from the homepage or a pool profile. Search a published pool, then select **Hosted mining / Stratum service** or **My own DATUM gateway**. The URL preserves the pool and mode for sharing. Search shows up to 30 results; refine your query for a smaller set.

The illustrated path describes your chosen setup, not a detected connection. The checker displays published template-role, payout, protocol and fee claims with provenance, review dates and source links. It does not automatically assign an endpoint fee, payout coordinator or verified template builder. Private operators are educational examples and are marked as not accepting miners. The existing Soveroot–Lazarus connection is a dated inspection, not continuous verification.

Use the suggested evidence questions to establish transaction selection, template node, fallback behavior, gateway control and payout dependencies. Submit corrections through Contribute. No credentials, equipment access or new numerical rating are involved. Reload to retrieve newer public profile information.

## Pool change history

Each eligible pool profile has a **What changed?** section. Expand an observation to see previous and current fee/payout terms, template/protocol claims, publication/review dates, published assessment totals, linked telemetry status or source changes. The first entry is a baseline, not a claim that the operator just changed its setup.

Tracking runs on server collection cycles even without visitors. The latest 50 events are shown from 90-day retention; the total and tracking start are visible. A gap longer than three minutes (or three configured collection intervals, if longer) is labeled when observation resumes. Times are observation times, not exact operator change times. Changes between samples may be missed. History does not backfill events before tracking began, and does not send notifications. Unpublished or nonconsenting operator profiles are excluded from the public history response.

This persistent history differs from My watchlist, which compares only browser-saved visits. Public claims remain claims, and a telemetry transition does not establish an outage or template independence.

When accepted-work telemetry lacks block outcomes for any interval in the displayed window, Reported found shows Not available and the found/expected comparison is suppressed. Expected blocks and work share remain available. Missing outcomes never mean zero found blocks.

Directory name search ignores letter case and accents, so Crypto-Éire also matches Crypto-Eire. This affects search only; listings and pool identities remain separate.

Public operators can have reviewed profiles before any attributed blocks. In Admin, use Review & publish profile and leave Pool ID blank to create a stable operator profile (or reuse that application's existing profile). Publication requires profile consent and identity/scope review. It does not establish block attribution, link telemetry, or award a rating. Existing attributed pool IDs should only be selected after verifying the relationship.

Mining-map links from other pool profiles open that operator's own view with published claims and explicitly unmapped connections. They no longer select the unrelated Soveroot–Lazarus example. New operators do not receive inferred connection arrows.

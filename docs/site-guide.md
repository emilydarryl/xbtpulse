# XBT Pulse visitor guide

Mission: **Making XBT mining decentralization visible.** Explore pool concentration, template control and transparency backed by evidence.

| Page | What to use it for |
| --- | --- |
| `/` | Current observed distribution, concentration signals, recipients, template telemetry, recent blocks and onboarding listings |
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

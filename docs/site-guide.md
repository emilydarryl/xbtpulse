# XBT Pulse visitor guide

Mission: **Making XBT mining decentralization visible.** Explore pool concentration, template control and transparency backed by evidence.

| Page | What to use it for |
| --- | --- |
| `/` | Current observed distribution, concentration signals, recipients, template telemetry, recent blocks and onboarding listings |
| `/pools` | Search named pools of every size; filter public/private/unspecified type; find older block observations and published profiles |
| `/pool?id=...` | One pool's observation windows, recipients, public terms, linked telemetry and any published scorecard |
| `/trends` | 24-hour, 7-day and 30-day shares; daily operator bars; public status-change feed |
| `/mining-map` | Explore gateway/upstream relationships and the scope/date of their evidence |
| `/ratings` and `/scoring-rules` | Understand badges, proposed tiers, the numerical pilot rubric and review requirements |
| `/scorecard?pool=...` | A published reviewer scorecard; absent/unpublished assessments are unavailable |
| `/contribute` | Register a public/private operator, update details or submit authorized telemetry |
| `/collector` | Install the compatible DATUM telemetry collector; it is an uploader, not the read API |
| `/admin` | Private operator review, token management, conversations and assessment tools |

Every page uses the coin-and-pulse logo. Secondary pages provide an explicit Main site link. The homepage has a compact Find a pool search and links to the directory, map and history.

## Smaller pools and production ranking

The donut displays the four largest named pools, Other attributed groups and Unknown, ordered by descending share clockwise. Other combines the remaining named pools. Click its label to open a ranked bar chart and statistics for those groups. Network share uses all observed blocks; Share of Other uses only the grouped blocks. Tied counts share a rank among all named pools. The dialog is a dated snapshot; reopen it for newer data.

Production rank is not a decentralization ranking. Use the directory for pools absent from the latest block window. Its last observed time is a block timestamp, not a heartbeat. Two similar names are not automatically merged. An approved listing without a published profile is displayed without inventing a profile link.

## Evidence and participation

Recent onboarding cards display only consenting listings. Explicit listing consent permits pending visibility; legacy profile consent is used only after approval. The directory includes approved consenting operators, not pending applications. Private contact information and conversations are never public listings.

Telemetry Contributor means approved, recent positive reporting, with explicit mapping required for a pool badge. It does not establish independent templates, ownership or complete network coverage. Pilot scorecards contain two out-of-100 totals only after a reviewer satisfies all criteria and publication requirements; higher-tier labels remain proposed.

The Mining map currently contains a dated Soveroot–Lazarus connection inspection. Generic miner/network arrows are explanatory. It does not represent all pools, live network traffic or hashrate. Approved operators are not automatically inserted as verified relationships.

History grows from retained canonical blocks and can be partial during backfill or after resets. The change feed records status observations from when tracking began. No observations, no profile or no recent block must not be presented as evidence that a pool is offline.

For data integrations, use the [public API](api.md). For contributing, follow the [operator decision guide](operators.md).

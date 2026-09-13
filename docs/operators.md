# Considering XBT Pulse? An operator guide

**Making XBT mining decentralization visible.** XBT Pulse helps miners understand observed block production, template control and the evidence operators share. Public pools, private pools and individual DATUM gateway operators can participate.

Start at [Contribute](https://xbtpulse.tech/contribute). You can submit a profile before telemetry compatibility is established. You do not need to give XBT Pulse SSH access to your machines.

## Why participate?

- Publish a reviewed profile with your consent, describing your setup and sourced terms. Private pools can identify themselves as not accepting miners without publishing fees or connection details.
- Help miners find you in the searchable directory, even when you have no blocks in the current window.
- Earn Telemetry Contributor recognition through approved, recent positive reporting. A pool badge also requires a reviewed link between pool and provider.
- Request separate evidence-based decentralization and transparency assessments, each out of 100. Joining or reporting does not automatically earn a score.

Block-production ranks measure observed blocks, not quality or decentralization. Missing attribution does not prove a private pool has zero hashrate.

## What to submit first

1. Operator name, contact handle and official website if available.
2. Public/private status, software version and whether your build is modified.
3. Who constructs templates, which upstreams you use and which components you operate. Distinguish miners connecting over SV1 from the gateway's upstream protocol.
4. Endpoint-specific public fees and payout terms. Hosted gateway fees may differ from connecting your own gateway. Leave uncertain fields blank.
5. Publication choices. Save the private conversation link shown after submission to return for reviewer questions; replies are not emailed automatically.

Do not submit wallet keys, passwords, RPC credentials or tokens in setup notes. The reviewer may request sanitized evidence or metrics before recommending a collector.

## What installation involves

The compatible [DATUM collector and installation guide](https://xbtpulse.tech/collector) run on infrastructure you control. You review and install the package, configure local measurements and your privately issued provider token, and enable its reporting service. The guide includes a checksum and installation steps.

Reports contain interval timestamps, accepted share-difficulty aggregates, network difficulty and reported found-block counts. A wallet private key or remote shell access is not required. Review the package's local service/log access requirements. Reports travel over HTTPS using a bearer token; keep it in protected local configuration, outside screenshots and public repositories.

**Compatibility comes first.** Modified DATUM builds and RATUM/PRIME may expose different counters or difficulty units. A hashrate/worker dashboard API alone may be insufficient. The RATUM adapter is a compatibility preview, not the supported public DATUM download. Send a sanitized metrics sample and software details for review before installing an incompatible collector.

Maintain the reporting service and tell the reviewer about software/upstream changes. Gaps or stale reports can pause recognition. Token rotation invalidates the previous token; revocation stops new accepted reports but does not erase historical observations.

## What becomes public?

| Information | Visibility |
| --- | --- |
| Contact details, setup notes and conversation | Private review data |
| Name and onboarding status | Public when the applicable listing/publication consent permits it |
| Reviewed profile and sources | Public with profile consent |
| Accepted telemetry summaries and provider identity | Used in public reporting; agree the scope before starting |
| Draft scorecard and automated findings | Private until reviewed scorecard content is explicitly published |
| Published scorecard | Public scope, evidence, reviewer, dates and scores |
| Blockchain observations | Public observations, separate from participation |

Optional listing consent permits pending homepage visibility. Profile publication requires consent and review. Discuss public provider identity and evidence wording before sharing sensitive details. Participation does not make all operational details public, and does not make public-chain observations private.

## How assessments work

Decentralization examines template autonomy, common ownership, miner choice and upstream independence. Transparency examines reporting coverage, payout evidence, ownership disclosure and incident handling. See the [pilot scoring rules](https://xbtpulse.tech/scoring-rules) for weights and criteria.

Publication requires at least 30 calendar days of observation, current checks, a defined scope and evidence for every criterion. Unknown evidence stays unassessed; it is not silently assigned zero. A private operator can demonstrate template autonomy while remaining a single ownership group: these are separate criteria.

Automation checks reporting intervals and gathers dated public-source excerpts. It can prepare notes, but cannot establish truthful accounting, common ownership or independent template construction by itself. Authentication proves credential access, not complete transparency. Website claims remain claims until reviewed. Higher-tier badges remain proposed and are not automatically awarded.

## Ready to participate?

[Submit your operator details](https://xbtpulse.tech/contribute), save your conversation link and wait for scope and compatibility review before installing a collector. Use the conversation to ask questions, correct terms or provide evidence.

If you only want data for your own tool, use the [public read API](api.md). Public GET requests require neither a collector nor a provider token.

## Bring your own adapter

The bundled scraper is optional. An operator-controlled adapter may POST the [documented telemetry contract](telemetry.md) without vendoring this repository or changing a gateway's status page. The current DATUM v1.0.0 package expects a compatible status page, a systemd service and matching journal messages. Gateways using file logs, different HTML or another process supervisor need their own integration.

Before enabling an adapter, agree on:

- The provider's identity and exact measured scope: which gateway constructs templates, which upstream coordinates payouts and whether work is pool-built or miner-built.
- Authoritative cumulative accepted-work counters, their difficulty units, network-difficulty changes, and the meaning of the found-block counter.
- UTC interval boundaries, durable report IDs, retry behavior and handling of restarts, counter resets, gaps and duplicate work.
- A sanitized example payload and reconciliation against local counters. Skip uncertain intervals instead of inventing measurements.

Do not infer independent template control from public Stratum jobs or hashrate. If a port distributes pool-built jobs, report that scope honestly; DATUM/Prime-side measurements may be needed to assess the actual template builder. The current JSON contract measures aggregate work and outcomes; it does not itself certify template origin.

The published SHA256SUMS file checks archive integrity against the published digest. It is currently unsigned and does not authenticate the publisher through an independently trusted signing key. Signed releases with a stable, published key are not yet implemented; do not describe the package as signed.

The [adapter starter kit](https://xbtpulse.tech/adapter) now provides local validation and durable single-report delivery. Read its compatibility checklist before implementing your measurement layer. It is transport only, not a ready-made Lazarus or RATUM integration.

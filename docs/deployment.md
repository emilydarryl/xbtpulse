# Deploy and maintain xbtpulse.tech

## Current installation

The Hostinger VPS is `root@2.25.153.143`, with application files in `/opt/xbtpulse`. HTTPS serves https://xbtpulse.tech; www redirects to the apex. Source is delivered as a Git archive from the private repository, without a persistent GitHub credential on the VPS.

Use `docker compose -f compose.yaml -f deploy/compose.vps.yaml` for lifecycle commands. The override joins the existing Caddy network as `xbtpulse-web`. Data lives in `xbtpulse_pulse-data`; the app container is `xbtpulse-xbtpulse-1`. Existing Caddy configuration is `/opt/emilygaming-rt/Caddyfile`; XBT Pulse routes are recorded in `deploy/Caddyfile.vps.snippet`. Preserve other sites and services.

The live source is the public mempool.guide explorer. Provider onboarding, profile publication and assessments are stored in the database, not seeded automatically from source. The private mining pool is separate infrastructure.

## Updates

1. Validate the intended checkout with `npm test`, `npm run check`, and `python collector/package.py --check`. Changes to packaged collector files require regenerating the package and reviewing its checksum before committing.
2. Commit and push the intended revision to the private repository. Export that revision with `git archive --format=tar --output xbtpulse-release.tar HEAD`.
3. Transfer the archive to `/tmp` on the VPS and extract it into `/opt/xbtpulse`. Preserve the deployment's `.env`, data volume and unrelated services. Archives do not remove obsolete files: review deletions explicitly.
4. From `/opt/xbtpulse`, run `docker compose -f compose.yaml -f deploy/compose.vps.yaml up -d --build` for application changes. Documentation-only changes do not need a service rebuild.
5. Verify `/healthz`, `/readyz`, the public dashboard's source/freshness labels and changed routes. Check Compose logs if collection is delayed. Record the full deployed commit in `/opt/xbtpulse/DEPLOYED_COMMIT`.

Rollback uses an archive of the recorded prior revision and a rebuild, preserving the database. Check schema compatibility before rolling back across database changes. Do not run `down -v` during updates.

## Configuration and retention

Copy `.env.example` for a fresh installation and restrict `.env` to the deployment owner. RPC overrides explorer mode; use a dedicated fork-aware node if stronger source assurance is needed. Default collection is every 30 seconds, backfilling up to 24 blocks per cycle.

Block retention is 30,000 by default and in the VPS override. This is a block count, not a guarantee of 30 days. Dashboard windows remain 144, 576 and 2,016. Raw accepted telemetry is retained for 35 days; the public status-change feed retains up to 90 days. Assessment history predating collection cannot be reconstructed by enabling retention later. See [trends](trends.md) and [assessment checks](assessment-checks.md).

`ADMIN_ORIGIN` defaults to `https://xbtpulse.tech`. HTTPS is required for admin cookies. Keep provider tokens and secrets out of source, logs, screenshots and public artifacts.

## Backup and recovery

Back up the complete SQLite database securely using SQLite's backup API, or stop the app and copy its database and associated WAL files consistently. Copying only an active database file is not reliable. Verify backups can be restored before depending on them.

The database contains private applications, conversations, token hashes, administrator credentials, profiles, consent, telemetry, scorecard drafts/history, assessment findings and public change history. Blocks can be reindexed; these records generally cannot. Preserve deployment configuration separately and protect backups as private operational data.

## Fresh deployment and node access

Inspect existing ports and routing before starting services. The base Compose configuration binds to loopback; the VPS override supplies the existing proxy network. Merge the appropriate Caddy snippet without overwriting other sites. DNS must point to the server, and ports 80/443 must reach the proxy for HTTPS.

Keep RPC on a private reachable network, with an application-specific identity restricted to `getblockhash`, `getblockcount`, `getblock` and `getblockchaininfo` where supported. A container's loopback is not its host. Do not expose RPC publicly or repurpose private mining credentials.

Node-only attribution needs documented tag/fee-address rules. Provider mappings alone do not identify blocks. Explorer labels are separately disclosed third-party attribution. See [attribution](attribution.md).

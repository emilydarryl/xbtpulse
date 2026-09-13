# Deploy xbtpulse.tech on the existing VPS

## Current installation (2026-09-13)

Public HTTPS is active at https://xbtpulse.tech, with https://www.xbtpulse.tech redirecting to the apex. The Hostinger VPS is `root@2.25.153.143`; application files are in `/opt/xbtpulse`. Source was delivered from a Git archive of the private repository, not by installing a persistent GitHub credential on the VPS.

Use `docker compose -f compose.yaml -f deploy/compose.vps.yaml` in that directory for lifecycle commands. The override connects the app to the existing Caddy network with alias `xbtpulse-web`. Its database volume is `xbtpulse_pulse-data`; the private mining pool is not involved. Caddy's live configuration is `/opt/emilygaming-rt/Caddyfile`, with a pre-change backup alongside it. The two XBT Pulse routes are in `deploy/Caddyfile.vps.snippet`. Existing game app containers were left running; only the proxy was recreated to refresh a stale bind mount.

The live source is the public mempool.guide explorer. No node wallet or private pool credentials were transferred. Public health/readiness, 144-block accounting, the www redirect, and unauthenticated telemetry rejection were verified after deployment. Template providers still need onboarding.

## Deployment procedure

The app is separate from the user's private mining pool. Do not reuse that pool's node, database, credentials, ports, or service configuration. Inspect the existing web server before modifying routing.

1. Clone the private repository into `/opt/xbtpulse` using the VPS's authorized GitHub access. No repository credential belongs in source code or Compose.
2. Copy `.env.example` to `.env`, restrict it to the deployment owner (`chmod 600 .env`), and choose the chain source. Public explorer bootstrap works immediately; a dedicated node is preferable. Check that local port 4317 is available.
3. Run `docker compose up -d --build` from the checkout. The app is published only on `127.0.0.1:4317`; SQLite is stored in the `pulse-data` volume. Do not use `down -v` for normal updates.
4. Confirm `curl -f http://127.0.0.1:4317/healthz` and, after initial collection, `curl -f http://127.0.0.1:4317/readyz`. Read `docker compose logs --tail=50` if readiness fails. The UI must not advertise stale data as current.
5. Point the domain's apex A record at the VPS IPv4 address. Add AAAA only if the VPS has working routed IPv6. Remove conflicting stale records. A newly purchased domain may not resolve immediately.
6. If using host Caddy, merge `deploy/Caddyfile.snippet` into its current config, validate the config, and reload. Do not overwrite other sites. Caddy obtains HTTPS when DNS and ports 80/443 are reachable. If the existing proxy is containerized or uses Nginx, adapt its upstream to the isolated app instead of starting a competing proxy.
7. Verify https://xbtpulse.tech, its TLS certificate, `/healthz`, and live/sample labels. Check public `/api/telemetry` rejects unauthenticated POSTs.

## Updates and recovery

Run tests before updates. Record the deployed Git commit, pull the intended revision, then `docker compose up -d --build`. Roll back by checking out the recorded revision and rebuilding. Keep the persistent volume. Back up the SQLite database using SQLite's backup API or stop the app while copying the database together with WAL files; copying only an active database file is not a reliable backup. Source blocks are reindexable, telemetry is not.

## Node access

Keep RPC behind loopback or a private network and use an application-specific RPC identity restricted to `getblockhash`, `getblockcount`, `getblock`, and `getblockchaininfo` where the node supports RPC whitelisting. A container's loopback is not the host's loopback; configure a private reachable node address. Do not expose RPC to the Internet. Configure only endpoints controlled or explicitly selected by the operator; visitors cannot submit source URLs.

The empty local pool registry means a node-only installation initially labels pools unknown. Add documented tag/fee-address rules before expecting named pool attribution. Explorer mode supplies separately labeled third-party pool names.

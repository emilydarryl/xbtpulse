#!/bin/sh
set -eu

# For the inspected VPS reverse proxy only. Validate before changing live routing.
config=/opt/emilygaming-rt/Caddyfile
proxy=emilygaming-rt-caddy-1
snippet=/opt/xbtpulse/deploy/Caddyfile.vps.snippet
candidate=/opt/emilygaming-rt/Caddyfile.xbtpulse-candidate

if grep -q '^xbtpulse.tech {' "$config"; then
    echo 'XBT Pulse routing already present; no duplicate added.'
    exit 0
fi

cp "$config" "$candidate"
printf '\n' >> "$candidate"
cat "$snippet" >> "$candidate"
docker cp "$candidate" "$proxy:/tmp/xbtpulse-candidate.Caddyfile"
docker exec "$proxy" caddy validate --config /tmp/xbtpulse-candidate.Caddyfile --adapter caddyfile
backup="$config.before-xbtpulse-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$config" "$backup"
# Write in place: Caddy bind-mounts this file, so preserve its inode.
cat "$candidate" > "$config"
# An earlier deployment may have replaced the host file behind this bind mount.
# A normal reload would then read the stale inode. Recreate only the proxy if needed.
host_hash=$(sha256sum "$config" | cut -d ' ' -f 1)
mounted_hash=$(docker exec "$proxy" sha256sum /etc/caddy/Caddyfile | cut -d ' ' -f 1)
if [ "$host_hash" != "$mounted_hash" ]; then
    docker compose -f /opt/emilygaming-rt/compose.yml up -d --no-deps --force-recreate caddy
fi
if ! docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    cat "$backup" > "$config"
    docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    exit 1
fi
printf 'XBT Pulse route installed. Previous config: %s\n' "$backup"

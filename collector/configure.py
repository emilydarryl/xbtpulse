"""Interactive local configuration. Does not send data or change mining."""
import getpass
import json
import os
from pathlib import Path
from urllib.parse import urlparse

def main():
    os.umask(0o077)
    root = Path(__file__).resolve().parent
    target = root / 'config.json'
    if target.exists():
        raise SystemExit('config.json already exists. Edit it locally to avoid overwriting credentials.')
    gateway = input('Local DATUM status URL [http://127.0.0.1:7152/]: ').strip() or 'http://127.0.0.1:7152/'
    parsed = urlparse(gateway)
    if parsed.scheme not in ('http', 'https') or parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.username or parsed.password:
        raise SystemExit('Use the loopback status URL on this gateway host without credentials.')
    unit = input('Gateway systemd service name (example: datum-mainnet.service): ').strip()
    tag = input('Exact secondary/miner tag from the status page: ').strip()
    token = getpass.getpass('XBT Pulse provider token (hidden): ').strip()
    if not unit.endswith('.service') or unit.startswith('-') or not tag or not token:
        raise SystemExit('Service name, secondary tag and provider token are required.')
    target.write_text(json.dumps(dict(token=token, gateway=gateway, unit=unit, secondaryTag=tag), indent=2))
    target.chmod(0o600)
    print('Private config saved. Next: python3 check.py')

if __name__ == '__main__': main()

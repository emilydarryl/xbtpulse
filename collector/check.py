"""Read-only compatibility check: no uploads, no config changes."""
import json
import subprocess
from datum import read, snapshot

try:
    config = read('config.json', {})
    sample = snapshot(config)
    result = subprocess.run(['journalctl', '-u', config['unit'], '-n', '1', '-o', 'json', '--no-pager'], capture_output=True, text=True, timeout=10, check=True)
    lines = result.stdout.strip().splitlines()
    if not lines or not json.loads(lines[-1]).get('MESSAGE'):
        raise ValueError('No readable gateway journal entry')
    print('Status format, tag, process and journal checks passed. Nothing uploaded.')
    print('Confirm the service belongs to this status port, bdiff units match, and successful block submissions use the documented log format before enabling reports.')
except Exception as error:
    print('Compatibility check failed: '+type(error).__name__)
    print('Check the local URL, exact tag, service name, and journal/process read permissions. Do not enable reporting until resolved.')
    raise SystemExit(1)

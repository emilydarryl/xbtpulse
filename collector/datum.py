"""Read-only DATUM collector. Run once per minute on the gateway host.

Requires config.json in this directory (0600): token, gateway, unit, secondaryTag.
Only numeric interval aggregates are sent. No RPC credentials are needed.
"""
import json, os, re, subprocess, time, uuid, urllib.request
from pathlib import Path
from html import unescape

ROOT = Path(__file__).resolve().parent

def save(name, value):
    tmp = ROOT / (name + '.tmp')
    tmp.write_text(json.dumps(value))
    tmp.chmod(0o600)
    tmp.replace(ROOT / name)

def read(name, default):
    p = ROOT / name
    return json.loads(p.read_text()) if p.exists() else default

def rows(html):
    result = {}
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', html, re.S | re.I):
        cells = re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S | re.I)
        if len(cells) == 2:
            clean = lambda s: unescape(re.sub(r'<[^>]+>', '', s)).strip()
            result[clean(cells[0])] = clean(cells[1])
    return result

def snapshot(config):
    with urllib.request.urlopen(config['gateway'], timeout=10) as r:
        data = rows(r.read(1000000).decode())
    if data.get('Secondary/Miner Tag:', '').strip('"') != config['secondaryTag']:
        raise ValueError('Gateway identity changed')
    if 'Connected and Ready' not in data.get('Status:', ''):
        raise ValueError('Gateway disconnected')
    counter = re.fullmatch(r'\d+\s+\((\d+) diff\)', data['Local Shares Accepted:'])
    if not counter:
        raise ValueError('Counter format changed')
    pid = subprocess.check_output(['systemctl', 'show', config['unit'], '-p', 'MainPID', '--value'], text=True, timeout=10).strip()
    start = Path('/proc/' + pid + '/stat').read_text().split(') ')[1].split()[19]
    return {'time': int(time.time()*1000), 'work': int(counter[1]),
            'difficulty': float(data['Block Difficulty:']), 'bits': data['Bits:'],
            'height': int(data['Block Height:']),
            'process': Path('/proc/sys/kernel/random/boot_id').read_text().strip()+':'+pid+':'+start}

def block_events(config, start, end):
    # Scan with overlap, then filter exact timestamps. Unique hashes prevent
    # repeated submitblock success messages from inflating reported outcomes.
    raw = subprocess.check_output(['journalctl','-u',config['unit'],'--since', '@'+str(start//1000-2),
                                  '--until','@'+str(end//1000+1),'-o','json','--no-pager'], text=True, timeout=15)
    hashes = set()
    for line in raw.splitlines():
        entry = json.loads(line)
        stamp = int(entry['__REALTIME_TIMESTAMP'])/1000
        match = re.search(r'Block ([a-f0-9]{64}) submitted to upstream node successfully!', entry.get('MESSAGE',''))
        if match and start < stamp <= end:
            hashes.add(match[1])
    return hashes

def interval(previous, current, found):
    elapsed = current['time']-previous['time']
    if (not 10000 <= elapsed <= 900000 or previous['process'] != current['process']
        or previous['bits'] != current['bits'] or current['height'] < previous['height']
        or previous['height']//2016 != current['height']//2016
        or current['work'] < previous['work'] or current['difficulty'] <= 0):
        return None
    return {'id':str(uuid.uuid4()),'start':previous['time'],'end':current['time'],
            'found':found,'segments':[{'shareDifficultySum':current['work']-previous['work'],
                                     'networkDifficulty':current['difficulty']}]}

def post(config, path, data):
    request = urllib.request.Request('https://xbtpulse.tech'+path, data=json.dumps(data).encode(),
             headers={'Content-Type':'application/json','Authorization':'Bearer '+config['token']})
    with urllib.request.urlopen(request, timeout=15) as r:
        return json.load(r)

def run():
    import fcntl
    os.umask(0o077)
    with (ROOT/'lock').open('w') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return
        config = read('config.json', {})
        challenge = read('challenge.json', None)
        if challenge:
            post(config, '/api/telemetry/challenge', challenge)
            (ROOT/'challenge.json').unlink()
        state = read('state.json', {})
        if state.get('pending'):
            post(config, '/api/telemetry', state['pending'])
            state.pop('pending')
            save('state.json',state)
        current = snapshot(config)
        previous = state.get('last')
        status = 'Baseline saved; waiting for next real interval'
        if previous:
            seen = set(state.get('seen', []))
            hashes = block_events(config, previous['time'], current['time'])
            report = interval(previous, current, len(hashes-seen))
            state['seen'] = list(seen | hashes)[-10000:]
            if report:
                state.update(last=current,pending=report)
                save('state.json',state)  # persist before sending for safe retries
                post(config, '/api/telemetry', report)
                state.pop('pending')
                status = 'Measured interval accepted'
            else:
                status = 'Skipped uncertain interval; new baseline saved'
        state['last'] = current
        save('state.json',state)
        save('status.json',{'time':int(time.time()*1000),'status':status})

if __name__ == '__main__':
    try: run()
    except Exception as error:
        # Avoid logging request headers, credentials or private host details.
        save('status.json',{'time':int(time.time()*1000),'status':'Reporting failed; retry on next run','errorType':type(error).__name__})
        raise SystemExit(1)

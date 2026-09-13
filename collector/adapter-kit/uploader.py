"""XBT Pulse adapter transport, AGPL-3.0-or-later. No gateway access or sampling.
Linux/Python 3.9+. Validate locally; explicitly submit genuine measured intervals.
"""
import argparse
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import time
import urllib.error
import urllib.request

ENDPOINT = 'https://xbtpulse.tech/api/telemetry'
MAX_BYTES = 32768


def encode(body):
    return json.dumps(body, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def validate(body, now=None):
    now = int(time.time()*1000) if now is None else now
    if not isinstance(body, dict) or set(body) != {'id','start','end','found','segments'}:
        raise ValueError('Use only id, start, end, found and segments')
    if not isinstance(body['id'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', body['id']):
        raise ValueError('Invalid report ID')
    start, end, found = body['start'], body['end'], body['found']
    if any(type(n) is not int for n in (start,end,found)):
        raise ValueError('Timestamps and found must be integers')
    if not (0 < end-start <= 900000 and end <= now+30000 and start >= now-7*86400000):
        raise ValueError('Interval must be recent, ordered, and at most 15 minutes')
    if not 0 <= found <= 10000:
        raise ValueError('Invalid found count')
    segments = body['segments']
    if not isinstance(segments,list) or not 1 <= len(segments) <= 100:
        raise ValueError('Require 1 to 100 work segments')
    expected = work = 0
    for segment in segments:
        if not isinstance(segment,dict) or set(segment) != {'shareDifficultySum','networkDifficulty'}:
            raise ValueError('Invalid segment fields')
        w, d = segment['shareDifficultySum'], segment['networkDifficulty']
        if any(type(n) not in (int,float) or not math.isfinite(n) for n in (w,d)):
            raise ValueError('Difficulty values must be finite numbers')
        if not 0 <= w <= 1e30 or not 0 < d <= 1e30:
            raise ValueError('Difficulty values out of range')
        work += w
        expected += w/d
    if not math.isfinite(expected) or expected > 1e9 or not math.isfinite(work):
        raise ValueError('Aggregate out of range')
    if found and not work:
        raise ValueError('Found blocks with no measured work require investigation')
    if len(encode(body)) > MAX_BYTES:
        raise ValueError('Report too large')
    return body


def read_report(path):
    with Path(path).open('rb') as f:
        raw = f.read(MAX_BYTES+1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Report too large')
    def unique(pairs):
        out = {}
        for k,v in pairs:
            if k in out: raise ValueError('Duplicate JSON key')
            out[k] = v
        return out
    return json.loads(raw, object_pairs_hook=unique)


def save(path, body):
    temp = path.with_suffix('.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd,'wb') as f:
        f.write(encode(body)); f.flush(); os.fsync(f.fileno())
    os.replace(temp,path)
    if os.name == 'posix':
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)


@contextlib.contextmanager
def locked(directory):
    import fcntl
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if directory.is_symlink() or directory.stat().st_uid != os.getuid() or stat.S_IMODE(directory.stat().st_mode) & 0o077:
        raise ValueError('State directory must be owned by you and mode 0700')
    fd = os.open(directory/'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd,'w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def token_from(path):
    p = Path(path)
    if p.is_symlink() or p.stat().st_uid != os.getuid() or stat.S_IMODE(p.stat().st_mode) & 0o077:
        raise ValueError('Token file must be owned by you and mode 0600 or stricter')
    token = p.read_text().strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token):
        raise ValueError('Invalid provider token file')
    return token


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def post(payload, token):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    req = urllib.request.Request(ENDPOINT, data=encode(payload), headers={
        'Content-Type':'application/json','Authorization':'Bearer '+token})
    with opener.open(req,timeout=20) as r:
        result = json.loads(r.read(MAX_BYTES))
        if r.status != 200 or result.get('accepted') is not True:
            raise ValueError('Unexpected acknowledgment; preserve pending report')


def process(directory, incoming=None, token_loader=None, send=post, now=None, resume=False):
    """Caller must hold the state lock. Persist report before any network operation."""
    now = int(time.time()*1000) if now is None else now
    path = directory/'state.json'
    state = json.loads(path.read_text()) if path.exists() else {}
    pending = state.get('pending')
    if incoming is not None:
        validate(incoming,now)
        digest = hashlib.sha256(encode(incoming)).hexdigest()
        if pending and encode(incoming) != encode(pending):
            raise ValueError('Another report is pending; retry it first')
        if not pending:
            last = state.get('lastAccepted')
            if last and digest == last['digest']: return 'Already acknowledged; nothing sent'
            if last and (incoming['id'] == last['id'] or incoming['start'] < last['end']):
                raise ValueError('Report reuses an ID or overlaps acknowledged work')
            state.update(pending=incoming, attempts=0, nextRetry=0, blocked=False)
            save(path,state)
            pending = incoming
    if not pending: return 'No pending report'
    validate(pending,now)  # Never refresh timestamps to rescue expired work.
    if state.get('blocked') and not resume: return 'Paused; fix the cause, then retry --resume'
    if now < state.get('nextRetry',0) and not resume: return 'Waiting for retry backoff'
    token = token_loader()  # Not stored in state or printed.
    try:
        send(pending,token)
    except Exception as error:
        code = error.code if isinstance(error,urllib.error.HTTPError) else None
        state['attempts'] = state.get('attempts',0)+1
        state['blocked'] = code is not None and code not in (408,429) and code < 500
        delay = min(1800,30*2**min(state['attempts']-1,6))
        if code == 429:
            hint = error.headers.get('Retry-After','') if error.headers else ''
            if hint.isdigit(): delay = max(delay,min(int(hint),86400))
        if isinstance(error,urllib.error.HTTPError): error.close()
        state['nextRetry'] = now+delay*1000
        state['lastError'] = 'HTTP '+str(code) if code else 'Transport or acknowledgment failure'
        save(path,state)
        return 'Paused; review HTTP status' if state['blocked'] else 'Pending saved; retry after backoff'
    state = {'lastAccepted':{'id':pending['id'],'end':pending['end'],
                            'digest':hashlib.sha256(encode(pending)).hexdigest()}}
    save(path,state)
    return 'Accepted'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['validate','submit','retry'])
    parser.add_argument('report',nargs='?')
    parser.add_argument('--state-dir',default='./adapter-state')
    parser.add_argument('--token-file')
    parser.add_argument('--resume',action='store_true',help='Explicitly retry after correcting a paused report/token')
    args = parser.parse_args()
    if args.command in ('validate','submit') and not args.report: parser.error('Report path required')
    if args.command == 'retry' and args.report: parser.error('Retry uses the saved report, not an input file')
    report = read_report(args.report) if args.report else None
    if args.command == 'validate':
        validate(report); print('Locally valid structure and bounds; nothing uploaded. Measurement truth is not verified.'); return
    if os.name != 'posix': parser.error('Upload/state locking requires Linux; local validation also works on Windows')
    if not args.token_file: parser.error('--token-file required for upload')
    os.umask(0o077)
    directory = Path(args.state_dir).absolute()
    with locked(directory):
        result = process(directory,report,lambda:token_from(args.token_file),resume=args.resume)
    print(result)
    if result not in ('Accepted','Already acknowledged; nothing sent','No pending report'): raise SystemExit(1)


if __name__ == '__main__':
    try: main()
    except (ValueError,OSError,TypeError,KeyError,OverflowError):
        print('Stopped: check input, private file permissions, pending state and credentials. No secrets logged.')
        raise SystemExit(1)

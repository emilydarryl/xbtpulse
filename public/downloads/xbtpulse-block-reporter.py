"""Optional XBT Pulse block-report sender. AGPL-3.0-or-later.

Validate a saved event by default. --submit sends it with an existing provider
token. The input file is never changed: keep it for identical, safe retries.
This does not discover blocks or parse mining logs.
"""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import urllib.error
import urllib.request

ENDPOINT = 'https://xbtpulse.tech/api/block-reports'


def validate(body):
    if (not isinstance(body, dict) or set(body) - {'hash', 'height', 'action'}
            or not isinstance(body.get('hash'), str)
            or not re.fullmatch(r'[a-fA-F0-9]{64}', body['hash'])
            or type(body.get('height')) is not int
            or not 961640 <= body['height'] <= 100000000
            or body.get('action', 'report') not in ('report', 'withdraw')):
        raise ValueError('Use a real block hash and integer XBT height; action is report or withdraw.')
    return dict(hash=body['hash'].lower(), height=body['height'], action=body.get('action', 'report'))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def submit(body, token_file):
    token_path = Path(token_file)
    if os.name == 'posix' and stat.S_IMODE(token_path.stat().st_mode) & 0o077:
        raise ValueError('Keep the token file private: chmod 600 your-token-file.')
    token = token_path.read_text().strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,512}', token):
        raise ValueError('The token file does not contain a valid provider token.')
    request = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(), method='POST',
                                     headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=20) as response:
            result = json.loads(response.read(32769))
            if (response.status not in (200, 201) or not isinstance(result, dict) or result.get('accepted') is not True
                    or result.get('hash') != body['hash'] or result.get('action') != body['action']):
                raise ValueError('Unclear acknowledgment. Keep the file and retry the same report.')
    except urllib.error.HTTPError as error:
        if error.code == 429:
            raise ValueError('HTTP 429: keep the report and wait one hour before retrying.') from None
        if error.code >= 500:
            raise ValueError('Server unavailable: keep the report and retry after at least one minute.') from None
        raise ValueError('HTTP ' + str(error.code) + ': check the token, profile approval and report before retrying.') from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise ValueError('No acknowledgment: keep the report and retry the same file after at least one minute.') from None
    print('Report acknowledged. ' + ('Withdrawn from the public list.' if body['action'] == 'withdraw'
                                  else 'The profile shows the separate chain check.'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', help='Saved JSON event with height and hash')
    parser.add_argument('--submit', action='store_true', help='Send the report; otherwise validate locally')
    parser.add_argument('--token-file', help='Existing private provider token file (required with --submit)')
    args = parser.parse_args()
    if args.submit and not args.token_file:
        parser.error('--submit requires --token-file')
    try:
        raw = Path(args.report).read_bytes()
        if len(raw) > 4096:
            raise ValueError('The report must be no larger than 4096 bytes.')
        body = validate(json.loads(raw))
        if args.submit:
            submit(body, args.token_file)
        else:
            print('Local format check passed. Nothing uploaded; this does not verify the block or finder.')
        return 0
    except (ValueError, OSError):
        # Avoid printing credential contents or remote response bodies.
        import sys
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError)
              else 'Unable to read or process the report/token file.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

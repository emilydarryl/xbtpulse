"""Loopback-only, authenticated node reads. No wallet or broadcast RPCs.

Run on the gateway VM. The VPS receives only this proxy's capability, never
the upstream node password. Requests always target the fixed node root path.
"""
import base64
import hmac
import json
import pathlib
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOWED = frozenset({
    'getblockchaininfo', 'getnetworkinfo', 'getblockhash', 'getblockheader',
    'getbestblockhash', 'getblock', 'getindexinfo', 'getpeerinfo',
    'getrawtransaction', 'getrawmempool', 'getmempoolinfo', 'getmempoolentry',
    'getmempoolancestors', 'getmempooldescendants', 'gettxout',
    'estimatesmartfee', 'estimatefee', 'getdeploymentinfo', 'getchaintips',
    'uptime', 'getblockstats', 'gettxoutproof', 'getzmqnotifications',
})
MAX_REQUEST = 65536
MAX_RESPONSE = 32 * 1024 * 1024

def allowed_call(call):
    return (isinstance(call, dict) and isinstance(call.get('method'), str) and call.get('method') in ALLOWED
            and isinstance(call.get('params', []), (list, dict)))

class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8
    def __init__(self, address, capability, upstream_url, upstream_auth):
        super().__init__(address, Handler)
        self.capability = capability
        self.upstream_url = upstream_url
        self.upstream_auth = upstream_auth
        self.slots = threading.BoundedSemaphore(4)

class Handler(BaseHTTPRequestHandler):
    server_version = 'PulseReadProxy'
    sys_version = ''

    def log_message(self, *_):
        pass  # Never log request bodies, credentials, addresses or descriptors.

    def respond(self, status, data):
        raw = json.dumps(data, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if self.path != '/' or self.headers.get('Transfer-Encoding'):
            return self.respond(400, {'error': 'Invalid request'})
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), self.server.capability.encode()):
            return self.respond(401, {'error': 'Authentication required'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.respond(400, {'error': 'Invalid length'})
        if not 0 < size <= MAX_REQUEST:
            return self.respond(413, {'error': 'Request too large'})
        if not self.server.slots.acquire(blocking=False):
            return self.respond(503, {'error': 'Busy'})
        try:
            self.connection.settimeout(30)
            try:
                payload = json.loads(self.rfile.read(size))
            except (ValueError, TimeoutError):
                return self.respond(400, {'error': 'Invalid JSON'})
            batch = isinstance(payload, list)
            calls = payload if batch else [payload]
            if not 0 < len(calls) <= 32:
                return self.respond(400, {'error': 'Invalid batch'})
            responses = []
            for call in calls:
                call_id = call.get('id') if isinstance(call, dict) else None
                if not allowed_call(call):
                    responses.append({'result': None, 'error': {'code': -32601, 'message': 'Method unavailable on read-only endpoint'}, 'id': call_id})
                    continue
                body = json.dumps({'jsonrpc': '1.0', 'method': call['method'], 'params': call.get('params', []), 'id': call_id}).encode()
                request = urllib.request.Request(self.server.upstream_url, body, {'Authorization': self.server.upstream_auth, 'Content-Type': 'application/json'})
                try:
                    try:
                        response = urllib.request.urlopen(request, timeout=25)
                    except urllib.error.HTTPError as error:
                        response = error
                    with response:
                        raw = response.read(MAX_RESPONSE + 1)
                    if len(raw) > MAX_RESPONSE:
                        raise ValueError('Response too large')
                    data = json.loads(raw)
                    # Only forward structured RPC responses; never raw upstream errors.
                    responses.append({'result': data.get('result'), 'error': data.get('error'), 'id': call_id})
                except Exception:
                    responses.append({'result': None, 'error': {'code': -32000, 'message': 'Node unavailable'}, 'id': call_id})
            self.respond(200, responses if batch else responses[0])
        finally:
            self.server.slots.release()

if __name__ == '__main__':
    private = json.loads(pathlib.Path(sys.argv[1]).read_text())
    cfg = json.loads(pathlib.Path(private['gateway_config']).read_text())['bitcoind']
    url = urllib.parse.urlsplit(cfg['rpcurl'])
    if url.scheme != 'http' or url.hostname != private['node_host'] or url.port != private['node_port']:
        raise SystemExit('Unexpected node endpoint')
    username = cfg.get('rpcuser', cfg.get('rpcusername', url.username or ''))
    password = cfg.get('rpcpassword', cfg.get('rpcpass', url.password or ''))
    if not username or not password:
        raise SystemExit('Missing upstream authentication')
    auth = lambda user, secret: 'Basic ' + base64.b64encode((user + ':' + secret).encode()).decode()
    Server(('127.0.0.1', 18331), auth('pulse-read', private['capability']),
           'http://' + url.hostname + ':' + str(url.port) + '/', auth(username, password)).serve_forever()

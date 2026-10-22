"""Verify forbidden calls never reach the node, including mixed RPC batches."""
import base64
import importlib.util
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('proxy', Path(__file__).with_name('node-read-proxy.py'))
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)

class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.seen = []
        seen = self.seen
        class Node(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_POST(self):
                call = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                seen.append((self.path, call, self.headers['Authorization']))
                raw = json.dumps({'result': {'chain': 'main'}, 'error': None, 'id': call['id']}).encode()
                self.send_response(200)
                self.end_headers()
                self.wfile.write(raw)
        self.node = ThreadingHTTPServer(('127.0.0.1', 0), Node)
        self.capability = 'Basic ' + base64.b64encode(b'pulse-read:test-capability').decode()
        self.server = proxy.Server(('127.0.0.1', 0), self.capability, 'http://127.0.0.1:' + str(self.node.server_port) + '/', 'Basic upstream-secret')
        for server in [self.node, self.server]:
            threading.Thread(target=server.serve_forever, daemon=True).start()

    def tearDown(self):
        for server in [self.server, self.node]:
            server.shutdown()
            server.server_close()

    def request(self, payload, auth=None, path='/'):
        request = urllib.request.Request('http://127.0.0.1:' + str(self.server.server_port) + path, json.dumps(payload).encode(), {'Authorization': auth or self.capability})
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)

    def test_auth_and_root_path(self):
        for auth, path, expected in [('wrong', '/', 401), (self.capability, '/wallet/xbtpulse', 400)]:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request({'method': 'getblockchaininfo'}, auth, path)
            self.assertEqual(error.exception.code, expected)
        self.assertEqual(self.seen, [])

    def test_mixed_batch_blocks_spending_and_secret_access(self):
        forbidden = ['sendrawtransaction', 'walletpassphrase', 'listdescriptors', 'dumpprivkey', 'createwallet', 'importdescriptors', 'loadwallet', 'stop', 'signrawtransactionwithwallet']
        calls = [{'id': i, 'method': method, 'params': []} for i, method in enumerate(forbidden)]
        calls.append({'id': 99, 'method': 'getblockchaininfo', 'params': []})
        results = self.request(calls)
        self.assertTrue(all(item['error']['code'] == -32601 for item in results[:-1]))
        self.assertEqual(results[-1]['result'], {'chain': 'main'})
        self.assertEqual(len(self.seen), 1)
        self.assertEqual(self.seen[0][0], '/')
        self.assertEqual(self.seen[0][2], 'Basic upstream-secret')

    def test_malformed_and_overlarge_batches(self):
        for call in [{'id': 1, 'method': 'getblockchaininfo', 'params': 'invalid'}, {'method': []}]:
            result = self.request(call)
            self.assertEqual(result['error']['code'], -32601)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request({'method': 'getblockchaininfo', 'params': ['x' * proxy.MAX_REQUEST]})
        self.assertEqual(error.exception.code, 413)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request([{'method': 'getblockchaininfo'}] * 33)
        self.assertEqual(error.exception.code, 400)
        self.assertEqual(self.seen, [])

if __name__ == '__main__':
    unittest.main()

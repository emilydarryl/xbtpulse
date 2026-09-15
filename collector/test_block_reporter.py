import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('block_reporter', Path(__file__).resolve().parents[1] / 'public/downloads/xbtpulse-block-reporter.py')
reporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reporter)


class SenderTests(unittest.TestCase):
    def test_default_mode_is_local_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'event.json'
            path.write_text(json.dumps(dict(hash='a' * 64, height=972232)))
            with patch('sys.argv', ['sender', str(path)]), patch('sys.stdout', new_callable=io.StringIO) as output, patch.object(reporter.urllib.request, 'build_opener') as opener:
                self.assertEqual(reporter.main(), 0)
                opener.assert_not_called()
                self.assertIn('Nothing uploaded', output.getvalue())

    def test_validation_and_redirects(self):
        body = dict(hash='a' * 64, height=972232)
        self.assertEqual(reporter.validate(body)['action'], 'report')
        for invalid in [dict(body, height=True), dict(body, token='secret'), dict(body, hash='url'), dict(body, height='972232')]:
            with self.assertRaises(ValueError):
                reporter.validate(invalid)
        self.assertIsNone(reporter.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid'))

    def test_submission_acknowledgment_and_failures(self):
        body = reporter.validate(dict(hash='a' * 64, height=972232))
        with tempfile.TemporaryDirectory() as directory:
            token_file = Path(directory) / 'token.txt'
            token_file.write_text('synthetic-test-token')
            token_file.chmod(0o600)
            with patch.object(reporter.urllib.request, 'build_opener') as build, patch('sys.stdout', new_callable=io.StringIO) as output:
                response = build.return_value.open.return_value.__enter__.return_value
                response.status = 201
                response.read.return_value = json.dumps(dict(accepted=True, hash=body['hash'], action='report')).encode()
                reporter.submit(body, token_file)
                self.assertIn('acknowledged', output.getvalue())
                request = build.return_value.open.call_args.args[0]
                self.assertEqual(request.full_url, reporter.ENDPOINT)
                self.assertNotIn('synthetic-test-token', output.getvalue())
                response.read.return_value = b'{}'
                with self.assertRaisesRegex(ValueError, 'Unclear acknowledgment'):
                    reporter.submit(body, token_file)
                build.return_value.open.side_effect = urllib.error.HTTPError(reporter.ENDPOINT, 429, 'slow', {}, None)
                with self.assertRaisesRegex(ValueError, 'one hour'):
                    reporter.submit(body, token_file)
                self.assertEqual(token_file.read_text(), 'synthetic-test-token')


if __name__ == '__main__':
    unittest.main()

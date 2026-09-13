import os
from unittest.mock import patch
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error
from uploader import validate, process, encode, NoRedirect, read_report, locked, token_from, save

NOW=1800000000000

def report():
    return dict(id='measured-interval-1',start=NOW-120000,end=NOW-60000,found=0,
                segments=[dict(shareDifficultySum=123,networkDifficulty=1000)])

class TransportTests(unittest.TestCase):
    def test_validation_rejects_unsafe_and_uncertain_inputs(self):
        validate(report(),NOW)
        for change in [dict(found=True),dict(start=NOW),dict(end=NOW+31000),
                       dict(start=NOW-8*86400000),dict(token='private'),dict(found=1,segments=[dict(shareDifficultySum=0,networkDifficulty=1)])]:
            with self.assertRaises(ValueError): validate({**report(),**change},NOW)
        for value in [float('nan'),float('inf'),-1,True]:
            b=report();b['segments'][0]['networkDifficulty']=value
            with self.assertRaises(ValueError):validate(b,NOW)
    def test_duplicate_json_keys_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'report';p.write_text('{"id":"a","id":"b"}')
            with self.assertRaises(ValueError):read_report(p)
    def test_durable_identical_retry_and_acknowledgment(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);sent=[]
            def fail(b,t):
                self.assertEqual(json.loads((p/'state.json').read_text())['pending'],b)
                sent.append(encode(b));raise OSError('do not log token')
            result=process(p,report(),lambda:'secret',fail,NOW)
            self.assertIn('Pending',result)
            self.assertNotIn('secret',(p/'state.json').read_text())
            self.assertIn('backoff',process(p,None,lambda:'secret',fail,NOW+1000))
            def success(b,t):sent.append(encode(b))
            self.assertEqual(process(p,None,lambda:'secret',success,NOW+30000),'Accepted')
            self.assertEqual(sent[0],sent[1]);self.assertEqual(len(sent),2)
            self.assertNotIn('pending',json.loads((p/'state.json').read_text()))
            self.assertIn('Already',process(p,report(),lambda:'secret',success,NOW+31000))
            conflict=report();conflict['segments'][0]['shareDifficultySum']=9
            with self.assertRaises(ValueError):process(p,conflict,lambda:'secret',success,NOW+32000)
    def test_pending_cannot_be_replaced_or_retimed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            def fail(b,t):raise OSError()
            process(p,report(),lambda:'secret',fail,NOW)
            other=report();other['id']='new'
            with self.assertRaises(ValueError):process(p,other,lambda:'secret',fail,NOW)
            with self.assertRaises(ValueError):process(p,None,lambda:'secret',fail,NOW+8*86400000)
            self.assertEqual(json.loads((p/'state.json').read_text())['pending'],report())
    def test_authorization_failure_pauses_until_explicit_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            def deny(b,t):raise urllib.error.HTTPError('https://xbtpulse.tech',401,'unauthorized',{},None)
            self.assertIn('Paused',process(p,report(),lambda:'secret',deny,NOW))
            self.assertIn('Paused',process(p,None,lambda:'secret',deny,NOW+60000))
            self.assertEqual(process(p,None,lambda:'replacement',lambda b,t:None,NOW+60000,resume=True),'Accepted')
    def test_rate_limit_honors_retry_after(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            def limit(b,t):raise urllib.error.HTTPError('https://xbtpulse.tech',429,'limited',{'Retry-After':'120'},None)
            process(p,report(),lambda:'secret',limit,NOW)
            self.assertEqual(json.loads((p/'state.json').read_text())['nextRetry'],NOW+120000)
    @unittest.skipUnless(os.name == 'posix','Linux file locking and permissions')
    def test_lock_and_private_permissions(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'state'
            with locked(p):
                with self.assertRaises(BlockingIOError):
                    with locked(p): pass
                save(p/'state.json',{'pending':report()})
                self.assertEqual((p/'state.json').stat().st_mode & 0o777,0o600)
            token=Path(tmp)/'token';token.write_text('a'*64);token.chmod(0o600)
            self.assertEqual(token_from(token),'a'*64)
            token.chmod(0o644)
            with self.assertRaises(ValueError):token_from(token)
            p.chmod(0o755)
            with self.assertRaises(ValueError):
                with locked(p):pass
    def test_crash_after_remote_acceptance_preserves_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);sent=[]
            def persist(path,state):
                if 'lastAccepted' in state:raise OSError('simulated disk failure after acknowledgment')
                save(path,state)
            with patch('uploader.save',side_effect=persist):
                with self.assertRaises(OSError):
                    process(p,report(),lambda:'secret',lambda b,t:sent.append(encode(b)),NOW)
            self.assertIn('pending',json.loads((p/'state.json').read_text()))
            self.assertEqual(process(p,None,lambda:'secret',lambda b,t:sent.append(encode(b)),NOW+1000),'Accepted')
            self.assertEqual(sent[0],sent[1])
    def test_redirects_disabled(self):
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'',{},'https://elsewhere.example'))

if __name__=='__main__':unittest.main()

import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import ratum
from ratum import normalize,interval

class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.config=dict(expectedBuild='0.1.22-test',expectedPubkey='test-public-key')
        self.data=dict(pool=dict(version='0.1.22-test',pubkey='test-public-key'),generated_at=1000,network=dict(chain='main',tip_height=970000,difficulty=100),xbtpulse=dict(schema=1,cumulative_share_difficulty='1000',blocks_found=4))
    def test_stock_api_is_rejected(self):
        self.data.pop('xbtpulse');self.data['window']={'work':'99999'};self.data['hashrate']={'pool_hs':1e20}
        with self.assertRaises(ValueError):normalize(self.data,self.config,1000000)
    def test_identity_and_staleness(self):
        with self.assertRaises(ValueError):normalize(self.data,self.config,2000000)
        self.data['pool']['version']='other'
        with self.assertRaises(ValueError):normalize(self.data,self.config,1000000)
    def test_prime_cumulative_ignores_mutable_block_history(self):
        self.config['counterSource']='prime-cumulative'
        self.data.pop('xbtpulse')
        self.data['cumulative_accepted_work']=str(2**80)
        self.data['blocks']={'found':12}
        a=normalize(self.data,self.config,1000000);a['process']='same'
        self.data['cumulative_accepted_work']=str(2**80+123)
        self.data['generated_at']=1060
        self.data['blocks']['found']=11
        b=normalize(self.data,self.config,1060000);b['process']='same'
        report=interval(a,b)
        self.assertEqual(report['segments'][0]['shareDifficultySum'],123)
        self.assertIsNone(report['found'])
        for change in [dict(work=0),dict(process='restart'),dict(difficulty=101),dict(counterSource='xbtpulse-v1'),dict(work=a['work']+2**53)]:
            self.assertIsNone(interval(a,dict(b,**change)))
        for raw in [str(2**128),'-1',123,'1.5',None]:
            self.data['cumulative_accepted_work']=raw
            with self.assertRaises(ValueError):normalize(self.data,self.config,1060000)
    def test_setup_pins_identity_locally_and_refuses_overwrite(self):
        data=dict(self.data,cumulative_accepted_work='1234')
        args=SimpleNamespace(stats_url='http://127.0.0.1:1234/stats.json',unit='prime.service',pid_file=None)
        with tempfile.TemporaryDirectory() as folder, patch.object(ratum,'ROOT',Path(folder)), patch.object(ratum,'read_stats',return_value=data), patch.object(ratum,'snapshot') as snap, patch.object(ratum,'post') as post:
            ratum.setup(args)
            config=ratum.json.loads((Path(folder)/'config.json').read_text())
            self.assertEqual(config['counterSource'],'prime-cumulative')
            self.assertEqual(config['expectedBuild'],self.data['pool']['version'])
            self.assertNotIn('token',config)
            snap.assert_called_once()
            post.assert_not_called()
            with self.assertRaises(ValueError):ratum.setup(args)
    def test_check_never_posts_or_changes_reporting_state(self):
        a=dict(time=1000000,work=100,found=None,difficulty=100,height=970000,build='test',pool='test',process='same',counterSource='prime-cumulative')
        b=dict(a,time=1010000,work=200)
        with tempfile.TemporaryDirectory() as folder, patch.object(ratum,'ROOT',Path(folder)), patch.dict('sys.modules',{'fcntl':SimpleNamespace()}), patch.object(ratum,'snapshot',side_effect=[a,b]), patch.object(ratum.time,'sleep'), patch.object(ratum,'post') as post:
            (Path(folder)/'config.json').write_text('{}')
            (Path(folder)/'state.json').write_text('{"pending":{"id":"keep"}}')
            ratum.run(check=True)
            post.assert_not_called()
            self.assertEqual((Path(folder)/'state.json').read_text(),'{"pending":{"id":"keep"}}')
    def test_default_cli_is_check_and_process_race_fails_closed(self):
        with patch('sys.argv',['ratum.py']), patch.object(ratum,'run') as run:
            self.assertEqual(ratum.main(),0)
            run.assert_called_once_with(check=True)
        with patch.object(ratum,'process_identity',side_effect=['before','after']), patch.object(ratum,'read_stats',return_value=self.data), patch.object(ratum.time,'time',return_value=1000):
            with self.assertRaises(ValueError):ratum.snapshot(self.config)
    def test_redirects_and_remote_stats_are_refused(self):
        with self.assertRaises(ValueError):ratum.NoRedirect().redirect_request(None,None,None,None,None,None)
        for url in ['https://example.com/stats.json','http://user:pass@127.0.0.1/stats.json']:
            with self.assertRaises(ValueError):ratum.read_stats({'statsUrl':url})
    def test_exact_deltas_and_reset_guards(self):
        a=normalize(self.data,self.config,1000000);a['process']='same'
        b=dict(a,time=1060000,work=1300,found=5)
        r=interval(a,b);self.assertEqual(r['segments'][0]['shareDifficultySum'],300);self.assertEqual(r['found'],1)
        for change in [dict(work=1),dict(found=1),dict(process='restart'),dict(difficulty=101),dict(time=3000000),dict(height=969999)]:
            self.assertIsNone(interval(a,dict(b,**change)))

if __name__=='__main__':unittest.main()

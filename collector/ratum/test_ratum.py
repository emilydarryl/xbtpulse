import unittest
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
    def test_exact_deltas_and_reset_guards(self):
        a=normalize(self.data,self.config,1000000);a['process']='same'
        b=dict(a,time=1060000,work=1300,found=5)
        r=interval(a,b);self.assertEqual(r['segments'][0]['shareDifficultySum'],300);self.assertEqual(r['found'],1)
        for change in [dict(work=1),dict(found=1),dict(process='restart'),dict(difficulty=101),dict(time=3000000),dict(height=969999)]:
            self.assertIsNone(interval(a,dict(b,**change)))

if __name__=='__main__':unittest.main()

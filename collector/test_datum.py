import unittest
from datum import rows, interval

class CollectorTests(unittest.TestCase):
    def test_html_counter(self):
        self.assertEqual(rows('<tr><td class="label">Local Shares Accepted:</td><td>4 (128 diff)</td></tr>')['Local Shares Accepted:'], '4 (128 diff)')
    def test_real_deltas_and_reset_boundaries(self):
        a=dict(time=100000,work=100,difficulty=10,bits='abcd',height=100,process='same')
        b=dict(a,time=160000,work=140)
        self.assertEqual(interval(a,b,0)['segments'][0]['shareDifficultySum'],40)
        for changes in [dict(work=99),dict(bits='other'),dict(process='new'),dict(time=2000000),dict(height=99),dict(height=2016)]:
            self.assertIsNone(interval(a,dict(b,**changes),0))

if __name__ == '__main__': unittest.main()

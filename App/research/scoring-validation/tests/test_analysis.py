import contextlib,io,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
with contextlib.redirect_stdout(io.StringIO()):
 import analyze as a
class TestScoreModel(unittest.TestCase):
 def row(self,i,h=1,c=10,p=5,field='Law',provider='OpenAlex'):
  r={'row':str(i),'stage':'Mid-career','rank':'Senior Lecturer','field':field,'verified':True,'institution':'test'}
  for m,v in zip(a.M,(h,c,p)):r[m]=v;r[m+'Provider']=provider
  return r
 def test_ties_and_inclusion(self):
  rows=[self.row(i) for i in range(10)];res=a.evaluate(rows)
  self.assertEqual(len(res),10);self.assertTrue(all(x['score']==50 for x in res.values()))
 def test_missing_and_recorded_zero(self):
  rows=[self.row(i,i,10*i,5*i) for i in range(10)];rows[0]['recentCitations']=None
  res=a.evaluate(rows);self.assertEqual(res['0']['parts'][0],5);self.assertIsNone(res['0']['parts'][1]);self.assertEqual(res['0']['score'],5)
 def test_one_indicator_indicative(self):
  rows=[self.row(i,i,None,None) for i in range(10)];res=a.evaluate(rows)
  self.assertEqual(res['0']['basis'],'indicative');self.assertEqual(res['0']['score'],5)
 def test_same_provider_threshold(self):
  rows=[self.row(i,i,i,i,provider='OpenAlex' if i<4 else 'Google Scholar') for i in range(10)]
  res=a.evaluate(rows);self.assertEqual(res['0']['basis'],'indicative');self.assertFalse(res['0']['source'])
 def test_discordant_pairs_exclude_ties(self):
  left={'a':{'score':1},'b':{'score':2},'c':{'score':2},'d':{'score':3}}
  right={'a':{'score':3},'b':{'score':2},'c':{'score':1},'d':{'score':1}}
  self.assertEqual(a.discordant_pairs(left,right),4)
 def test_band_thresholds(self):
  self.assertEqual([a.band(x) for x in [0,19,20,39,40,59,60,79,80,100]],[0,0,1,1,2,2,3,3,4,4])
if __name__=='__main__':unittest.main()

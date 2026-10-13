import unittest
from matching import compatible_name,resolve,should_retry,author_metrics

def author(name='A. Perera',id='https://openalex.org/A1',**kw):
 return dict(id=id,display_name=name,works_count=10,affiliations=[{'institution':{'id':'https://openalex.org/I1'}}],**kw)
def person(name='Anura Perera',**kw):return dict(name=name,institution_ids=['I1'],**kw)
class MatchingTests(unittest.TestCase):
 def test_full_name(self):self.assertTrue(compatible_name('Dr Anura Perera','Anura Perera'))
 def test_initials(self):self.assertTrue(compatible_name('H.L. de Silva','Hiran L. de Silva'))
 def test_reordered_names(self):self.assertTrue(compatible_name('Perera, Anura','Anura Perera'))
 def test_abbreviated_names(self):self.assertTrue(compatible_name('Prof HL de Silva','Hiran Lal de Silva'))
 def test_conflicting_initial(self):self.assertFalse(compatible_name('H.L. Silva','N.L. Silva'))
 def test_names_are_not_acceptance(self):self.assertEqual(resolve(person(),[author()])[0]['match_status'],'possible')
 def test_official_orcid(self):self.assertEqual(resolve(person(official_orcids=['0000-0001-2345-6789']),[author(orcid='https://orcid.org/0000-0001-2345-6789')])[0]['match_status'],'confirmed')
 def test_doi_and_historical_affiliation(self):
  a=author();p=person(institution_ids_override=[],historical_institution_ids=['I1'],verified_dois=['10.1/a','10.1/b']);p['institution_ids']=[]
  w=[{'doi':d,'authorships':[{'author':{'id':a['id']}}]} for d in p['verified_dois']]
  self.assertEqual(resolve(p,[a],w)[0]['match_status'],'corroborated')
 def test_two_candidates_are_ambiguous(self):
  p=person(official_orcids=['0000-0001-2345-6789']);self.assertEqual(resolve(p,[author(orcid=p['official_orcids'][0]),author(id='https://openalex.org/A2',orcid=p['official_orcids'][0])])[0]['match_status'],'possible')
 def test_conflicting_subjects(self):self.assertEqual(resolve(person(),[author(_conflicting_evidence=True)])[0]['match_status'],'unresolved')
 def test_large_profile_not_rejected_by_size(self):
  a=author(orcid='0000-0001-2345-6789');a['works_count']=5000;self.assertEqual(resolve(person(official_orcids=[a['orcid']]),[a])[0]['match_status'],'confirmed')
 def test_retry(self):self.assertTrue(should_retry({'match_status':'unresolved'},retry_unresolved=True))
 def test_missing_is_retryable(self):self.assertTrue(should_retry(None))
 def test_manual_protected(self):self.assertFalse(should_retry({'match_status':'confirmed'},force=True,manual=True))
 def test_manual_decision_survives_missing_cache(self):
  d={'match_status':'confirmed','candidate_author_id':'https://openalex.org/A9','reason':'Official ORCID'};self.assertEqual(resolve(person(),[],decisions=[d])[0]['candidate_author_id'],d['candidate_author_id'])
 def test_citation_years_are_received_not_publication_year(self):
  a=author(counts_by_year=[{'year':2021,'cited_by_count':5,'works_count':999},{'year':2026,'cited_by_count':50}]);self.assertEqual(author_metrics(a)['citations_2021_2025'],5)
 def test_missing_years_remain_unknown(self):self.assertNotIn('citations_2021_2025',author_metrics(author()))
if __name__=='__main__':unittest.main()

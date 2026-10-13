"""Evidence-driven identity resolution. Candidate discovery never grants metrics."""
import re, unicodedata
from collections import Counter
from difflib import SequenceMatcher

LEVELS = ('confirmed', 'corroborated', 'possible', 'unresolved')
ACCEPTED = LEVELS[:2]
TITLES = re.compile(r'\b(?:professor|prof|doctor|dr|mr|mrs|ms|miss|eng|rev|ven|snr|senior|emeritus|capt|chair)\b\.?', re.I)
PARTICLES = {'de', 'da', 'di', 'van', 'von', 'la', 'le'}

def tokens(name):
    name = unicodedata.normalize('NFKD', TITLES.sub(' ', name or '')).encode('ascii','ignore').decode()
    parts = re.findall(r'[A-Za-z]+', re.sub(r'\([^)]*\)', ' ', name))
    out=[]
    for p in parts:
        out.extend(list(p.lower()) if p.isupper() and 1 < len(p) <= 4 else [p.lower()])
    return [p for p in out if p not in PARTICLES]

def compatible_name(published, candidate):
    """Order-independent token assignment; abbreviated names remain only candidates.

    At least one full token must agree. Missing *middle* initials are allowed,
    but conflicting full tokens or the first published initial are not ignored.
    Alternative spellings are supplied as documented alternate names, not guessed.
    """
    a,b=tokens(published),tokens(candidate)
    if not a or not b: return False
    full_a=[x for x in a if len(x)>1];full_b=[x for x in b if len(x)>1]
    if not set(full_a)&set(full_b): return False
    if any(x not in full_b and not any(len(y)==1 and y==x[0] for y in b) for x in full_a): return False
    unused=list(b)
    for x in sorted(a,key=lambda v:len(v),reverse=True):
        index=next((i for i,y in enumerate(unused) if x==y or (min(len(x),len(y))==1 and x[0]==y[0])),None)
        if index is not None: unused.pop(index)
        elif len(x)>1 or x==a[0]: return False
    return True

def canonical_orcid(value):
    m=re.search(r'\d{4}-\d{4}-\d{4}-\d{3}[\dX]',value or '',re.I)
    return m.group().upper() if m else ''

def canonical_doi(value):
    value=re.sub(r'^https?://(?:dx\.)?doi.org/','',value or '',flags=re.I)
    return value.strip().lower().rstrip('.,;')

def evidence_for(person, author, works=()):
    names=[person.get('name','')]+person.get('alternate_names',[])
    alternatives=[author.get('display_name','')]+(author.get('display_name_alternatives') or [])
    compatible=any(compatible_name(a,b) for a in names for b in alternatives)
    insts={x.get('institution',{}).get('id','').split('/')[-1] for x in (author.get('affiliations') or [])}
    insts|={x.get('id','').split('/')[-1] for x in (author.get('last_known_institutions') or [])}
    current=set(person.get('institution_ids',[]));historical=set(person.get('historical_institution_ids',[]))
    dois={canonical_doi(x) for x in person.get('verified_dois',[]) if canonical_doi(x)}
    matching=[w for w in works if canonical_doi(w.get('doi')) in dois and any(a.get('author',{}).get('id')==author['id'] for a in w.get('authorships',[]))]
    orcid=canonical_orcid(author.get('orcid'))
    official_orcids={canonical_orcid(x) for x in person.get('official_orcids',[])}-{''}
    conflict=author['id'] in person.get('rejected_author_ids',[]) or bool(author.get('_conflicting_evidence'))
    return dict(name_compatible=compatible,institution_compatible=bool(insts&current),historical_affiliation_compatible=bool(insts&historical),
        orcid_match=bool(orcid and orcid in official_orcids),official_profile_link=author['id'] in person.get('official_openalex_ids',[]),
        verified_doi_matches=len({canonical_doi(w.get('doi')) for w in matching}),
        subject_consistent=bool(author.get('_subject_consistent')),conflicting_evidence=conflict,
        large_profile_review=author.get('works_count',0)>1500,
        doi_evidence=[{'doi':w.get('doi'),'work_id':w.get('id')} for w in matching])

def classify(e):
    if e['conflicting_evidence']:return 'unresolved','conflicting_identity_or_subject_evidence'
    if e['orcid_match'] or e['official_profile_link']:return 'confirmed','official_identifier'
    if e['name_compatible'] and e['verified_doi_matches']>=2 and (e['institution_compatible'] or e['historical_affiliation_compatible'] or e['subject_consistent']):
        return 'corroborated','verified_publications_and_independent_context'
    if e['name_compatible'] or e['verified_doi_matches']:return 'possible','insufficient_independent_evidence'
    return 'unresolved','incompatible_name_without_identifier'

def resolve(person, candidates, works=(), decisions=()):
    by_id={a['id']:a for a in candidates};rated=[]
    rejected={d['candidate_author_id'] for d in decisions if d.get('match_status')=='rejected'}
    for a in by_id.values():
        e=evidence_for(person,a,works);level,method=classify(e)
        if a['id'] in rejected:level,method='unresolved','manual_rejection'
        rated.append(dict(candidate_author_id=a['id'],match_status=level,match_method=method,evidence=e))
    manual=[d for d in decisions if d.get('match_status') in ACCEPTED]
    if manual:
        chosen=manual[-1]
        return {**chosen,'protected_manual_decision':True},rated
    strong=[r for r in rated if r['match_status']=='confirmed']
    if not strong:strong=[r for r in rated if r['match_status']=='corroborated']
    if len(strong)==1:return strong[0],rated
    if len(strong)>1:return dict(match_status='possible',candidate_author_id='',match_method='multiple_supported_candidates_require_review',evidence={}),rated
    possible=[r for r in rated if r['match_status']=='possible']
    return dict(match_status='possible' if possible else 'unresolved',candidate_author_id='',match_method='candidate_review_needed' if possible else 'no_supported_candidate',evidence={}),rated

def should_retry(previous, *, retry_unresolved=False, recheck_possible=False, recheck_ambiguous=False, refresh=False, force=False, manual=False):
    if manual:return False  # explicit curator decisions are changed through the review importer
    if not previous:return True
    if force:return True
    status=previous.get('match_status','unresolved')
    return (status=='unresolved' and retry_unresolved) or (status=='possible' and (recheck_possible or recheck_ambiguous)) or (status in ACCEPTED and refresh)

def author_metrics(a):
    out={'total_publications':a.get('works_count'),'total_citations':a.get('cited_by_count'),'h_index':(a.get('summary_stats') or {}).get('h_index')}
    yearly=a.get('counts_by_year')
    out['citations_2021_2025']=sum(x.get('cited_by_count',0) for x in yearly if 2021<=x.get('year',0)<=2025) if isinstance(yearly,list) else None
    return {k:v for k,v in out.items() if isinstance(v,(int,float)) and v>=0}

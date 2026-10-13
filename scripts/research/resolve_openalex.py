"""Retryable, cache-first resolver. Does not replace established provider IDs.

New matches are staged pending publication review. Curator approval is required
before the importer exposes their values. Existing accepted snapshots remain intact.
"""
import argparse,csv,json,sys,pathlib,datetime,collections,os
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/baselines'))
import openalex as oa
from matching import tokens,canonical_orcid,canonical_doi,resolve,ACCEPTED,author_metrics,should_retry
from sri_lanka_openalex import SL_INST
DATA=ROOT/'Data files';PRIVATE=DATA/'_research_reviews';MATCHES=DATA/'research_identity_matches.csv'
TODAY=datetime.date.today().isoformat()
FIELDS=['academic_id','provider','candidate_author_id','match_status','match_method','evidence','review_status','reviewed_at','matched_at','publication_status']

def read(p):return list(csv.DictReader(p.open(encoding='utf-8-sig'))) if p.exists() else []
def write(p,rows,fields=None):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp')
 fields=fields or list(dict.fromkeys(k for r in rows for k in r))
 if not fields:return
 with tmp.open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
 tmp.replace(p)
def alias_id(a,aliases):
 seen=set()
 while a in aliases:
  if a in seen:raise ValueError('Circular academic alias')
  seen.add(a);a=aliases[a]
 return a

def cache_index():
 authors={};works=[]
 for p in oa.CACHE.glob('*.json'):
  try:d=json.loads(p.read_text())
  except (ValueError,OSError):continue
  for r in d.get('results',[d] if d.get('id') else []):
   id=r.get('id','')
   if '/A' in id:
    # Preserve the richest representation rather than the highest metric count.
    if id not in authors or len(r)>len(authors[id]):authors[id]=r
   elif '/W' in id:works.append(r)
 by_orcid=collections.defaultdict(set);by_token=collections.defaultdict(set)
 for aid,a in authors.items():
  if a.get('orcid'):by_orcid[canonical_orcid(a['orcid'])].add(aid)
  for n in [a.get('display_name','')]+(a.get('display_name_alternatives') or []):
   for t in tokens(n):
    if len(t)>1:by_token[t].add(aid)
 return authors,works,by_orcid,by_token

def main(argv=None):
 p=argparse.ArgumentParser(description=__doc__)
 for flag in ['cache-only','retry-unresolved','recheck-possible','recheck-ambiguous','missing-only','refresh-outdated','force']:
  p.add_argument('--'+flag,action='store_true')
 p.add_argument('--ids',nargs='*',default=[]);p.add_argument('--limit',type=int);p.add_argument('--network',action='store_true',help='Allow API calls; default is cache-only')
 args=p.parse_args(argv);oa.CACHE_ONLY=not args.network or args.cache_only
 PRIVATE.mkdir(parents=True,exist_ok=True)
 aliases={r['alias_academic_id']:r['canonical_academic_id'] for r in read(DATA/'identity_aliases.csv')}
 people=[r for f in (DATA/'universities').rglob('academics.csv') for r in read(f) if not __import__('re').search('librarian',r.get('academic_position',''),__import__('re').I)]
 unis={r['name']:r['id'] for r in read(DATA/'universities.csv')}
 oldpath=DATA/'international/sri_lanka_openalex_metrics.csv';old=read(oldpath);lookups={alias_id(r['academic_id'],aliases):r for r in old}
 existing={r['academic_id']:r for r in read(MATCHES)};decisions=read(PRIVATE/'decisions.csv')
 identities=read(DATA/'research_identity_evidence.csv');pubs=read(DATA/'publication_verification.csv')
 additional=read(DATA/'research_matching_evidence.csv')
 authors,works,by_orcid,by_token=cache_index();candidates=[];logs=[];new_rows=[];processed=0
 for r in people:
  aid=r['academic_id'];uid=unis.get(r['university'].replace(' (SLIIT)',''));legacy=lookups.get(aid,{})
  accepted=bool(legacy.get('openalex_id') and '_matched_' in legacy.get('status',''))
  prior=existing.get(aid);manual=[d for d in decisions if alias_id(d['academic_id'],aliases)==aid]
  if args.ids and aid not in args.ids:continue
  if args.missing_only and legacy:continue
  if prior and not should_retry(prior,retry_unresolved=args.retry_unresolved,recheck_possible=args.recheck_possible,recheck_ambiguous=args.recheck_ambiguous,refresh=args.refresh_outdated,force=args.force,manual=any(d['match_status'] in ACCEPTED for d in manual)):continue
  if args.limit is not None and processed>=args.limit:break
  processed+=1
  trusted=[e for e in identities if alias_id(e['academic_id'],aliases)==aid and e['identity_verification_status']=='verified_official_link']
  person=dict(name=r['full_name'],institution_ids=SL_INST.get(uid,[]),official_orcids=[e['profile_url'] for e in trusted if e['platform']=='ORCID'],
   official_openalex_ids=[e['profile_url'] for e in trusted if e['platform']=='OpenAlex'],verified_dois=[e['doi'] for e in pubs if alias_id(e['academic_id'],aliases)==aid],alternate_names=[],historical_institution_ids=[])
  for e in additional:
   if alias_id(e['academic_id'],aliases)!=aid or not e.get('source_url'):continue
   if e.get('evidence_type')=='published_alternate_name':person['alternate_names'].append(e['value'])
   if e.get('evidence_type')=='historical_institution':person['historical_institution_ids'].append(e['value'].split('/')[-1])
   if e.get('evidence_type')=='verified_doi':person['verified_dois'].append(e['value'])
  selected=set()
  for oid in person['official_orcids']:selected|=by_orcid[canonical_orcid(oid)]
  for n in [person['name']]+person['alternate_names']:
   for t in tokens(n):
    if len(t)>1:selected|=by_token[t]
  selected|={x for x in person['official_openalex_ids'] if x in authors}
  if accepted and legacy['openalex_id'] in authors:selected.add(legacy['openalex_id'])
  failures=[]
  if args.network:
   try:
    for oid in person['official_orcids']:
     a=oa._get('/authors/orcid:'+canonical_orcid(oid),{});authors[a['id']]=a;selected.add(a['id'])
    if not person['official_orcids'] or not selected:
     for name in [person['name']]+person['alternate_names']:
      d=oa._get('/authors',{'search':' '.join(tokens(name)),'per-page':25,'select':oa.SELECT})
      for a in d.get('results',[]):authors[a['id']]=a;selected.add(a['id'])
    for doi in person['verified_dois']:
     w=oa._get('/works/https://doi.org/'+canonical_doi(doi),{});works.append(w)
     for a in w.get('authorships',[]):
      author_id=a.get('author',{}).get('id')
      if author_id and author_id not in authors:
       authors[author_id]=oa._get('/authors/'+author_id.split('/')[-1],{})
      if author_id:selected.add(author_id)
   except (oa.BudgetExhausted,RuntimeError) as e:failures.append(str(e))
  result,rated=resolve(person,[authors[x] for x in sorted(selected) if x in authors],works,manual)
  chosen=result.get('candidate_author_id','')
  if accepted:
   if result['match_status'] in ACCEPTED and chosen!=legacy['openalex_id']:
    logs.append(dict(academic_id=aid,status='established_identity_conflict',previous_author_id=legacy['openalex_id'],proposed_author_id=chosen,checked_at=TODAY));result=dict(candidate_author_id=legacy['openalex_id'],match_status=(prior or {}).get('match_status','corroborated'),match_method='preserved_legacy_identity_conflict_requires_review',evidence={'legacy_accepted':True,'conflicting_new_identifier':True})
   elif result['match_status'] not in ACCEPTED:
    result=dict(candidate_author_id=legacy['openalex_id'],match_status=(prior or {}).get('match_status','corroborated'),match_method='legacy_accepted_name_and_institution',evidence={'legacy_accepted':True,'review_recommended':True})
  row=dict(academic_id=aid,provider='OpenAlex',candidate_author_id=result.get('candidate_author_id','') if result['match_status'] in ACCEPTED else '',match_status=result['match_status'],match_method=result['match_method'],evidence=json.dumps(result.get('evidence',{})),review_status='manual' if result.get('protected_manual_decision') else 'automatic',reviewed_at=manual[-1].get('reviewed_at','') if manual else '',matched_at=TODAY,publication_status=(prior or {}).get('publication_status','approved' if accepted else 'pending'))
  existing[aid]=row
  if not accepted and row['match_status'] in ACCEPTED and row['candidate_author_id'] in authors:
   a=authors[row['candidate_author_id']];m=author_metrics(a)
   new=dict(academic_id=aid,university_id=uid,full_name=r['full_name'],openalex_id=a['id'],openalex_display_name=a['display_name'],status='openalex_matched_'+row['match_status'],candidates=len(rated),checked_at=TODAY,**{k:m.get(k,'') for k in ['total_publications','total_citations','h_index','citations_2021_2025']})
   if not lookups.get(aid,{}).get('openalex_id'):
    # Preserve previous unresolved attempts in the private history, replacing no established author.
    if aid in lookups:logs.append(dict(academic_id=aid,status='resolved_prior_attempt',previous_attempt=lookups[aid],checked_at=TODAY))
    lookups[aid]=new
  for item in rated:
   a=authors[item['candidate_author_id']]
   if item['match_status']=='unresolved' and item['match_method']!='manual_rejection':continue
   candidates.append(dict(academic_id=aid,official_name=r['full_name'],university=r['university'],faculty=r['faculty'],department=r['department'],interests=r['research_interests'],official_source_url=r['staff_profile_url'],verified_dois=person['verified_dois'],official_orcids=person['official_orcids'],candidate_name=a['display_name'],affiliations=a.get('affiliations',[]),topics=a.get('topics',[]),metadata=author_metrics(a),**item))
  logs.append(dict(academic_id=aid,status=row['match_status'],checked_at=TODAY,failed_requests=failures,offline=oa.CACHE_ONLY))
  if processed%50==0:
   write(MATCHES,list(existing.values()),FIELDS);write(oldpath,list(lookups.values()))
   print('Checkpoint',processed,'academics',flush=True)
 write(MATCHES,list(existing.values()),FIELDS);write(oldpath,list(lookups.values()))
 (PRIVATE/'candidates.json').write_text(json.dumps(candidates,ensure_ascii=False))
 with (PRIVATE/'attempts.jsonl').open('a') as f:
  for item in logs:f.write(json.dumps(item)+'\n')
 summary=dict(date=TODAY,profiles=len(people),processed=processed,levels=dict(collections.Counter(r['match_status'] for r in existing.values())),approved=dict(collections.Counter(r['match_status'] for r in existing.values() if r['publication_status']=='approved')),new_staged_matches=sum(r['match_status'] in ACCEPTED and r['publication_status']=='pending' for r in existing.values()),identity_conflicts=sum(x['status']=='established_identity_conflict' for x in logs),cache_authors=len(authors))
 (ROOT/'reports/research/resolution.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
if __name__=='__main__':main()

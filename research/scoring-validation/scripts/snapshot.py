"""Build a minimal anonymised research snapshot from the app's public inputs."""
import csv, json, hashlib, subprocess, sys, random, collections, re
from urllib.parse import urlparse, parse_qs
from pathlib import Path
R=Path(__file__).resolve().parents[3]; D=R/'research/scoring-validation/data'; D.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inputs=[R/'public/data/academics.csv',R/'public/data/universities.csv',R/'public/data/field-mapping.json',R/'public/data/metadata.json']
with inputs[0].open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
with inputs[1].open(encoding='utf-8-sig',newline='') as f: excluded={r['id'] for r in csv.DictReader(f) if r.get('exclude_from_comparison')=='yes'}
mp=json.loads(inputs[2].read_text()); meta=json.loads(inputs[3].read_text()); metrics=['hIndex','recentCitations','publications']
def provider(s):
 s=s.lower()
 if 'scholar' in s and 'researchgate' in s:return 'Mixed'
 if 'scholar' in s:return 'Google Scholar'
 if 'researchgate' in s:return 'ResearchGate'
 if 'openalex' in s:return 'OpenAlex'
 return 'Other' if s else 'Not recorded'
out=[]
for i,r in enumerate(rows):
 if r['universityId'] in excluded:continue
 ev=json.loads(r['metricEvidence'] or '[]'); field=mp.get('academics',{}).get(r['id']) or mp['departments'].get(r['departmentId']) or mp['faculties'].get(r['facultyId']) or 'Unmapped'
 v={'row':str(i),'institution':r['universityId'],'rank':r['rank'],'field':field,'verified':int(bool(r['openAlexUrl']) or r['scholarStatus'] in ('verified_official_link','matched_user_supplied_platform_evidence') or r['researchgateStatus'] in ('verified_official_link','matched_user_supplied_platform_evidence')),'scholarStatus':r['scholarStatus'],'openAlexMatchLevel':r['openAlexMatchLevel']}
 for m in metrics:
  v[m]=r[m]; match=next((e for e in ev if e.get('metric')==m),None)
  v[m+'Provider']=provider(match.get('source','') if match else r['metricsSource']) if r[m]!='' else 'Not recorded'
  v[m+'Date']=(match.get('date','') if match else r['collectionDate']) if r[m]!='' else ''
 out.append(v)
# Shuffle before assigning synthetic row numbers; this reduces direct linkage, not all re-identification risk.
random.Random(20261114).shuffle(out)
for i, row in enumerate(out): row['row']=str(i)
p=D/'snapshot.csv'
with p.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=out[0]);w.writeheader();w.writerows(out)
ids=collections.Counter(r['id'] for r in rows if r['id'])
def profile_key(r):
 u=r['scholarUrl']
 if u:
  q=parse_qs(urlparse(u).query).get('user',[])
  if q:return 'scholar:'+q[0]
 if r['openAlexUrl']:return 'openalex:'+r['openAlexUrl'].rstrip('/').split('/')[-1].lower()
 return ''
keys=collections.Counter(profile_key(r) for r in rows if profile_key(r))
name_keys=collections.Counter((re.sub(r'[^a-z0-9]','',r['name'].lower()),r['universityId']) for r in rows if r['name'])
manifest={'duplicate_id_keys':sum(v>1 for v in ids.values()),'repeated_provider_profile_keys':sum(v>1 for v in keys.values()),'repeated_normalized_name_and_institution_keys':sum(v>1 for v in name_keys.values()),'base_commit' :subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'dataset_version':meta['version'],'collection_date':meta.get('collectionDate'),'input_sha256':{str(x.relative_to(R)):sha(x) for x in inputs},'pseudonymised_snapshot_sha256':sha(p),'input_dirty':bool(subprocess.check_output(['git','status','--porcelain','--',*[str(x.relative_to(R)) for x in inputs]],cwd=R,text=True).strip()),'rows_after_application_exclusions':len(out),'excluded_university_count':len(excluded),'note':'Input public files may have uncommitted changes. Snapshot contains no names, IDs, profile URLs or individual metrics evidence; row numbers are shuffled; combinations of public attributes may still permit re-identification.'}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))

"""Local curator review/export/import. No public database or write endpoint."""
import argparse,json,csv,html,pathlib,datetime,sys
from resolve_openalex import DATA,PRIVATE,MATCHES,read,write,FIELDS
from matching import ACCEPTED

def main():
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
 sub.add_parser('export')
 imp=sub.add_parser('import');imp.add_argument('file')
 approve=sub.add_parser('approve');approve.add_argument('--ids',nargs='+',required=True);approve.add_argument('--reason',required=True)
 args=p.parse_args();PRIVATE.mkdir(parents=True,exist_ok=True)
 if args.command=='export':
  candidates=json.loads((PRIVATE/'candidates.json').read_text());payload=json.dumps(candidates).replace('<','\\u003c')
  template='''<!doctype html><meta charset="utf-8"><title>Local OpenAlex review</title><style>body{font:16px system-ui;margin:24px;background:#f5f5f7;color:#222}article{background:white;padding:20px;border-radius:16px;margin:16px 0}input,select,button{font:inherit;padding:10px}pre{white-space:pre-wrap}a{color:#0675ed}</style><h1>Local OpenAlex review</h1><p>Decisions are exported to a file. Nothing is saved to a remote database.</p><input id="search" placeholder="Filter name or university"><button id="export">Export decisions</button><main></main><script>const rows=PAYLOAD, decisions=new Map();const main=document.querySelector('main');function render(){main.replaceChildren();for(const r of rows.filter(r=>(r.official_name+' '+r.university).toLowerCase().includes(document.querySelector('#search').value.toLowerCase()))){const a=document.createElement('article');const title=document.createElement('h2');title.textContent=r.official_name+' · '+r.university;a.append(title);for(const [label,url] of [['Official profile',r.official_source_url],['OpenAlex candidate',r.candidate_author_id]]){const link=document.createElement('a');if(/^https:\\/\\//.test(url)){link.href=url;link.target='_blank';link.rel='noopener';link.textContent=label;a.append(link,document.createTextNode(' · '));}}const info=document.createElement('pre');info.textContent=JSON.stringify({faculty:r.faculty,department:r.department,interests:r.interests,official_orcids:r.official_orcids,official_dois:r.verified_dois,candidate:r.candidate_name,affiliations:r.affiliations,topics:r.topics,evidence:r.evidence,metrics:r.metadata},null,2);a.append(info);const select=document.createElement('select');for(const level of ['unresolved','confirmed','corroborated','rejected']){const opt=document.createElement('option');opt.value=level;opt.textContent=level;select.append(opt)}const reason=document.createElement('input');reason.placeholder='Review reason';const sources=document.createElement('input');sources.placeholder='Supporting URLs, comma separated';const save=document.createElement('button');save.textContent='Add decision';save.onclick=()=>{if(!reason.value.trim()||!sources.value.trim()){alert('A reason and supporting sources are required.');return}decisions.set(r.academic_id+'|'+r.candidate_author_id,{academic_id:r.academic_id,candidate_author_id:r.candidate_author_id,match_status:select.value,reason:reason.value,supporting_urls:sources.value.split(',').map(x=>x.trim()),reviewed_at:new Date().toISOString()});save.textContent='Decision added'};a.append(select,reason,sources,save);main.append(a)}}document.querySelector('#search').oninput=render;document.querySelector('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify([...decisions.values()],null,2)],{type:'application/json'}));a.download='openalex-decisions.json';a.click();URL.revokeObjectURL(a.href)};render();</script>'''
  path=PRIVATE/'review.html';path.write_text(template.replace('PAYLOAD',payload));print('Open locally:',path);return
 if args.command=='import':
  decisions=json.loads(pathlib.Path(args.file).read_text());existing=read(PRIVATE/'decisions.csv');known={r['academic_id'] for r in read(MATCHES)}
  for d in decisions:
   if d.get('academic_id') not in known or d.get('match_status') not in (*ACCEPTED,'rejected','unresolved'):raise ValueError('Invalid review identity or decision')
   if not d.get('reason','').strip() or not d.get('supporting_urls') or not all(str(u).startswith('https://') for u in d['supporting_urls']):raise ValueError('Reason and HTTPS evidence sources required')
   if not __import__('re').fullmatch(r'https://openalex.org/A\d+',d.get('candidate_author_id','')):raise ValueError('Invalid OpenAlex author ID')
   existing.append({**d,'supporting_urls':json.dumps(d['supporting_urls'])})
  write(PRIVATE/'decisions.csv',existing);print('Imported decisions:',len(decisions),'Run resolver with --ids to apply; established ID conflicts remain protected.');return
 rows=read(MATCHES);ids=set(args.ids);selected=[r for r in rows if r['academic_id'] in ids]
 if len(selected)!=len(ids) or any(r['match_status'] not in ACCEPTED or not r['candidate_author_id'] for r in selected):raise ValueError('Only accepted identities can be publication-approved')
 for r in selected:r['publication_status']='approved';r['reviewed_at']=datetime.date.today().isoformat()
 write(MATCHES,rows,FIELDS)
 log=PRIVATE/'publication_approvals.jsonl'
 with log.open('a') as f:f.write(json.dumps({'ids':args.ids,'reason':args.reason,'reviewed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n')
 print('Publication-reviewed identities:',len(selected))
if __name__=='__main__':main()

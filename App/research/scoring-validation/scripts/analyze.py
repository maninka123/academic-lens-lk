"""Reproducible aggregate sensitivity study; no per-person scores are exported."""
import csv,json,math,hashlib,collections,os
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/tmp/lanka-academia-mpl')
import numpy as np
from scipy.stats import spearmanr,kendalltau,rankdata
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
R=Path(__file__).resolve().parents[1]; P=R/'results'; F=R/'figures'; P.mkdir(exist_ok=True);F.mkdir(exist_ok=True)
M=('hIndex','recentCitations','publications'); W=np.array([.4,.35,.25]); STAGES={'Senior Professor':'Professor','Professor':'Professor','Associate Professor':'Mid-career','Senior Lecturer':'Mid-career','Assistant Professor':'Early-career','Lecturer':'Early-career','Assistant Lecturer':'Early-career'}
with (R/'data/snapshot.csv').open(newline='',encoding='utf8') as f: data=list(csv.DictReader(f))
for r in data:
 r['stage']=STAGES.get(r['rank'],'Unknown' if r['rank']=='Unknown' else 'Teaching / other')
 for m in M:r[m]=float(r[m]) if r[m]!='' else None
 r['verified']=r['verified']=='1'
def band(s):return min(int(s//20),4)
def evaluate(rows,minimum=10, relaxed=5, strict_group=False, same_provider_only=False, complete_only=False, verified_only=False, stage_only=False, alternative=False, winsor=False):
 pool=[r for r in rows if (not verified_only or r['verified']) and (not complete_only or all(r[m] is not None for m in M))]
 index={r['row']:r for r in pool}; groups=collections.defaultdict(list)
 for r in pool:
  groups[('all',)].append(r);groups[('stage',r['stage'])].append(r);groups[('field',r['field'])].append(r);groups[('both',r['stage'],r['field'])].append(r)
 cache={}
 def components(r,key,thresh,source):
  out=[]
  for m in M:
   x=r[m]
   if x is None:out.append((None,0));continue
   prov=r[m+'Provider']; ck=(key,m,prov if source else '*',winsor)
   if ck not in cache:
    vals=[a[m] for a in groups.get(key,[]) if a[m] is not None and (not source or a[m+'Provider']==prov)]
    vals=np.array(vals,dtype=float)
    cap=float(np.quantile(vals,.95)) if winsor and len(vals) else None
    if cap is not None: vals=np.minimum(vals,cap)
    cache[ck]=(np.sort(vals),cap)
   vals,cap=cache[ck];n=len(vals)
   if n<thresh:out.append((None,n));continue
   if cap is not None:x=min(x,cap)
   left=np.searchsorted(vals,x,'left');right=np.searchsorted(vals,x,'right')
   pct=100*(right if alternative else (left+right)/2)/n
   out.append((float(pct),n))
  return out
 results={}
 for r in rows:
  if r['row'] not in index:continue
  st=r['stage'];field=r['field'];known=st not in ('Unknown','Teaching / other');fk=bool(field and field.strip().lower() not in ('unmapped','unclassified','unknown'))
  staged=([('both',st,field)] if fk and not stage_only else [])+[('stage',st)] if known else []
  unstaged=([('field',field)] if fk else [])+[('all',)]
  if strict_group:staged=[('both',st,field)] if known and fk else [];unstaged=[]
  passes=[(staged,minimum,True,True,'standard')]
  if not strict_group:
   passes += [(staged,relaxed,True,False,'indicative'),(unstaged,minimum,True,False,'indicative')]
   if not same_provider_only:passes += [(staged+unstaged,minimum,False,False,'indicative')]
  for levels,n,source,standard,basis in passes:
   done=False
   for key in levels:
    comp=components(r,key,n,source); used=[i for i,(x,_) in enumerate(comp) if x is not None]
    if not used or (standard and (len(used)<2 or not any(i in (0,1) for i in used))):continue
    score=math.floor(sum(W[i]*comp[i][0] for i in used)/sum(W[i] for i in used)+.5)
    results[r['row']]={'score':score,'parts':[x[0] for x in comp],'n':[x[1] for x in comp],'basis':basis,'level':key[0],'source':source,'stage':st,'field':field,'verified':r['verified'],'institution':r['institution']};done=True;break
   if done:break
 return results
base=evaluate(data)
def stats_compare(a,b):
 ids=sorted(a.keys() & b.keys());x=np.array([a[i]['score'] for i in ids]);y=np.array([b[i]['score'] for i in ids]);d=np.abs(x-y)
 return {'n':len(ids),'mean_abs':round(float(np.mean(d)),3) if len(d) else None,'median_abs':float(np.median(d)) if len(d) else None,'max_abs':int(max(d)) if len(d) else None,'band_changed':int(sum(band(v)!=band(w) for v,w in zip(x,y))),'spearman':round(float(spearmanr(x,y).statistic),5) if len(x)>1 and len(set(x))>1 and len(set(y))>1 else None,'kendall_tau_b':round(float(kendalltau(x,y).statistic),5) if len(x)>1 else None}
def discordant_pairs(a,b):
 ids=sorted(a.keys() & b.keys());pairs=sorted((a[i]['score'],b[i]['score']) for i in ids);ys=sorted(set(y for _,y in pairs));index={y:i+1 for i,y in enumerate(ys)};tree=[0]*(len(ys)+1);seen=0;discordant=0
 def read(i):
  total=0
  while i: total+=tree[i];i-=i&-i
  return total
 def put(i):
  while i<len(tree):tree[i]+=1;i+=i&-i
 i=0
 while i<len(pairs):
  j=i
  while j<len(pairs) and pairs[j][0]==pairs[i][0]:j+=1
  for _,v in pairs[i:j]:discordant+=seen-read(index[v])
  for _,v in pairs[i:j]:put(index[v]);seen+=1
  i=j
 return discordant
def reweight(weight):
 out={}
 for i,r in base.items():
  used=[j for j,x in enumerate(r['parts']) if x is not None];score=math.floor(sum(weight[j]*r['parts'][j] for j in used)/sum(weight[j] for j in used)+.5);out[i]={**r,'score':score}
 return out
schemes={'baseline':[.4,.35,.25],'equal':[.3333,.3333,.3334],'citation_emphasis':[.3,.45,.25],'publication_emphasis':[.3,.3,.4],'h_index_emphasis':[.5,.3,.2]}
weighted={k:reweight(w) for k,w in schemes.items()}; weights={k:{**stats_compare(base,v),'mean_score':round(np.mean([r['score'] for r in v.values()]),2),'discordant_pairs':discordant_pairs(base,v)} for k,v in weighted.items()}
scenarios={'minimum_20':{'minimum':20},'minimum_30':{'minimum':30},'strict_field_stage':{'strict_group':True},'stage_only':{'stage_only':True},'same_provider_only':{'same_provider_only':True},'complete_case':{'complete_only':True},'verified_identity':{'verified_only':True},'upper_ecdf':{'alternative':True},'winsor_95':{'winsor':True}}
sensitivity={}
for label,opts in scenarios.items():
 b=evaluate(data,**opts);sensitivity[label]={**stats_compare(base,b),'scored':len(b),'excluded_or_unscored':len(data)-len(b)}
# Correlations restricted to paired measurements from the same named provider.
corr=[]
for a,b in [(0,1),(0,2),(1,2)]:
 rr=[r for r in data if r[M[a]] is not None and r[M[b]] is not None and r[M[a]+'Provider']==r[M[b]+'Provider'] and r[M[a]+'Provider'] not in ('Not recorded','Other','Mixed')];x=[r[M[a]] for r in rr];y=[r[M[b]] for r in rr]
 corr.append({'a':M[a],'b':M[b],'n':len(rr),'spearman':round(float(spearmanr(x,y).statistic),4) if len(rr)>1 else None,'kendall_tau_b':round(float(kendalltau(x,y).statistic),4) if len(rr)>1 else None})
counts={'n':len(data),'scored':len(base),'basis':dict(collections.Counter(r['basis'] for r in base.values())),'level':dict(collections.Counter(r['level'] for r in base.values())),'measures':dict(collections.Counter(str(sum(x is not None for x in r['parts'])) for r in base.values())),'available_metrics':dict(collections.Counter(str(sum(r[m] is not None for m in M)) for r in data)),'verified':sum(r['verified'] for r in data),'complete':sum(all(r[m] is not None for m in M) for r in data),'unmapped':sum(r['field'].lower() in ('unmapped','unknown','unclassified','') for r in data),'unknown_stage':sum(r['stage'] in ('Unknown','Teaching / other') for r in data),'providers':{m:dict(collections.Counter(r[m+'Provider'] for r in data if r[m] is not None)) for m in M},'duplicates_row_keys':len(data)-len({r['row'] for r in data}),'mixed_source_scores':sum(not r['source'] for r in base.values()),'confidence_identity_proxies':sum(r['verified'] for r in data)}
dates={m:dict(collections.Counter((r[m+'Date'][:7] or 'missing') for r in data if r[m] is not None)) for m in M}
segments=[]
for typ in ('stage','field','institution'):
 for key in sorted(set(r[typ] for r in data)):
  rr=[r for r in data if r[typ]==key];
  if len(rr)<5:continue
  segments.append({'dimension':typ,'group':key,'n':len(rr),'complete':sum(all(r[m] is not None for m in M) for r in rr),'verified':sum(r['verified'] for r in rr),'scored':sum(r['row'] in base for r in rr)})
# Provider-only experiments discard values from all other providers without imputing.
for provider in ('OpenAlex','Google Scholar'):
 restricted=[]
 for r in data:
  t=dict(r)
  for m in M:
   if t[m+'Provider']!=provider:t[m]=None
  restricted.append(t)
 b=evaluate(restricted)
 sensitivity['provider_'+provider.replace(' ','_')]={**stats_compare(base,b),'scored':len(b),'excluded_or_unscored':len(data)-len(b)}
weight_segments=[]
for dimension in ('stage','field'):
 for group in sorted(set(r[dimension] for r in base.values())):
  ids={i for i,r in base.items() if r[dimension]==group}
  if len(ids)<5:continue
  for scheme in list(schemes)[1:]:
   a={i:base[i] for i in ids};b={i:weighted[scheme][i] for i in ids}
   weight_segments.append({'dimension':dimension,'group':group,'scheme':scheme,**stats_compare(a,b)})
# Grid step 0.1; minimum positive weights avoid zero denominator on partial observations.
grid=[]
for a in range(1,9):
 for b in range(1,10-a):
  c=10-a-b
  if c<1:continue
  sc=stats_compare(base,reweight([a/10,b/10,c/10]));grid.append({'h_index':a/10,'recent_citations':b/10,'publications':c/10,**sc})
result={'counts':counts,'weights':weights,'correlations':corr,'scenarios':sensitivity,'dates':dates,'weight_grid':grid,'snapshot_sha256':hashlib.sha256((R/'data/snapshot.csv').read_bytes()).hexdigest()}
(P/'summary.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
for name,rr in [('segments',segments),('weight_grid',grid),('indicator_correlations',corr),('weight_segments',weight_segments)]:
 with (P/(name+'.csv')).open('w',newline='',encoding='utf8') as f:w=csv.DictWriter(f,fieldnames=rr[0]);w.writeheader();w.writerows(rr)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':13,'axes.labelsize':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':180,'savefig.dpi':220,'axes.titleweight':'semibold'})
navy='#173758'; teal='#0b7f83'; gray='#d9e2e7'
fig,ax=plt.subplots(1,2,figsize=(11,4.5))
xs=['0','1','2','3']; ys=[counts['available_metrics'].get(x,0) for x in xs]
bars=ax[0].bar(xs,ys,color=[gray,gray,teal,navy],width=.65);ax[0].bar_label(bars,padding=4,fmt='%d');ax[0].set(xlabel='Number of recorded indicators',ylabel='Number of profiles',title='Indicator availability');ax[0].set_ylim(0,max(ys)*1.16)
vals=[v['score'] for v in base.values()];ax[1].hist(vals,bins=np.arange(0,110,10),color=navy,edgecolor='white');ax[1].set(xlim=(0,100),xlabel='Rounded weighted score',ylabel='Number of profiles',title='Scores among scored profiles');ax[1].set_xticks(np.arange(0,101,20))
fig.suptitle('Coverage and standing scores',x=.07,ha='left',fontsize=16,fontweight='bold');fig.text(.07,.01,f'Application-eligible Sri Lankan profiles: n = {len(data):,}; scored: n = {len(base):,}.',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.055,1,.92));fig.savefig(F/'availability-and-scores.png');plt.close(fig)
fig,ax=plt.subplots(figsize=(9,4.6));names=['Equal','Citation emphasis','Publication emphasis','h-index emphasis'];keys=['equal','citation_emphasis','publication_emphasis','h_index_emphasis'];v=[weights[k]['mean_abs'] for k in keys];y=np.arange(len(names));bars=ax.barh(y,v,color=[teal,teal,navy,teal],height=.62);ax.bar_label(bars,labels=[f'{x:.2f}' for x in v],padding=5);ax.set_yticks(y,names);ax.invert_yaxis();ax.set(xlim=(0,max(v)*1.24),xlabel='Mean absolute score change (points)',title='Changing the weights');ax.grid(axis='x',alpha=.18);ax.set_axisbelow(True);fig.text(.13,.02,f'Compared with 40 / 35 / 25 baseline; same scored profiles (n = {len(base):,}).',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.07,1,1));fig.savefig(F/'weight-sensitivity.png');plt.close(fig)
fig,ax=plt.subplots(figsize=(8.5,4.4));y=np.arange(len(corr));vals=[x['spearman'] for x in corr];bars=ax.barh(y,vals,color=teal,height=.6);ax.bar_label(bars,labels=[f"{x['spearman']:.2f}   (n = {x['n']:,})" for x in corr],padding=6);ax.set_yticks(y,['h-index / recent citations','h-index / publications','Recent citations / publications']);ax.invert_yaxis();ax.set(xlim=(0,1.2),xlabel='Spearman correlation',title='Indicators carry overlapping information');ax.set_xticks([0,.25,.5,.75,1]);ax.grid(axis='x',alpha=.18);ax.set_axisbelow(True);fig.text(.12,.02,'Pairwise complete observations from the same named provider; fields and stages pooled.',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.07,1,1));fig.savefig(F/'indicator-correlations.png');plt.close(fig)
fig,ax=plt.subplots(figsize=(9,4.8));items=[('Baseline',len(base)),('Verified identity',sensitivity['verified_identity']['scored']),('Complete case',sensitivity['complete_case']['scored']),('Strict field × stage',sensitivity['strict_field_stage']['scored'])];bars=ax.barh([i[0] for i in items],[i[1] for i in items],color=[navy,teal,teal,teal],height=.6);ax.bar_label(bars,labels=[f'{v:,}' for _,v in items],padding=5);ax.invert_yaxis();ax.set(xlim=(0,len(data)*1.08),xlabel='Number of profiles scored',title='Coverage changes under stricter scenarios');ax.grid(axis='x',alpha=.18);ax.set_axisbelow(True);fig.text(.12,.02,f'Scenarios change both target profiles and their peer pools; total eligible n = {len(data):,}.',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.07,1,1));fig.savefig(F/'scenario-coverage.png');plt.close(fig)
fig,axes=plt.subplots(1,3,figsize=(11,4.2));labels=['h-index','Citations 2021–2025','Publications']
for ax,m,label in zip(axes,M,labels):
 vals=np.array([r[m] for r in data if r[m] is not None]);ax.hist(np.log10(1+vals),bins=24,color=navy,edgecolor='white',linewidth=.4);ax.set(title=label,xlabel='log₁₀(1 + value)',ylabel='Profiles');ax.text(.98,.96,f'n = {len(vals):,}',transform=ax.transAxes,ha='right',va='top',color='#485c69')
fig.suptitle('Recorded indicator distributions',x=.07,ha='left',fontsize=16,fontweight='bold');fig.text(.07,.01,'Recorded zero is retained; the log transform is used only for display.',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.07,1,.9));fig.savefig(F/'indicator-distributions.png');plt.close(fig)
mins=[min(n for p,n in zip(r['parts'],r['n']) if p is not None) for r in base.values()];bins=['5–9','10–24','25–49','50+'];groups=[sum(5<=n<10 for n in mins),sum(10<=n<25 for n in mins),sum(25<=n<50 for n in mins),sum(n>=50 for n in mins)];fig,ax=plt.subplots(figsize=(8.5,4.4));bars=ax.bar(bins,groups,color=[gray,teal,teal,navy],width=.65);ax.bar_label(bars,padding=4);ax.set(xlabel='Smallest component peer pool',ylabel='Scored profiles',title='Peer-pool sizes used by the score');ax.set_ylim(0,max(groups)*1.16);fig.text(.12,.02,f'One minimum per scored profile (n = {len(base):,}); a larger pool does not establish comparability.',fontsize=9,color='#485c69');fig.tight_layout(rect=(0,.07,1,1));fig.savefig(F/'peer-pool-sizes.png');plt.close(fig)
print(json.dumps({'counts':counts,'weights':weights,'correlations':corr,'scenarios':sensitivity},indent=2))

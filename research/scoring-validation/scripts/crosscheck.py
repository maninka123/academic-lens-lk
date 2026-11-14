"""Compare every Python reconstruction with the bundled production TypeScript."""
import contextlib,io,json,sys
from pathlib import Path
with contextlib.redirect_stdout(io.StringIO()):
 import analyze
live=json.loads(Path(sys.argv[1]).read_text()); base=analyze.base
mismatches=0; checked=0
for r in analyze.data:
 k=r['row']; p=base.get(k); actual=live[k]; expected={'score':p['score'],'basis':p['basis'],'level':p['level']} if p else {'score':None,'basis':'none','level':'none'}
 checked+=1
 if actual!=expected:mismatches+=1
result={'profiles_checked':checked,'score_basis_level_mismatches':mismatches}
(analyze.P/'production_crosscheck.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
if mismatches:raise SystemExit('Production score cross-check failed')

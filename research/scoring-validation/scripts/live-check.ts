// Cross-check against the actual production function; individual output stays in /tmp.
import fs from 'node:fs';
import Papa from 'papaparse';
import { standingScore } from '../../../src/analytics/standing-score';
import type { Academic } from '../../../src/types';
const file=process.argv[2], output=process.argv[3];
const raw=Papa.parse<Record<string,string>>(fs.readFileSync(file,'utf8'),{header:true,skipEmptyLines:true}).data;
const metrics=['hIndex','recentCitations','publications'] as const;
const people=raw.map(r=>{const x:any={id:r.row,name:'',rank:r.rank,field:r.field,scholarStatus:r.verified==='1'?'verified_official_link':'',researchgateStatus:'',openAlexUrl:'',metricsSource:'',metricEvidence:[]};for(const m of metrics){x[m]=r[m]===''?null:Number(r[m]);if(x[m]!==null)x.metricEvidence.push({metric:m,source:r[m+'Provider']})}return x as Academic});
const out=Object.fromEntries(people.map(p=>{const v=standingScore(p,people);return [p.id,{score:v.score,basis:v.basis,level:({ 'discipline-stage':'both','discipline':'field','everyone':'all','stage':'stage','none':'none' } as const)[v.level]}]}));
fs.writeFileSync(output,JSON.stringify(out));

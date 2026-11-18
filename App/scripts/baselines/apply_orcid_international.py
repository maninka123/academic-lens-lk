"""Record an international benchmark academic's OpenAlex author found through the ORCID iD on their own official staff page.

    python scripts/baselines/apply_orcid_international.py --university unisc --name "Tianwa Chen" --orcid 0000-0002-5135-0313 --source https://www.usc.edu.au/people/dr-tianwa-chen

The ORCID iD must resolve to an OpenAlex author whose name is compatible with the published name (build rule).
"""
import argparse, datetime, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi
import coauthor_international as ci

ap = argparse.ArgumentParser()
for k in ("university", "name", "orcid", "source"):
    ap.add_argument("--" + k, required=True)
ap.add_argument("--allow-middle-name", action="store_true", help="accept an extra middle name when first and last names are identical")
a = ap.parse_args()
BASE = ci.BASE
files = list(BASE.glob(f"*/universities/{a.university}/faculties/**/academics.csv"))
by_file = {f: ci.read(f) for f in files}
people = [r for rs in by_file.values() for r in rs]
author = oa._get("/authors/orcid:" + a.orcid, {"select": oa.SELECT})
def first_last(n):
    t = bi.name_key(n)
    return (t[0], t[-1]) if len(t) >= 2 else None
if not ci.hits_for(a.name, [author]) and not (a.allow_middle_name and first_last(a.name) == first_last(author["display_name"])):
    sys.exit(f"ORCID resolves to '{author.get('display_name')}', which is not name-compatible with '{a.name}'.")
mrow = {m["academic_id"]: m for m in ci.read(BASE / "openalex_matches.csv")}
target = [r for r in people if r["full_name"] == a.name and "matched" not in r["research_lookup_status"]]
if len(target) != 1:
    sys.exit(f"Expected one unresolved person named {a.name}, found {len(target)}.")
r = target[0]
mt = bi.metrics(author)
r.update({k: str(v) for k, v in mt.items()})
r["research_lookup_status"] = "openalex_matched_official_orcid"
r["research_metrics_source"] = "OpenAlex"; r["metrics_source_url"] = author["id"]
r["notes"] = (r.get("notes", "") + f" OpenAlex author found through the ORCID iD {a.orcid} on the person's own official staff page ({a.source}, {datetime.date.today().isoformat()}).").strip()
m = mrow[r["academic_id"]]
m.update(openalex_id=author["id"], openalex_display_name=author["display_name"], works_count=author["works_count"], cited_by_count=author["cited_by_count"],
         h_index=(author.get("summary_stats") or {}).get("h_index", ""), status="openalex_matched_official_orcid")
for f, rs in by_file.items():
    ci.write(f, rs)
ci.write(BASE / "openalex_matches.csv", list(mrow.values()))
print("recorded", a.name, "->", author["id"], author["display_name"], mt)

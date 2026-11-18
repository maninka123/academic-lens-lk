"""Record a maintainer's choice of OpenAlex author for an international benchmark academic.

    python scripts/baselines/apply_curator_choice.py --university cdu --name "Md Rafiqul Islam" --author A5088820799

The author must be among the cached name-compatible candidates for that person (nothing is invented). The choice
is stored with status `openalex_matched_curator_confirmed`; metrics come from the OpenAlex author record.
"""
import argparse, datetime, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi
import coauthor_international as ci

ap = argparse.ArgumentParser()
ap.add_argument("--university", required=True); ap.add_argument("--name", required=True); ap.add_argument("--author", required=True)
ap.add_argument("--override-name", action="store_true", help="maintainer override when the published name differs (a nickname, one name only); the author must be affiliated with the university in OpenAlex")
a = ap.parse_args()
oa.CACHE_ONLY = True
BASE = ci.BASE
files = list(BASE.glob(f"*/universities/{a.university}/faculties/**/academics.csv"))
by_file = {f: ci.read(f) for f in files}
people = [r for rs in by_file.values() for r in rs]
cands = oa.authors(bi.INST[a.university], [r["full_name"] for r in people])
author = next((c for c in ci.hits_for(a.name, cands) if c["id"].endswith(a.author)), None)
if not author and a.override_name:
    oa.CACHE_ONLY = False
    author = oa._get("/authors/" + a.author, {"select": oa.SELECT})
    affs = {x["institution"]["id"].split("/")[-1] for x in (author.get("affiliations") or [])}
    if not affs & set(bi.INST[a.university]):
        sys.exit("Override refused: that author has no OpenAlex affiliation with this university.")
if not author:
    sys.exit("That author is not a cached, name-compatible candidate for this person.")
matches = ci.read(BASE / "openalex_matches.csv")
mrow = {m["academic_id"]: m for m in matches}
target = [r for r in people if r["full_name"] == a.name and mrow.get(r["academic_id"], {}).get("status") != "openalex_matched_name_and_institution"]
if len(target) != 1:
    sys.exit(f"Expected one unresolved person named {a.name}, found {len(target)}.")
r = target[0]
mt = bi.metrics(author)
r.update({k: str(v) for k, v in mt.items()})
r["research_lookup_status"] = "openalex_matched_curator_confirmed"
r["research_metrics_source"] = "OpenAlex"
r["metrics_source_url"] = author["id"]
how = "chosen by the maintainer despite a different published name (maintainer override)" if a.override_name else "chosen by the maintainer from the name-compatible candidates"
r["notes"] = (r.get("notes", "") + f" OpenAlex author {how} ({datetime.date.today().isoformat()}).").strip()
m = mrow[r["academic_id"]]
m.update(openalex_id=author["id"], openalex_display_name=author["display_name"], works_count=author["works_count"], cited_by_count=author["cited_by_count"],
         h_index=(author.get("summary_stats") or {}).get("h_index", ""), status="openalex_matched_curator_confirmed")
for f, rs in by_file.items():
    ci.write(f, rs)
ci.write(BASE / "openalex_matches.csv", list(mrow.values()))
print("recorded", a.name, "->", author["id"], mt)

"""Apply imported curator decisions (decisions.csv) to the identity matches and the OpenAlex lookup file.

The resolver deliberately skips people with a manual decision, so this applies them: the chosen author is fetched
from OpenAlex, its metrics are stored, and the match is staged `confirmed` with publication_status `pending`.
Publication still needs `review_openalex.py approve`.

    python scripts/research/apply_curator_decisions.py --ids SL-... SL-... [--network]
"""
import argparse, datetime, json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "App/scripts/baselines")); sys.path.insert(0, str(ROOT / "App/scripts/research"))
import openalex as oa
from matching import ACCEPTED, author_metrics
from resolve_openalex import DATA, PRIVATE, MATCHES, FIELDS, read, write

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("--ids", nargs="+", required=True); ap.add_argument("--network", action="store_true")
a = ap.parse_args()
oa.CACHE_ONLY = not a.network
today = datetime.date.today().isoformat()
decisions = {}
for d in read(PRIVATE / "decisions.csv"):
    if d["match_status"] in ACCEPTED:
        decisions[d["academic_id"]] = d  # latest wins
matches = {r["academic_id"]: r for r in read(MATCHES)}
lookup_path = DATA / "international/sri_lanka_openalex_metrics.csv"
lookups = {r["academic_id"]: r for r in read(lookup_path)}
people = {}
for f in (DATA / "universities").rglob("academics.csv"):
    for r in read(f):
        people[r["academic_id"]] = r
unis = {r["name"]: r["id"] for r in read(DATA / "universities.csv")}
for aid in a.ids:
    d = decisions.get(aid)
    if not d:
        print("no accepted decision for", aid); continue
    author = oa._get("/authors/" + d["candidate_author_id"].split("/")[-1], {"select": oa.SELECT})
    m = author_metrics(author)
    matches[aid] = dict(academic_id=aid, provider="OpenAlex", candidate_author_id=author["id"], match_status=d["match_status"], match_method="manual_curator_decision",
                        evidence=json.dumps({"curator_decision": True, "reason": d["reason"], "supporting_urls": d["supporting_urls"]}), review_status="manual",
                        reviewed_at=d["reviewed_at"][:10], matched_at=today, publication_status="pending")
    p = people[aid]
    lookups[aid] = dict(academic_id=aid, university_id=unis.get(p["university"].replace(" (SLIIT)", ""), ""), full_name=p["full_name"], openalex_id=author["id"],
                        openalex_display_name=author["display_name"], status="openalex_matched_" + d["match_status"], candidates=1, checked_at=today,
                        **{k: m.get(k, "") for k in ["total_publications", "total_citations", "h_index", "citations_2021_2025"]})
    print("staged", p["full_name"], "->", author["id"], m)
write(MATCHES, list(matches.values()), FIELDS)
write(lookup_path, list(lookups.values()))

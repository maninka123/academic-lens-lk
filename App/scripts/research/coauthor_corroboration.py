"""Corroborate ambiguous OpenAlex candidates through co-authors who are already verified.

A candidate is staged only when ALL hold, so a name alone is never enough:
  1. the published name is compatible with the candidate's name;
  2. the candidate is affiliated with the person's own institution in OpenAlex;
  3. the candidate shares at least MIN_SHARED works with authors who are already verified
     (official ORCID/OpenAlex link or two official DOIs) at that same institution;
  4. no other candidate for the same person meets 1-3 (otherwise it stays ambiguous).
Matches are staged as `corroborated` with publication_status `pending`; a curator approves them separately.

    python scripts/research/coauthor_corroboration.py --university moratuwa --field "Computer Science" [--network]
"""
import argparse, csv, datetime, json, pathlib, re, sys, collections
ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "App/scripts/baselines")); sys.path.insert(0, str(ROOT / "App/scripts/research"))
import openalex as oa
from matching import ACCEPTED, author_metrics
from resolve_openalex import DATA, PRIVATE, MATCHES, FIELDS, read, write
from sri_lanka_openalex import SL_INST

MIN_SHARED = 3
TODAY = datetime.date.today().isoformat()


def in_field(r, field):
    unit = f"{r['department']} {r['faculty']}"
    if field == "Computer Science":
        return bool(re.search(r"comput|information technology|software|data science|\bIT\b|informatics", unit, re.I))
    if field == "Physics":
        return bool(re.search("physics", r["department"], re.I))
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--university", required=True)
    ap.add_argument("--field", default="Computer Science")
    ap.add_argument("--network", action="store_true")
    a = ap.parse_args()
    oa.CACHE_ONLY = not a.network
    uid = a.university
    people = {}
    for f in (DATA / "universities" / uid).rglob("academics.csv"):
        for r in read(f):
            people[r["academic_id"]] = r
    lookups = {r["academic_id"]: r for r in read(DATA / "international/sri_lanka_openalex_metrics.csv")}
    matches = {r["academic_id"]: r for r in read(MATCHES)}
    verified = {l["openalex_id"] for i, l in lookups.items() if i in people and l.get("openalex_id") and re.search(r"(^|_)matched(_|$)", l.get("status", ""))
                and matches.get(i, {}).get("publication_status") == "approved" and matches[i]["match_status"] in ACCEPTED}
    print(f"{len(verified)} verified colleagues at {uid}", flush=True)
    cands = json.loads((PRIVATE / "candidates.json").read_text())
    by = collections.defaultdict(list)
    for c in cands:
        ev = c["evidence"]
        if c["academic_id"] in people and in_field(people[c["academic_id"]], a.field) and ev.get("name_compatible") and ev.get("institution_compatible") \
           and not ev.get("conflicting_evidence") and lookups.get(c["academic_id"], {}).get("openalex_id", "") == "":
            by[c["academic_id"]].append(c)
    staged = []
    for aid, items in by.items():
        if len(items) > 4:
            continue  # too many same-name candidates to adjudicate by co-authors alone
        passing = []
        for c in items:
            work_pages = oa._get("/works", {"filter": "author.id:" + c["candidate_author_id"].split("/")[-1], "per-page": 200, "select": "id,authorships"})
            shared = sum(1 for w in work_pages.get("results", [])
                         if any(x.get("author", {}).get("id") in verified for x in w.get("authorships", [])))
            if shared >= MIN_SHARED:
                passing.append((c, shared))
        if len(passing) == 1:
            staged.append((aid, *passing[0]))
    print(f"{len(staged)} candidates pass the co-author test", flush=True)
    rows = list(matches.values())
    log = []
    for aid, c, shared in staged:
        a_id = c["candidate_author_id"]
        ev = dict(c["evidence"]); ev["shared_works_with_verified_colleagues"] = shared; ev["verified_colleagues_at_institution"] = len(verified)
        row = dict(academic_id=aid, provider="OpenAlex", candidate_author_id=a_id, match_status="corroborated", match_method="coauthors_with_verified_colleagues",
                   evidence=json.dumps(ev), review_status="automatic", reviewed_at="", matched_at=TODAY, publication_status="pending")
        matches[aid] = row
        m = c["metadata"]
        lookups[aid] = dict(academic_id=aid, university_id=uid, full_name=people[aid]["full_name"], openalex_id=a_id, openalex_display_name=c["candidate_name"],
                            status="openalex_matched_corroborated", candidates=len(by[aid]), checked_at=TODAY,
                            **{k: m.get(k, "") for k in ["total_publications", "total_citations", "h_index", "citations_2021_2025"]})
        log.append(dict(academic_id=aid, status="staged_coauthor_corroboration", shared=shared, checked_at=TODAY))
    write(MATCHES, list(matches.values()), FIELDS)
    write(DATA / "international/sri_lanka_openalex_metrics.csv", list(lookups.values()))
    with (PRIVATE / "attempts.jsonl").open("a") as f:
        for x in log:
            f.write(json.dumps(x) + "\n")
    print("staged:", [(aid, shared) for aid, _, shared in staged])


if __name__ == "__main__":
    main()

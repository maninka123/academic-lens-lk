"""Corroborate ambiguous OpenAlex matches of international benchmark academics through verified co-authors.

For a roster person flagged `openalex_multiple_candidates_requires_review`, a candidate is accepted only if
it is name-compatible (same rule as the build), affiliated with the person's institution, shares at least
MIN_SHARED works with already uniquely matched colleagues at that institution, and is the only candidate that does.
Everything else stays unresolved. Candidate lists come from the cached per-university author query.

    python scripts/baselines/coauthor_international.py --universities pku tsinghua [--network] [--budget 120]
"""
import argparse, csv, datetime, io, json, re, sys, collections
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "Data" / "Lanka-Academia" / "international"
MIN_SHARED = 3
TODAY = datetime.date.today().isoformat()


def hits_for(person_name, cands):
    """Name-compatible candidates, using the build's rule (not its ranking)."""
    pt = bi.name_key(person_name)
    if len(pt) < 2:
        return []
    pfirst, plast = pt[0], pt[-1]
    out = []
    for a in cands:
        primary = bi.name_key(a["display_name"])
        if [t for t in primary if t not in pt and len(t) > 1 and not any(t in q or q in t for q in pt)] and "".join(primary) != "".join(pt):
            continue
        for n in [a["display_name"]] + (a.get("display_name_alternatives") or []):
            at = bi.name_key(n)
            if len(at) < 2:
                continue
            same_last = at[-1] == plast or at[0] == plast and at[-1] == pfirst
            first_ok = at[0] == pfirst or (len(at[0]) == 1 and at[0] == pfirst[0]) or at[0][0] == pfirst[0] and (at[0].startswith(pfirst) or pfirst.startswith(at[0]))
            extra = [t for t in at if t not in pt and len(t) > 1 and not any(t in q or q in t for q in pt)]
            if extra and "".join(at) != "".join(pt):
                continue
            if (same_last and first_ok) or "".join(at) == "".join(pt) or sorted(at) == sorted(pt):
                out.append(a)
                break
    return out


def read(path):
    return list(csv.DictReader(open(path, encoding="utf-8-sig", newline="")))


def write(path, rows):
    fields = list(rows[0].keys()) if rows else []
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        w.writeheader(); w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--universities", nargs="+", required=True)
    ap.add_argument("--network", action="store_true")
    ap.add_argument("--budget", type=int, default=120, help="stop after this many uncached API requests")
    a = ap.parse_args()
    oa.CACHE_ONLY = not a.network
    calls = {"n": 0}
    orig = oa._get
    def counted(path, params, refresh=False):
        import hashlib
        key = hashlib.sha1((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()
        if not (oa.CACHE / f"{key}.json").exists():
            if calls["n"] >= a.budget:
                raise oa.BudgetExhausted("request budget for this run used")
            calls["n"] += 1
        return orig(path, params, refresh)
    oa._get = counted
    matches = read(BASE / "openalex_matches.csv")
    mrow = {m["academic_id"]: m for m in matches}
    summary = {}
    for uid in a.universities:
        files = list(BASE.glob(f"*/universities/{uid}/faculties/**/academics.csv"))
        rows_by_file = {f: read(f) for f in files}
        people = [r for rs in rows_by_file.values() for r in rs]
        colleagues = {mrow[r["academic_id"]]["openalex_id"] for r in people
                      if r["academic_id"] in mrow and mrow[r["academic_id"]]["status"] == "openalex_matched_name_and_institution" and mrow[r["academic_id"]]["openalex_id"]}
        names = [r["full_name"] for r in people]
        try:
            cands = oa.authors(bi.INST[uid], names)
        except oa.BudgetExhausted as e:
            print(uid, "no cached candidate list:", e); continue
        accepted = []
        for r in people:
            m = mrow.get(r["academic_id"])
            if not m or m["status"] != "openalex_multiple_candidates_requires_review":
                continue
            hits = hits_for(r["full_name"], cands)
            if not hits or len(hits) > 5:
                continue
            passing = []
            try:
                for h in hits:
                    works = oa._get("/works", {"filter": "author.id:" + h["id"].split("/")[-1], "per-page": 200, "select": "id,authorships"})
                    shared = sum(1 for w in works.get("results", []) if any(x.get("author", {}).get("id") in colleagues - {h["id"]} for x in w.get("authorships", [])))
                    if shared >= MIN_SHARED:
                        passing.append((h, shared))
            except oa.BudgetExhausted as e:
                print(uid, "stopped:", e); break
            if len(passing) == 1 and passing[0][0]["works_count"] <= 1500:
                accepted.append((r, *passing[0]))
        for r, h, shared in accepted:
            mt = bi.metrics(h)
            r.update({k: str(v) for k, v in mt.items()})
            r["research_lookup_status"] = "openalex_matched_coauthor_corroborated"
            r["research_metrics_source"] = "OpenAlex"
            r["metrics_source_url"] = h["id"]
            r["notes"] = (r.get("notes", "") + f" OpenAlex author corroborated by {shared} works shared with matched colleagues at the same institution.").strip()
            m = mrow[r["academic_id"]]
            m.update(openalex_id=h["id"], openalex_display_name=h["display_name"], works_count=h["works_count"], cited_by_count=h["cited_by_count"],
                     h_index=(h.get("summary_stats") or {}).get("h_index", ""), status="openalex_matched_coauthor_corroborated")
        for f, rs in rows_by_file.items():
            write(f, rs)
        summary[uid] = len(accepted)
        print(uid, "accepted", len(accepted), "| requests used so far", calls["n"], flush=True)
    write(BASE / "openalex_matches.csv", list(mrow.values()))
    print(json.dumps(summary), "| uncached requests:", calls["n"])


if __name__ == "__main__":
    main()

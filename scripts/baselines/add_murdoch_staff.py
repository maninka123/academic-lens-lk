"""Extend the Murdoch School of Information Technology sample with the staff listed on the school's 'our people' page.

The earlier roster kept only people whose rank (Professor / Associate Professor) was stated. The page also lists
people titled "Dr" (an academic title); they are eligible too. Adjunct, honorary, emeritus and untitled staff
(possible professional staff) are not. The sample follows the benchmark rule: systematic in directory order, at most 25.
OpenAlex matching uses the build's name-and-institution rule; nothing is guessed.

    python scripts/baselines/add_murdoch_staff.py [--network]
"""
import argparse, csv, hashlib, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi

ROOT = Path(__file__).resolve().parents[2]
INTL = ROOT / "Data files" / "international"
SOURCE = "https://www.murdoch.edu.au/schools/information-technology/about/our-people"
# Page order. (name, position, profile url or "")
PAGE = [
    ("Shikha Anirban", "Dr"), ("Keyvan Ansari", "Dr"), ("Samantha Bax", "Dr"), ("Thao Duong", "Dr"), ("A S M Hasan", "Dr"),
    ("Robert Herne", "Dr"), ("Umera Imtinan", "Dr"), ("Mohammed Kaosar", "Dr"), ("Polychronis Koutsakis", "Associate Professor"),
    ("Hamid Laga", "Professor"), ("Sirui Li", "Dr"), ("Hongen Lu", "Dr"), ("Florence Mwagwabi", "Dr"), ("David Murray", "Associate Professor"),
    ("Fatuma Namisango", "Dr"), ("Brianna O'Shea", "Dr"), ("Joo Yeon Park", "Dr"), ("David Parry", "Professor"), ("Megan Pusey", "Dr"),
    ("Fatemeh Rezaeibagha", "Dr"), ("Sayma Shammi", "Dr"), ("Mohd. Fairuz Shiratuddin", "Associate Professor"), ("Joe Stevens", "Dr"),
    ("Ferdous Sohel", "Professor"), ("Guanjin (Brenda) Wang", "Associate Professor"), ("Kevin Wong", "Professor"), ("Hong Xie", "Dr"),
    ("Xiaofei Xu", "Dr"), ("Sebastian Zander", "Dr"),
]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--network", action="store_true"); a = ap.parse_args()
    oa.CACHE_ONLY = not a.network
    dept_dir = next((INTL / "australia/universities/murdoch/faculties").glob("*/departments/school-of-information-technology"))
    path = dept_dir / "academics.csv"
    old = list(csv.DictReader(open(path, encoding="utf-8-sig", newline="")))
    old_by_name = {r["full_name"]: r for r in old}
    roster_old = {l.split("|")[0].strip(): [x.strip() for x in l.split("|")] for l in (INTL / "_source_rosters/murdoch__cs.txt").read_text().splitlines() if l and not l.startswith("#")}
    entries = []
    for name, pos in PAGE:
        prev = roster_old.get(name)
        entries.append(dict(name=name, position=prev[1] if prev else pos, url=prev[2] if prev and len(prev) > 2 else SOURCE, extra="", scholar="", phd="", native=""))
    sample = bi.systematic(entries)
    cfg = next(u for u in bi.CFG["universities"] if u["id"] == "murdoch")
    faculty, department = cfg["departments"]["cs"]
    head = "source: " + SOURCE + " (people titled Professor, Associate Professor or Dr; adjunct, honorary, emeritus and untitled staff excluded; systematic sample in page order, at most 25)"
    (INTL / "_source_rosters/murdoch__cs.txt").write_text("# " + head + "\n" + "\n".join(f"{e['name']} | {e['position']} | {e['url']} |  |  |  | " for e in entries) + "\n", encoding="utf-8")
    new_names = [e["name"] for e in sample if e["name"] not in old_by_name]
    cands = oa.authors(bi.INST["murdoch"], [e["name"] for e in entries] + [r["full_name"] for p in (INTL / "australia/universities/murdoch/faculties").glob("*/departments/*/academics.csv") for r in csv.DictReader(open(p, encoding="utf-8-sig"))])
    rows, matches = [], {m["academic_id"]: m for m in csv.DictReader(open(INTL / "openalex_matches.csv", encoding="utf-8-sig"))}
    for e in sample:
        if e["name"] in old_by_name:
            rows.append(old_by_name[e["name"]]); continue
        aid = "INT-" + hashlib.sha1(f"murdoch|cs|{e['name']}".encode()).hexdigest()[:12]
        row = {h: "" for h in bi.HEADER}
        row.update(academic_id=aid, full_name=e["name"], university="Murdoch University", faculty=faculty, department=department,
                   academic_position=e["position"], staff_profile_url=e["url"], collected_at="2026-11-15",
                   employment_status="listed_in_official_directory", record_status="baseline_sample_official_directory",
                   phd_status="not_published_or_not_extracted")
        notes = [f"International baseline ({cfg['tier']} tier, QS 2027 {cfg['qs_rank_2027']}); systematic sample of the official directory. Added 2026-11-15 from the school's people page (Dr titled staff; rank not stated)."]
        au, status, n = bi.match(e, cands)
        row["research_lookup_status"] = status
        if au:
            row.update({k: str(v) for k, v in bi.metrics(au).items()})
            row["research_metrics_source"] = "OpenAlex"; row["metrics_source_url"] = au["id"]
            notes.append("OpenAlex metrics (works, citations, h-index, 2021-2025 citations from counts_by_year); not comparable 1:1 with Google Scholar values.")
        row["notes"] = " ".join(notes)
        rows.append(row)
        matches[aid] = dict(academic_id=aid, university_id="murdoch", full_name=e["name"], openalex_id=au["id"] if au else "", openalex_display_name=au["display_name"] if au else "",
                            works_count=au["works_count"] if au else "", cited_by_count=au["cited_by_count"] if au else "",
                            h_index=(au.get("summary_stats") or {}).get("h_index", "") if au else "", candidates=n, status=status)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=bi.HEADER, lineterminator="\n"); w.writeheader(); w.writerows(rows)
    mrows = list(matches.values())
    with open(INTL / "openalex_matches.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()), extrasaction="ignore", lineterminator="\n"); w.writeheader(); w.writerows(mrows)
    # departments.csv and faculties.csv counts
    dpath = INTL / "departments.csv"
    drows = list(csv.DictReader(open(dpath, encoding="utf-8-sig")))
    for d in drows:
        if d["university_id"] == "murdoch" and d["field"] == "Computer Science":
            d["roster_eligible"] = str(len(entries)); d["sampled"] = str(len(sample)); d["source_note"] = head
    with open(dpath, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(drows[0].keys()), lineterminator="\n"); w.writeheader(); w.writerows(drows)
    ok = [r for r in rows if "matched" in r["research_lookup_status"]]
    print(f"sampled {len(sample)} of {len(entries)} eligible; new {len(new_names)}; matched with metrics {len(ok)}")


if __name__ == "__main__":
    main()

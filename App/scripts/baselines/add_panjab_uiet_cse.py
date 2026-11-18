"""Add the Panjab University UIET Computer Science and Engineering department to the Panjab Computer Science group.

The Department of Computer Science and Applications lists only 10 academics, so the group cannot exceed the
minimum of 10 valid profiles. UIET CSE is a second computing department of the same university.
Sample rule, fixed in advance and independent of OpenAlex results: 6 people, systematic in page order from the
17 distinct academics listed at https://uiet.puchd.ac.in/?page_id=57 (a repeated co-ordinator entry counted once).

    python scripts/baselines/add_panjab_uiet_cse.py
"""
import csv, hashlib, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi

ROOT = Path(__file__).resolve().parents[3]
INTL = ROOT / "Data" / "Lanka-Academia" / "international"
SOURCE = "https://uiet.puchd.ac.in/?page_id=57"
FACULTY = "University Institute of Engineering and Technology (UIET)"
DEPT = "Department of Computer Science and Engineering (UIET)"
PAGE = [("Sarbjeet Singh", "Professor; Co-ordinator"), ("Savita Gupta", "Professor"), ("Sukhwinder Singh", "Professor"), ("Harish Kumar", "Professor"),
        ("Sakshi Kaushal", "Professor"), ("Naveen Aggarwal", "Professor"), ("Ajay Mittal", "Professor"), ("Mukesh Kumar", "Professor"),
        ("Vishal Gupta", "Professor"), ("Akashdeep", "Professor"), ("Mamta Juneja", "Professor"), ("Makhan Singh", "Professor"),
        ("Nirmal Kaur", "Associate Professor"), ("Rohit Kumar", "Assistant Professor"), ("Ravreet Kaur", "Assistant Professor"),
        ("Preeti Aggarwal", "Assistant Professor"), ("Deepti Gupta", "Assistant Professor")]
entries = [dict(name=n, position=p, url=SOURCE, extra="", scholar="", phd="", native="") for n, p in PAGE]
sample = bi.systematic(entries, 6)
oa.CACHE_ONLY = False
cfg = next(u for u in bi.CFG["universities"] if u["id"] == "panjab")
cands = oa.authors(bi.INST["panjab"], [e["name"] for e in entries])
matches = {m["academic_id"]: m for m in csv.DictReader(open(INTL / "openalex_matches.csv", encoding="utf-8-sig"))}
rows = []
for e in sample:
    aid = "INT-" + hashlib.sha1(f"panjab|uiet-cse|{e['name']}".encode()).hexdigest()[:12]
    row = {h: "" for h in bi.HEADER}
    row.update(academic_id=aid, full_name=e["name"], university="Panjab University", faculty=FACULTY, department=DEPT, academic_position=e["position"],
               staff_profile_url=SOURCE, collected_at="2026-11-15", employment_status="listed_in_official_directory",
               record_status="baseline_sample_official_directory", phd_status="not_published_or_not_extracted")
    notes = [f"International baseline ({cfg['tier']} tier, QS 2027 {cfg['qs_rank_2027']}); systematic sample (6 of 17) of the UIET Computer Science and Engineering faculty page, 2026-11-15."]
    au, status, n = bi.match(e, cands)
    row["research_lookup_status"] = status
    if au:
        row.update({k: str(v) for k, v in bi.metrics(au).items()}); row["research_metrics_source"] = "OpenAlex"; row["metrics_source_url"] = au["id"]
        notes.append("OpenAlex metrics (works, citations, h-index, 2021-2025 citations from counts_by_year); not comparable 1:1 with Google Scholar values.")
    row["notes"] = " ".join(notes)
    rows.append(row)
    matches[aid] = dict(academic_id=aid, university_id="panjab", full_name=e["name"], openalex_id=au["id"] if au else "", openalex_display_name=au["display_name"] if au else "",
                        works_count=au["works_count"] if au else "", cited_by_count=au["cited_by_count"] if au else "",
                        h_index=(au.get("summary_stats") or {}).get("h_index", "") if au else "", candidates=n, status=status)
d = INTL / "india/universities/panjab/faculties/university-institute-of-engineering-and-technology-uiet/departments/department-of-computer-science-and-engineering-uiet"
d.mkdir(parents=True, exist_ok=True)
with open(d / "academics.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=bi.HEADER, lineterminator="\n"); w.writeheader(); w.writerows(rows)
mrows = list(matches.values())
with open(INTL / "openalex_matches.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()), extrasaction="ignore", lineterminator="\n"); w.writeheader(); w.writerows(mrows)
(INTL / "_source_rosters/panjab__cs_uiet.txt").write_text("# source: " + SOURCE + " (UIET CSE faculty page; 17 distinct academics; systematic sample of 6 in page order)\n" +
    "\n".join(f"{e['name']} | {e['position']} | {SOURCE} |  |  |  | " for e in entries) + "\n", encoding="utf-8")
dp = INTL / "departments.csv"
drows = list(csv.DictReader(open(dp, encoding="utf-8-sig")))
drows.append(dict(university_id="panjab", country="India", tier="lower", faculty=FACULTY, department=DEPT, field="Computer Science",
                  roster_file="_source_rosters/panjab__cs_uiet.txt", roster_eligible=str(len(entries)), sampled=str(len(sample)),
                  source_note="source: " + SOURCE + " (17 distinct academics; systematic sample of 6 in page order)"))
with open(dp, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(drows[0].keys()), lineterminator="\n"); w.writeheader(); w.writerows(drows)
for r in rows: print(r["full_name"], "|", r["research_lookup_status"], "|", r["metrics_source_url"])

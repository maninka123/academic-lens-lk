"""Re-sample the Ningbo University Computer Science sample with the benchmark's documented rule.

The roster page lists 42 teaching staff (41 academics; one research librarian is excluded). The rule samples
systematically in directory order, at most 25; the earlier sample took every third person (14). People who leave the
sample are kept in the private `Data/_research_reviews/ningbo_cs_previous_sample.csv`, nothing is deleted.
New people get OpenAlex values only through the build's name-and-institution rule; ambiguous ones stay blank.

    python scripts/baselines/resample_ningbo_cs.py --elig /tmp/ningbo_elig.json   (json from the roster page)
"""
import argparse, csv, hashlib, json, re, sys, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import openalex as oa
import build_international as bi

ROOT = Path(__file__).resolve().parents[3]
INTL = ROOT / "Data" / "Lanka-Academia" / "international"
ap = argparse.ArgumentParser(); ap.add_argument("--elig", required=True); a = ap.parse_args()
elig = json.load(open(a.elig))
sample = bi.systematic(elig)
dept_dir = next((INTL / "china/universities/ningbo/faculties").glob("*/departments/department-of-computer-science-and-technology"))
path = dept_dir / "academics.csv"
old = list(csv.DictReader(open(path, encoding="utf-8-sig", newline="")))
old_by = {r["full_name"]: r for r in old}
keep = {p["name"] for p in sample}
dropped = [r for r in old if r["full_name"] not in keep]
priv = ROOT / "Data/Lanka-Academia/_research_reviews/ningbo_cs_previous_sample.csv"
priv.parent.mkdir(parents=True, exist_ok=True)
with open(priv, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=bi.HEADER, lineterminator="\n"); w.writeheader(); w.writerows(old)
cfg = next(u for u in bi.CFG["universities"] if u["id"] == "ningbo")
faculty, department = cfg["departments"]["cs"]
oa.CACHE_ONLY = False
cands = oa.authors(bi.INST["ningbo"], [p["name"] for p in elig])
matches = {m["academic_id"]: m for m in csv.DictReader(open(INTL / "openalex_matches.csv", encoding="utf-8-sig"))}
rows = []
for p in sample:
    if p["name"] in old_by:
        rows.append(old_by[p["name"]]); continue
    aid = "INT-" + hashlib.sha1(f"ningbo|cs|{p['name']}".encode()).hexdigest()[:12]
    row = {h: "" for h in bi.HEADER}
    row.update(academic_id=aid, full_name=p["name"], university="Ningbo University", faculty=faculty, department=department, academic_position=p["rank"],
               staff_profile_url=p["url"], collected_at="2026-11-15", employment_status="listed_in_official_directory",
               record_status="baseline_sample_official_directory", phd_status="not_published_or_not_extracted")
    notes = [f"International baseline ({cfg['tier']} tier, QS 2027 {cfg['qs_rank_2027']}); systematic sample of the official directory (25 of 41 academics, 2026-11-15).",
             f"Native-script name: {p['cn']}; romanised with pypinyin."]
    au, status, n = bi.match(dict(name=p["name"]), cands)
    row["research_lookup_status"] = status
    if au:
        row.update({k: str(v) for k, v in bi.metrics(au).items()}); row["research_metrics_source"] = "OpenAlex"; row["metrics_source_url"] = au["id"]
        notes.append("OpenAlex metrics (works, citations, h-index, 2021-2025 citations from counts_by_year); not comparable 1:1 with Google Scholar values.")
    row["notes"] = " ".join(notes)
    rows.append(row)
    matches[aid] = dict(academic_id=aid, university_id="ningbo", full_name=p["name"], openalex_id=au["id"] if au else "", openalex_display_name=au["display_name"] if au else "",
                        works_count=au["works_count"] if au else "", cited_by_count=au["cited_by_count"] if au else "",
                        h_index=(au.get("summary_stats") or {}).get("h_index", "") if au else "", candidates=n, status=status)
for r in dropped:
    matches.pop(r["academic_id"], None)
with open(path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=bi.HEADER, lineterminator="\n"); w.writeheader(); w.writerows(rows)
mrows = list(matches.values())
with open(INTL / "openalex_matches.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()), extrasaction="ignore", lineterminator="\n"); w.writeheader(); w.writerows(mrows)
head = "source: https://eecs.nbu.edu.cn/szdw/jsml.htm (Ningbo Univ. 计算机科学与技术系 teaching faculty = 42, of which 41 academics; systematic sample of 25 in page order, at most 25)"
(INTL / "_source_rosters/ningbo__cs.txt").write_text("# " + head + "\n" + "\n".join(f"{p['name']} | {p['rank']} | {p['url']} | 计算机科学与技术系 |  |  | {p['cn']}" for p in elig) + "\n", encoding="utf-8")
dp = INTL / "departments.csv"
drows = list(csv.DictReader(open(dp, encoding="utf-8-sig")))
for d in drows:
    if d["university_id"] == "ningbo" and d["field"] == "Computer Science":
        d["roster_eligible"] = str(len(elig)); d["sampled"] = str(len(sample)); d["source_note"] = head
with open(dp, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(drows[0].keys()), lineterminator="\n"); w.writeheader(); w.writerows(drows)
print(f"sampled {len(sample)} of {len(elig)}; kept {len(keep & set(old_by))}; moved to the private file {len(dropped)}; valid {sum('matched' in r['research_lookup_status'] for r in rows)}")

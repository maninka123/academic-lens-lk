"""OpenAlex lookups for international benchmark records added outside the builder.

Records collected later (e.g. the 2026-10-12 field expansion) carry
research_lookup_status = not_yet_verified. This script looks up only those rows,
using the same matching and metric rules as build_international.py, and updates
them in place. Other rows and files are left untouched. Re-runnable: responses
are cached and completed rows are skipped.
"""
import csv, glob, io, sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import openalex as oa
from build_international import INST, match, metrics

DATA = Path(__file__).resolve().parents[2] / "Data files" / "international"
PENDING = {"not_yet_verified", "openalex_pending"}


def read(f):
    raw = f.read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    return rows[0], rows[1:], ("\r\n" if "\r\n" in raw else "\n")


def main():
    files = defaultdict(list)  # university id -> [(file, row index)]
    tables = {}
    for f in map(Path, glob.glob(str(DATA / "*/universities/*/faculties/**/academics.csv"), recursive=True)):
        h, rows, nl = read(f)
        tables[f] = (h, rows, nl)
        uid = f.relative_to(DATA).parts[2]
        for i, r in enumerate(rows):
            if dict(zip(h, r)).get("research_lookup_status") in PENDING:
                files[uid].append((f, i))
    print(sum(map(len, files.values())), "pending records in", len(files), "universities")

    matches = list(csv.DictReader((DATA / "openalex_matches.csv").open(encoding="utf-8-sig")))
    dirty = set()
    for uid, refs in files.items():
        people = [dict(zip(tables[f][0], tables[f][1][i])) for f, i in refs]
        try:
            cands = oa.authors(INST[uid], [p["full_name"] for p in people])
        except oa.BudgetExhausted as e:
            print("OpenAlex budget exhausted at", uid, "- rerun later.", e)
            break
        found = 0
        for (f, i), p in zip(refs, people):
            h, rows, _ = tables[f]
            a, status, n = match({"name": p["full_name"]}, cands)
            p["research_lookup_status"] = status
            if a:
                found += 1
                p.update({k: str(v) for k, v in metrics(a).items()})
                p["research_metrics_source"] = "OpenAlex"
                p["metrics_source_url"] = a["id"]
                p["notes"] = (p["notes"] + " " if p["notes"] else "") + (
                    "OpenAlex metrics (works, citations, h-index, 2021-2025 citations from counts_by_year); "
                    "not comparable 1:1 with Google Scholar values.")
            rows[i] = [p.get(k, "") for k in h]
            dirty.add(f)
            matches = [m for m in matches if m["academic_id"] != p["academic_id"]]
            matches.append(dict(academic_id=p["academic_id"], university_id=uid, full_name=p["full_name"],
                                openalex_id=a["id"] if a else "", openalex_display_name=a["display_name"] if a else "",
                                works_count=a["works_count"] if a else "", cited_by_count=a["cited_by_count"] if a else "",
                                h_index=(a.get("summary_stats") or {}).get("h_index", "") if a else "",
                                candidates=n, status=status))
        print(f"{uid:12} {len(refs):3} looked up; {found:3} matched")

    for f in dirty:
        h, rows, nl = tables[f]
        o = io.StringIO()
        csv.writer(o, lineterminator=nl).writerows([h] + rows)
        f.write_text(o.getvalue(), encoding="utf-8-sig")
    if dirty:
        with (DATA / "openalex_matches.csv").open("w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=list(matches[0].keys()))
            w.writeheader()
            w.writerows(matches)


if __name__ == "__main__":
    main()

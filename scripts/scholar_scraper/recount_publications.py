#!/usr/bin/env python3
"""Re-count Google Scholar publications for people whose recorded total looks capped.

Selects people with a Google Scholar link whose total_publications is exactly 20 (one
page of "Show more") or 100, blanks that field in a temporary input, runs the enrichment
tool one person at a time (so a Scholar block only affects that person), and leaves the
results in scripts/New updates/newly_updated_academics.csv. Apply them afterwards with
  python3 scripts/apply_metric_updates.py "scripts/New updates/newly_updated_academics.csv"
Stops early when Google Scholar keeps refusing; run it again later to continue.
"""
import csv, glob, io, os, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SUSPECT = {"20", "100"}
MAX_CONSECUTIVE_FAILURES = 5


def load_targets():
    done = set()
    tracked = REPO / "scripts" / "New updates" / "recounted_ids.txt"
    if tracked.exists():
        done = set(tracked.read_text().split())
    reverted_file = REPO / "scripts" / "New updates" / "recount_ids.txt"
    reverted = set(reverted_file.read_text().split()) if reverted_file.exists() else set()
    rows, header = [], None
    for f in glob.glob(str(REPO / "Data files" / "universities" / "**" / "academics.csv"), recursive=True):
        text = open(f, encoding="utf-8-sig").read()
        reader = list(csv.DictReader(io.StringIO(text)))
        header = header or list(csv.DictReader(io.StringIO(text)).fieldnames)
        rows += [
            r for r in reader
            if r["google_scholar_url"] and r["academic_id"] not in done
            and (
                r["total_publications"] in SUSPECT  # one page of "Show more"
                or (r["h_index"] == "" and r["total_citations"] == "" and r["academic_id"] in reverted)  # all-zero read removed
            )
        ]
    return rows, header, tracked


def main():
    rows, header, tracked = load_targets()
    print(f"{len(rows)} people to re-count")
    failures = 0
    for i, r in enumerate(rows, 1):
        r = dict(r, total_publications="")
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "one.csv"
            with open(src, "w", encoding="utf-8", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=header)
                w.writeheader()
                w.writerow(r)
            try:
                out = subprocess.run(
                    [sys.executable, "enrich_academics.py", str(src), "--out", str(Path(tmp) / "out.csv"), "--limit", "2"],
                    cwd=HERE, capture_output=True, text=True, timeout=240,
                )
                ok = out.returncode == 0 and "citations=" in out.stdout
            except subprocess.TimeoutExpired:
                ok = False
        print(f"[{i}/{len(rows)}] {r['full_name']}: {'ok' if ok else 'failed'}", flush=True)
        if ok:
            failures = 0
            with open(tracked, "a") as fh:
                fh.write(r["academic_id"] + "\n")
        else:
            failures += 1
            if failures >= MAX_CONSECUTIVE_FAILURES:
                print("Google Scholar keeps refusing; stopping. Run again later.")
                return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

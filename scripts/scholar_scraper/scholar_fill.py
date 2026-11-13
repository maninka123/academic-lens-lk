#!/usr/bin/env python3
"""Scholar-link fill: for people who have a Google Scholar URL but no metrics. Resumable, slow, stops when Scholar blocks.
Usage: python3 scholar_fill.py todo.csv   (columns academic_id,full_name,google_scholar_url)"""
import csv, glob, os, random, sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.pop("SKIP_SCHOLAR", None)
import enrich_academics as ea
import openalex_scraper as oa
ROOT = HERE.parents[1]
OUT = ROOT / "scripts/New updates/scholar_fill_results.csv"
DONE = ROOT / "scripts/New updates/scholar_fill_done.txt"
todo = {r["academic_id"] for r in csv.DictReader(open(sys.argv[1], encoding="utf-8-sig"))}
done = set(DONE.read_text().split()) if DONE.exists() else set()
rows = []
for f in sorted(glob.glob(str(ROOT / "Data files/universities/**/academics.csv"), recursive=True)):
    for r in csv.DictReader(open(f, encoding="utf-8-sig")):
        if r["academic_id"] in todo and r["academic_id"] not in done:
            r["source_file_path"] = f; rows.append(r)
print(len(rows), "to read", flush=True)
client = oa.OpenAlexClient()
new = not OUT.exists()
out = OUT.open("a", encoding="utf-8-sig", newline="")
w = csv.DictWriter(out, fieldnames=ea.NEW_UPDATES_FIELDS, extrasaction="ignore")
if new: w.writeheader()
ok = fails = 0
for i, r in enumerate(rows):
    try:
        u = ea.enrich_record(r, client, use_scholar=True, use_openalex=False)
    except Exception as e:
        print("ERR", r["academic_id"], str(e)[:100], flush=True); fails += 1
        if fails >= 3: print("blocked; stopping"); break
        time.sleep(600); continue
    if u.get("platform") == "Google Scholar":
        w.writerow(u); out.flush(); ok += 1; fails = 0
    else:
        fails += 1
        print("no scholar data for", r["full_name"], flush=True)
        if fails >= 4: print("blocked; stopping"); break
        continue
    with DONE.open("a") as d: d.write(r["academic_id"] + "\n")
    print(i + 1, "of", len(rows), r["full_name"], flush=True)
    time.sleep(random.uniform(20, 40))
print("finished; read", ok)

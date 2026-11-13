#!/usr/bin/env python3
"""OpenAlex-only fill for people with no metrics. Resumable; one person at a time; never stops on one failure.
Writes scripts/New updates/oa_fill_results.csv (apply_metric_updates.py format) and oa_fill_done.txt.
Usage: python3 oa_fill_missing.py [--limit N] [--uni peradeniya]"""
import argparse, csv, glob, os, sys, time
from pathlib import Path
os.environ["SKIP_SCHOLAR"] = "1"
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import enrich_academics as ea
import openalex_scraper as oa

ROOT = HERE.parents[1]
OUT = ROOT / "scripts/New updates/oa_fill_results.csv"
DONE = ROOT / "scripts/New updates/oa_fill_done.txt"
FIELDS = ea.NEW_UPDATES_FIELDS

ap = argparse.ArgumentParser(); ap.add_argument("--limit", type=int, default=100000); ap.add_argument("--uni", default="")
a = ap.parse_args()
done = set(DONE.read_text().split()) if DONE.exists() else set()
todo = []
for f in sorted(glob.glob(str(ROOT / "Data files/universities/**/academics.csv"), recursive=True)):
    if a.uni and f"/{a.uni}/" not in f: continue
    for r in csv.DictReader(open(f, encoding="utf-8-sig")):
        if not r["h_index"].strip() and not r["total_citations"].strip() and r["academic_id"] not in done and r["full_name"].strip():
            r["source_file_path"] = f; todo.append(r)
print(len(todo), "people to look up", flush=True)
client = oa.OpenAlexClient()
new = not OUT.exists()
out = OUT.open("a", encoding="utf-8-sig", newline="")
w = csv.DictWriter(out, fieldnames=FIELDS, extrasaction="ignore")
if new: w.writeheader()
hits = 0
for i, r in enumerate(todo[:a.limit]):
    try:
        u = ea.enrich_record(r, client, use_scholar=False, use_openalex=True)
    except Exception as e:
        msg = str(e)
        print("ERR", r["academic_id"], msg[:120], flush=True)
        if "429" in msg or "budget" in msg.lower():
            print("rate limited; stopping"); break
        continue
    if u.get("platform"):
        w.writerow(u); out.flush(); hits += 1
    with DONE.open("a") as d: d.write(r["academic_id"] + "\n")
    if i % 25 == 0: print(i, "of", len(todo), "matched", hits, flush=True)
print("finished; matched", hits)

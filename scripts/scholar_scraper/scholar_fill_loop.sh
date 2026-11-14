#!/bin/bash
# Slowly read Google Scholar for everyone who has a Scholar link but no figures. Waits 30 minutes whenever Scholar
# blocks, applies what it gets after every pass, re-imports, never commits. Safe to stop and run again.
cd "$(dirname "$0")/../.."
PY=/opt/anaconda3/bin/python3
for pass in $(seq 1 24); do
  $PY - <<'PYE'
import csv, glob
rows = []
for f in glob.glob("Data files/universities/**/academics.csv", recursive=True):
    for r in csv.DictReader(open(f, encoding="utf-8-sig")):
        if r["google_scholar_url"] and not (r["h_index"] or r["total_citations"]):
            rows.append((r["academic_id"], r["full_name"], r["google_scholar_url"]))
open("/tmp/scholar_todo_loop.csv", "w").write("academic_id,full_name,google_scholar_url\n" + "\n".join(f'{a},"{b}",{c}' for a, b, c in rows))
print(len(rows), "people still waiting")
PYE
  n=$(wc -l < /tmp/scholar_todo_loop.csv); [ "$n" -le 1 ] && break
  $PY scripts/scholar_scraper/scholar_fill.py /tmp/scholar_todo_loop.csv
  $PY scripts/apply_metric_updates.py "scripts/New updates/scholar_fill_results.csv" | grep -E 'fill:h_index'
  npm run data:import | tail -2 | head -1
  sleep 1800
done

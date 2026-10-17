#!/bin/bash
# Slowly re-count Google Scholar figures for people whose numbers were removed as unreliable,
# then apply what was collected. Safe to stop and run again: finished people are remembered.
cd "$(dirname "$0")"
for pass in 1 2 3; do
  /opt/anaconda3/bin/python3 recount_publications.py
  (cd ../.. && /opt/anaconda3/bin/python3 scripts/apply_metric_updates.py "scripts/New updates/newly_updated_academics.csv" && npm run data:import)
done

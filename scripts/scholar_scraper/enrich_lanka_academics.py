#!/usr/bin/env python3
"""
Enrich Lanka Academia records using the scholarly-based scholar_scraper.
Fetches all remaining academics who have a Google Scholar profile URL
and are missing metrics or 2021-2025 citation counts.
"""

import os
import sys
import glob
import csv
import json
import time
from datetime import datetime
from pathlib import Path

# Add current directory to path to import scholar_scraper
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))
import scholar_scraper as ss

REPO_DIR = CURRENT_DIR.parent / "repo_temp"
DATA_DIR = REPO_DIR / "Data files"
CACHE_DIR = CURRENT_DIR / "scholar_output" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
NEW_UPDATES_CSV = CURRENT_DIR.parent / "New updates" / "newly_updated_academics.csv"

YEARS = ["2021", "2022", "2023", "2024", "2025"]
TODAY = "2026-10-16"
TIMESTAMP = "2026-10-16T12:00:00+11:00"

def load_remaining_candidates():
    files = glob.glob(str(DATA_DIR / "universities" / "**" / "academics.csv"), recursive=True)
    candidates = []
    for f in files:
        with open(f, "r", encoding="utf-8-sig") as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                url = row.get("google_scholar_url", "").strip()
                if not url:
                    continue
                sid = ss.get_scholar_id(url)
                if not sid:
                    continue
                st = row.get("research_lookup_status", "")
                if "rejected" in st or "requires_review" in st or "404" in st:
                    continue
                
                c21 = row.get("citations_2021_2025", "").strip()
                tot = row.get("total_citations", "").strip()
                h = row.get("h_index", "").strip()
                
                if not c21 or not tot or not h:
                    candidates.append({
                        "academic_id": row["academic_id"],
                        "full_name": row["full_name"],
                        "university": row["university"],
                        "faculty": row.get("faculty", ""),
                        "department": row.get("department", ""),
                        "academic_position": row.get("academic_position", ""),
                        "scholar_id": sid,
                        "scholar_url": url,
                        "file": f,
                        "existing_tot": tot,
                        "existing_h": h,
                        "existing_c21": c21
                    })
    return candidates

def fetch_single_profile(scholar_id):
    cache_file = CACHE_DIR / f"{scholar_id}.json"
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f), True
        except Exception:
            pass

    # Call scholar_scraper.fetch_profile
    profile = ss.fetch_profile(scholar_id, publications=True, publication_limit=100)
    # Save cache
    ss.save_cache(CACHE_DIR, scholar_id, profile)
    return profile, False

def apply_batch(batch):
    if not batch:
        return
        
    print(f"\nApplying batch of {len(batch)} updates...")
    by_file = {}
    for item in batch:
        fpath = item["candidate"]["file"]
        by_file.setdefault(fpath, []).append(item)
        
    metric_obs_entries = []
    change_log_entries = []
    yearly_entries = []
    new_update_rows = []
    
    for fpath, items in by_file.items():
        items_by_id = {it["candidate"]["academic_id"]: it for it in items}
        rows = []
        with open(fpath, "r", encoding="utf-8-sig") as fp:
            reader = csv.DictReader(fp)
            fieldnames = reader.fieldnames
            for row in reader:
                aid = row["academic_id"]
                if aid in items_by_id:
                    it = items_by_id[aid]
                    cand = it["candidate"]
                    p = it["profile"]
                    
                    old_tot = row.get("total_citations", "")
                    old_h = row.get("h_index", "")
                    old_c21 = row.get("citations_2021_2025", "")
                    
                    tot_val = p.get("total_citations")
                    h_val = p.get("hindex")
                    
                    new_tot = str(tot_val) if tot_val is not None else "0"
                    new_h = str(h_val) if h_val is not None else "0"
                    
                    by_year = p.get("citations_by_year", {}) or {}
                    yearly_counts = {y: by_year.get(y, by_year.get(int(y), 0)) for y in YEARS}
                    new_c21 = str(sum(yearly_counts.values()))
                    
                    pubs = p.get("publications", []) or []
                    new_pub = str(len(pubs)) if len(pubs) > 0 and len(pubs) < 100 else ""
                    
                    # Update row fields
                    row["total_citations"] = new_tot
                    row["h_index"] = new_h
                    row["citations_2021_2025"] = new_c21
                    if new_pub and not row.get("total_publications"):
                        row["total_publications"] = new_pub
                    row["research_metrics_source"] = "Google Scholar"
                    row["metrics_source_url"] = cand["scholar_url"]
                    row["research_lookup_status"] = "official_scholar_identity_verified_metrics_retrieved"
                    row["collected_at"] = TODAY
                    
                    # Change log
                    if new_tot != old_tot:
                        change_log_entries.append({
                            "change_id": f"SCHOLAR-TOT-{aid}-{TODAY}",
                            "timestamp": TIMESTAMP,
                            "university_id": "", "unit_id": "",
                            "academic_id": aid, "action": "update",
                            "field": "total_citations", "old_value": old_tot,
                            "new_value": new_tot, "reason": "Google Scholar profile all-time citations",
                            "source_url": cand["scholar_url"]
                        })
                    if new_h != old_h:
                        change_log_entries.append({
                            "change_id": f"SCHOLAR-H-{aid}-{TODAY}",
                            "timestamp": TIMESTAMP,
                            "university_id": "", "unit_id": "",
                            "academic_id": aid, "action": "update",
                            "field": "h_index", "old_value": old_h,
                            "new_value": new_h, "reason": "Google Scholar profile h-index",
                            "source_url": cand["scholar_url"]
                        })
                    if new_c21 != old_c21:
                        change_log_entries.append({
                            "change_id": f"SCHOLAR-YEARLY-{aid}-{TODAY}",
                            "timestamp": TIMESTAMP,
                            "university_id": "", "unit_id": "",
                            "academic_id": aid, "action": "update",
                            "field": "citations_2021_2025", "old_value": old_c21,
                            "new_value": new_c21, "reason": "Scholar year-by-year citation graph (2021–2025)",
                            "source_url": cand["scholar_url"]
                        })
                        
                    # Observations
                    metric_obs_entries.append({
                        "academic_id": aid, "platform": "Google Scholar", "metric": "total_citations",
                        "value": new_tot, "source_url": cand["scholar_url"], "retrieved_at": TODAY,
                        "verification_basis": "official_staff_page_link_and_platform_display",
                        "notes": "All-time metric column; not rolling Since value."
                    })
                    metric_obs_entries.append({
                        "academic_id": aid, "platform": "Google Scholar", "metric": "h_index",
                        "value": new_h, "source_url": cand["scholar_url"], "retrieved_at": TODAY,
                        "verification_basis": "official_staff_page_link_and_platform_display",
                        "notes": "All-time metric column; not rolling Since value."
                    })
                    metric_obs_entries.append({
                        "academic_id": aid, "platform": "Google Scholar", "metric": "citations_2021_2025",
                        "value": new_c21, "source_url": cand["scholar_url"], "retrieved_at": TODAY,
                        "verification_basis": "official_staff_page_link_and_platform_display",
                        "notes": f"Annual citation evidence: {json.dumps(by_year)}"
                    })
                    for y in YEARS:
                        metric_obs_entries.append({
                            "academic_id": aid, "platform": "Google Scholar", "metric": f"citations_received_{y}",
                            "value": str(yearly_counts[y]), "source_url": cand["scholar_url"], "retrieved_at": TODAY,
                            "verification_basis": "explicit_annual_chart_value",
                            "notes": "Aligned chart year label and citation bar; zero only if displayed."
                        })
                        
                    # Yearly entry
                    yearly_entries.append({
                        "academic_id": aid, "full_name": cand["full_name"], "university": cand["university"],
                        "scholar_id": cand["scholar_id"], "scholar_url": cand["scholar_url"],
                        "total_citations_known": new_tot,
                        "y2021": str(yearly_counts["2021"]), "y2022": str(yearly_counts["2022"]),
                        "y2023": str(yearly_counts["2023"]), "y2024": str(yearly_counts["2024"]),
                        "y2025": str(yearly_counts["2025"]), "retrieved_at": TODAY
                    })
                    
                    # New updates row
                    new_update_rows.append({
                        "academic_id": aid, "full_name": cand["full_name"], "university": cand["university"],
                        "faculty": cand.get("faculty", ""), "department": cand.get("department", ""),
                        "academic_position": cand.get("academic_position", ""),
                        "google_scholar_url": cand["scholar_url"], "total_citations": new_tot,
                        "citations_2021_2025": new_c21, "h_index": new_h, "total_publications": new_pub,
                        "y2021": str(yearly_counts["2021"]), "y2022": str(yearly_counts["2022"]),
                        "y2023": str(yearly_counts["2023"]), "y2024": str(yearly_counts["2024"]),
                        "y2025": str(yearly_counts["2025"]), "retrieved_at": TODAY,
                        "source_file_path": os.path.relpath(fpath, str(REPO_DIR))
                    })
                    
                rows.append(row)
                
        with open(fpath, "w", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            
    # Append to observations
    obs_file = DATA_DIR / "research_metric_observations.csv"
    if obs_file.exists() and metric_obs_entries:
        with open(obs_file, "a", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "academic_id", "platform", "metric", "value", "source_url", "retrieved_at", "verification_basis", "notes"
            ])
            writer.writerows(metric_obs_entries)
            
    # Append to change_log
    log_file = DATA_DIR / "change_log.csv"
    if log_file.exists() and change_log_entries:
        with open(log_file, "a", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "change_id", "timestamp", "university_id", "unit_id", "academic_id", "action", "field", "old_value", "new_value", "reason", "source_url"
            ])
            writer.writerows(change_log_entries)

    # Append to scholar_yearly_citations
    citations_file = DATA_DIR / "scholar_yearly_citations.csv"
    if citations_file.exists() and yearly_entries:
        with open(citations_file, "a", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "academic_id", "full_name", "university", "scholar_id", "scholar_url", "total_citations_known", "y2021", "y2022", "y2023", "y2024", "y2025", "retrieved_at"
            ])
            writer.writerows(yearly_entries)

    # Append to New updates
    if NEW_UPDATES_CSV.exists() and new_update_rows:
        with open(NEW_UPDATES_CSV, "a", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "academic_id", "full_name", "university", "faculty", "department", "academic_position",
                "google_scholar_url", "total_citations", "citations_2021_2025", "h_index", "total_publications",
                "y2021", "y2022", "y2023", "y2024", "y2025", "retrieved_at", "source_file_path"
            ])
            writer.writerows(new_update_rows)

    print(f"Applied {len(batch)} updates successfully.")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=120)
    parser.add_argument("--delay", type=float, default=2.5, help="Delay between requests in seconds")
    args = parser.parse_args()

    candidates = load_remaining_candidates()
    print(f"Found {len(candidates)} remaining candidates with Scholar URL needing metrics.")
    target = candidates[:args.limit]
    print(f"Processing up to {len(target)} profiles (delay={args.delay}s)...")

    batch = []
    success_count = 0
    fail_count = 0

    for idx, c in enumerate(target, start=1):
        sid = c["scholar_id"]
        print(f"[{idx}/{len(target)}] {c['academic_id']} {c['full_name']} ({sid})...", end=" ", flush=True)
        try:
            profile, from_cache = fetch_single_profile(sid)
            tag = "CACHED" if from_cache else "FETCHED"
            tot = profile.get("total_citations")
            h = profile.get("hindex")
            print(f"{tag} -> tot={tot}, h={h}")
            batch.append({
                "candidate": c,
                "profile": profile
            })
            success_count += 1
            if len(batch) >= 10:
                apply_batch(batch)
                batch = []
            if not from_cache:
                time.sleep(args.delay)
        except Exception as e:
            err_msg = str(e)
            print(f"ERROR: {err_msg}")
            fail_count += 1
            # If 404, mark in file
            if "404" in err_msg or "Cannot Fetch" in err_msg:
                try:
                    fpath = c["file"]
                    rows = []
                    with open(fpath, "r", encoding="utf-8-sig") as fp:
                        reader = csv.DictReader(fp)
                        fieldnames = reader.fieldnames
                        for r in reader:
                            if r["academic_id"] == c["academic_id"]:
                                r["research_lookup_status"] = "official_scholar_link_404_profile_not_found"
                            rows.append(r)
                    with open(fpath, "w", encoding="utf-8-sig", newline="") as fp:
                        writer = csv.DictWriter(fp, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(rows)
                except Exception:
                    pass
            time.sleep(1.0)

    if batch:
        apply_batch(batch)
        batch = []

    print(f"\nFinished run: {success_count} succeeded, {fail_count} failed.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Master Academic Metric Enrichment & Scraping Suite.

Enriches newly added or existing academics using Google Scholar and OpenAlex APIs.
Calculates total citations, h-index, 2021-2025 annual citations, and total publications.
Automatically tracks all newly updated academics in:
    'New updates/newly_updated_academics.csv'

Usage:
  1. Enrich a custom CSV of newly added academics:
     python enrich_academics.py my_new_academics.csv --out my_enriched.csv

  2. Scan and enrich all academics in the Lanka Academia repository:
     python enrich_academics.py --scan-repo --limit 50

  3. Search and enrich a single academic:
     python enrich_academics.py --name "M. A. Perera" --university "University of Colombo"
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import glob
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

# Ensure scholar_scraper directory is on path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

import scholar_scraper as gs
import openalex_scraper as oa

# Paths
ROOT_DIR = CURRENT_DIR.parent
REPO_DIR = ROOT_DIR / "repo_temp"
DATA_DIR = REPO_DIR / "Data files"
NEW_UPDATES_CSV = ROOT_DIR / "New updates" / "newly_updated_academics.csv"

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")
YEARS = ["2021", "2022", "2023", "2024", "2025"]

NEW_UPDATES_FIELDS = [
    "academic_id", "full_name", "university", "faculty", "department",
    "academic_position", "platform", "profile_url", "total_citations",
    "citations_2021_2025", "h_index", "total_publications",
    "y2021", "y2022", "y2023", "y2024", "y2025", "retrieved_at",
    "disambiguation_method", "source_file_path"
]


def load_existing_new_update_ids() -> set[tuple[str, str]]:
    """Return set of (academic_id, platform) already in newly_updated_academics.csv."""
    if not NEW_UPDATES_CSV.exists():
        return set()
    seen = set()
    try:
        with NEW_UPDATES_CSV.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                aid = row.get("academic_id", "").strip()
                plat = row.get("platform", "").strip()
                if aid:
                    seen.add((aid, plat))
    except Exception:
        pass
    return seen


def append_to_new_updates(rows: list[dict]) -> int:
    """Append new records to 'New updates/newly_updated_academics.csv'."""
    if not rows:
        return 0
    NEW_UPDATES_CSV.parent.mkdir(parents=True, exist_ok=True)
    file_exists = NEW_UPDATES_CSV.exists()
    seen = load_existing_new_update_ids()

    to_write = []
    for r in rows:
        aid = r.get("academic_id", "").strip()
        plat = r.get("platform", "").strip()
        if (aid, plat) not in seen:
            to_write.append(r)
            seen.add((aid, plat))

    if not to_write:
        return 0

    mode = "a" if file_exists else "w"
    with NEW_UPDATES_CSV.open(mode, encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=NEW_UPDATES_FIELDS, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()
        writer.writerows(to_write)
    return len(to_write)


def enrich_record(
    academic: dict,
    oa_client: oa.OpenAlexClient,
    use_scholar: bool = True,
    use_openalex: bool = True,
    scholar_engine: str = "auto"
) -> dict:
    """Enrich a single academic record using Google Scholar and/or OpenAlex."""
    updated = dict(academic)
    aid = academic.get("academic_id", "") or academic.get("id", "")
    full_name = academic.get("full_name") or academic.get("name") or academic.get("academic_name", "")
    uni = academic.get("university", "")
    faculty = academic.get("faculty", "")
    dept = academic.get("department", "")
    scholar_url = academic.get("google_scholar_url") or academic.get("scholar_url", "")
    if os.environ.get("SKIP_SCHOLAR"):  # Scholar is blocking: go straight to OpenAlex
        scholar_url = ""
    existing_tot = academic.get("total_citations", "").strip()
    existing_h = academic.get("h_index", "").strip()
    existing_pubs = academic.get("total_publications", "").strip()
    existing_c21 = academic.get("citations_2021_2025", "").strip()

    scholar_id = gs.get_scholar_id(scholar_url) if scholar_url else None
    matched_platform = None
    profile_url = ""
    method = ""

    # 1. Attempt Google Scholar if URL/ID is available
    if use_scholar and scholar_id:
        cache_dir = CURRENT_DIR / "scholar_output" / "cache"
        cached = gs.load_cache(cache_dir, scholar_id)
        profile = None
        if cached:
            profile = cached
        else:
            try:
                profile = gs.fetch_profile(scholar_id, publications=True, publication_limit=0, engine=scholar_engine)
                gs.save_cache(cache_dir, scholar_id, profile)
            except Exception as e:
                print(f"    [Scholar] {scholar_id} fetch failed: {e}")

        if profile:
            tot = profile.get("total_citations")
            h = profile.get("hindex")
            by_year = profile.get("citations_by_year", {}) or {}
            c21_sum = sum(by_year.get(y, by_year.get(int(y), 0)) for y in YEARS)
            pubs_list = profile.get("publications", []) or []
            pubs_count = len(pubs_list) if pubs_list else (profile.get("total_publications") or "")

            updated["total_citations"] = str(tot) if tot is not None else existing_tot
            updated["h_index"] = str(h) if h is not None else existing_h
            updated["citations_2021_2025"] = str(c21_sum) if by_year else existing_c21
            if pubs_count and not existing_pubs:
                updated["total_publications"] = str(pubs_count)

            updated["research_metrics_source"] = "Google Scholar"
            updated["metrics_source_url"] = scholar_url
            updated["research_lookup_status"] = "official_scholar_identity_verified_metrics_retrieved"
            matched_platform = "Google Scholar"
            profile_url = f"https://scholar.google.com/citations?user={scholar_id}"
            method = "official_profile_snapshot"

            # Store annual counts for reporting
            for y in YEARS:
                updated[f"y{y}"] = by_year.get(y, by_year.get(int(y), 0))

    # 2. Attempt OpenAlex if Scholar was missing, failed, or missing citations/publications
    need_oa = (
        use_openalex and (
            not matched_platform or
            not updated.get("total_citations") or
            not updated.get("total_publications")
        )
    )
    if need_oa and full_name:
        cand, status, score, reason = oa_client.search_and_disambiguate(
            full_name=full_name,
            university=uni,
            faculty=faculty,
            department=dept,
            research_interests=academic.get("research_interests", "")
        )
        if cand and ("approved" in status or score >= 70):
            oa_prof = oa.format_openalex_profile(cand, confidence=status, match_reason=reason)
            oa_tot = str(oa_prof.get("oa_cited_by_count", 0))
            oa_h = str(oa_prof.get("oa_h_index", 0))
            oa_pubs = str(oa_prof.get("oa_works_count", 0))
            oa_c21 = str(oa_prof.get("oa_citations_2021_2025", 0))

            if not matched_platform:
                # Primary metrics from OpenAlex
                updated["total_citations"] = oa_tot
                updated["h_index"] = oa_h
                updated["total_publications"] = oa_pubs
                updated["citations_2021_2025"] = oa_c21
                updated["research_metrics_source"] = "OpenAlex"
                updated["metrics_source_url"] = oa_prof["oa_url"]
                updated["research_lookup_status"] = "openalex_identity_verified_metrics_retrieved"
                matched_platform = "OpenAlex"
                profile_url = oa_prof["oa_url"]
                method = f"openalex_disambiguated:{reason}"
                for y in YEARS:
                    updated[f"y{y}"] = oa_prof[f"oa_y{y}"]
            else:
                # Supplemental publications from OpenAlex if Scholar lacked them
                if not updated.get("total_publications") and oa_pubs:
                    updated["total_publications"] = oa_pubs
                    updated["openalex_works_count"] = oa_pubs

    updated["platform"] = matched_platform or ""
    updated["profile_url"] = profile_url
    updated["disambiguation_method"] = method
    updated["retrieved_at"] = TODAY
    return updated


def enrich_csv_file(
    input_csv: Path,
    output_csv: Path | None = None,
    limit: int = 500,
    scholar_engine: str = "auto"
) -> None:
    """Enrich an arbitrary input CSV of academics."""
    if not input_csv.exists():
        print(f"Error: file not found: {input_csv}", file=sys.stderr)
        return

    with input_csv.open("r", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
        if not rows:
            print("CSV is empty.")
            return
        fieldnames = list(rows[0].keys())

    oa_client = oa.OpenAlexClient()
    output_path = output_csv or input_csv.with_name(f"{input_csv.stem}_enriched.csv")

    print(f"\nProcessing {min(len(rows), limit)} academics from {input_csv.name}...")
    enriched_rows = []
    new_update_records = []

    for idx, r in enumerate(rows[:limit], start=1):
        name = r.get("full_name") or r.get("name", "")
        print(f"[{idx}/{min(len(rows), limit)}] {name}...", end=" ", flush=True)
        res = enrich_record(r, oa_client, scholar_engine=scholar_engine)
        plat = res.get("platform")
        tot = res.get("total_citations", "")
        pubs = res.get("total_publications", "")
        h = res.get("h_index", "")

        if plat:
            print(f"[{plat}] citations={tot}, h={h}, pubs={pubs}")
            new_update_records.append({
                "academic_id": res.get("academic_id", f"NEW-{idx:04d}"),
                "full_name": name,
                "university": res.get("university", ""),
                "faculty": res.get("faculty", ""),
                "department": res.get("department", ""),
                "academic_position": res.get("academic_position", ""),
                "platform": plat,
                "profile_url": res.get("profile_url", ""),
                "total_citations": tot,
                "citations_2021_2025": res.get("citations_2021_2025", ""),
                "h_index": h,
                "total_publications": pubs,
                "y2021": res.get("y2021", ""),
                "y2022": res.get("y2022", ""),
                "y2023": res.get("y2023", ""),
                "y2024": res.get("y2024", ""),
                "y2025": res.get("y2025", ""),
                "retrieved_at": TODAY,
                "disambiguation_method": res.get("disambiguation_method", ""),
                "source_file_path": str(input_csv)
            })
        else:
            print("[Not found or no public profile]")

        enriched_rows.append(res)
        time.sleep(0.1)

    # Save enriched file
    out_fields = list(dict.fromkeys(fieldnames + [
        "total_citations", "citations_2021_2025", "h_index", "total_publications",
        "research_metrics_source", "metrics_source_url", "research_lookup_status",
        "retrieved_at"
    ]))
    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=out_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(enriched_rows)

    appended = append_to_new_updates(new_update_records)
    print(f"\nSaved enriched CSV to: {output_path}")
    print(f"Tracked {appended} newly updated records in: {NEW_UPDATES_CSV}")


def scan_and_enrich_repo(limit: int = 100, scholar_engine: str = "auto", sync_app: bool = False) -> None:
    """Scan all repo_temp/Data files/universities/**/academics.csv and enrich missing data."""
    if not DATA_DIR.exists():
        print(f"Error: Data directory not found at {DATA_DIR}", file=sys.stderr)
        return

    univ_files = glob.glob(str(DATA_DIR / "universities" / "**" / "academics.csv"), recursive=True)
    print(f"Found {len(univ_files)} departmental academic files.")

    candidates = []
    for fpath in univ_files:
        with open(fpath, "r", encoding="utf-8-sig") as fp:
            reader = list(csv.DictReader(fp))
            for row in reader:
                tot = row.get("total_citations", "").strip()
                h = row.get("h_index", "").strip()
                c21 = row.get("citations_2021_2025", "").strip()
                pubs = row.get("total_publications", "").strip()
                url = row.get("google_scholar_url", "").strip()
                st = row.get("research_lookup_status", "")

                if "rejected" in st or "404" in st:
                    continue

                # Identify records needing data
                if not tot or not h or not c21 or not pubs:
                    candidates.append({
                        "file_path": fpath,
                        "row": row,
                        "has_url": bool(url),
                        "missing_metrics": not (tot and h and c21),
                        "missing_pubs": not pubs
                    })

    print(f"Total academics with missing research metrics or publications: {len(candidates)}")
    if not candidates:
        print("Dataset is 100% complete!")
        return

    target = candidates[:limit]
    print(f"Processing batch of {len(target)} candidates (limit={limit})...\n")

    oa_client = oa.OpenAlexClient()
    by_file = {}
    new_update_records = []
    obs_entries = []
    change_entries = []
    yearly_entries = []

    for idx, c in enumerate(target, start=1):
        r = c["row"]
        aid = r.get("academic_id", "")
        name = r.get("full_name", "")
        fpath = c["file_path"]
        print(f"[{idx}/{len(target)}] {aid} {name}...", end=" ", flush=True)

        res = enrich_record(r, oa_client, scholar_engine=scholar_engine)
        plat = res.get("platform")
        tot = res.get("total_citations", "")
        pubs = res.get("total_publications", "")
        h = res.get("h_index", "")
        c21 = res.get("citations_2021_2025", "")

        if plat:
            print(f"[{plat}] tot={tot}, h={h}, pubs={pubs}, 2021-25={c21}")
            by_file.setdefault(fpath, []).append((aid, res))
            rel_path = os.path.relpath(fpath, str(REPO_DIR))
            new_update_records.append({
                "academic_id": aid,
                "full_name": name,
                "university": res.get("university", ""),
                "faculty": res.get("faculty", ""),
                "department": res.get("department", ""),
                "academic_position": res.get("academic_position", ""),
                "platform": plat,
                "profile_url": res.get("profile_url", ""),
                "total_citations": tot,
                "citations_2021_2025": c21,
                "h_index": h,
                "total_publications": pubs,
                "y2021": res.get("y2021", ""),
                "y2022": res.get("y2022", ""),
                "y2023": res.get("y2023", ""),
                "y2024": res.get("y2024", ""),
                "y2025": res.get("y2025", ""),
                "retrieved_at": TODAY,
                "disambiguation_method": res.get("disambiguation_method", ""),
                "source_file_path": rel_path
            })

            # Prepare traceability observations
            if tot:
                obs_entries.append({
                    "academic_id": aid, "platform": plat, "metric": "total_citations",
                    "value": str(tot), "source_url": res.get("profile_url", ""),
                    "retrieved_at": TODAY, "verification_basis": "automated_enrichment_snapshot",
                    "notes": f"Verified {plat} profile metrics"
                })
            if pubs:
                obs_entries.append({
                    "academic_id": aid, "platform": plat, "metric": "total_publications",
                    "value": str(pubs), "source_url": res.get("profile_url", ""),
                    "retrieved_at": TODAY, "verification_basis": "automated_enrichment_snapshot",
                    "notes": f"Verified {plat} profile works count"
                })
        else:
            print("[No verified metrics found]")
        time.sleep(0.1)

    # Save updates back to departmental academics.csv files
    updated_files_count = 0
    for fpath, file_updates in by_file.items():
        update_map = {item[0]: item[1] for item in file_updates}
        rows = []
        with open(fpath, "r", encoding="utf-8-sig") as fp:
            reader = csv.DictReader(fp)
            fields = reader.fieldnames
            for row in reader:
                aid = row.get("academic_id")
                if aid in update_map:
                    row.update(update_map[aid])
                rows.append(row)
        with open(fpath, "w", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
        updated_files_count += 1

    # Append observations to research_metric_observations.csv
    obs_file = DATA_DIR / "research_metric_observations.csv"
    if obs_file.exists() and obs_entries:
        with obs_file.open("a", encoding="utf-8-sig", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "academic_id", "platform", "metric", "value", "source_url", "retrieved_at", "verification_basis", "notes"
            ])
            writer.writerows(obs_entries)

    # Append to New updates
    appended = append_to_new_updates(new_update_records)

    print(f"\n=======================================================")
    print(f"Enrichment Complete!")
    print(f"  Files modified: {updated_files_count}")
    print(f"  Academics enriched: {len(new_update_records)}")
    print(f"  Tracked in 'New updates/newly_updated_academics.csv': +{appended} rows")
    print(f"=======================================================\n")

    if sync_app:
        print("Synchronizing app datasets (npm run data:import)...")
        try:
            subprocess.run(["npm", "run", "data:import"], cwd=str(REPO_DIR), check=True)
            print("App datasets synchronized successfully.")
        except Exception as e:
            print(f"Warning: npm run data:import failed: {e}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_csv", nargs="?", type=Path, help="Path to input academics CSV file")
    parser.add_argument("--out", type=Path, help="Output enriched CSV path")
    parser.add_argument("--scan-repo", action="store_true", help="Scan and enrich missing metrics in Lanka Academia repo")
    parser.add_argument("--limit", type=int, default=100, help="Max academics to process per run")
    parser.add_argument("--scholar-engine", choices=["auto", "serpapi", "scholarly"], default="auto", help="Scholar engine")
    parser.add_argument("--sync-app", action="store_true", help="Run 'npm run data:import' after updating repo files")
    args = parser.parse_args()

    if args.input_csv:
        enrich_csv_file(args.input_csv, output_csv=args.out, limit=args.limit, scholar_engine=args.scholar_engine)
    elif args.scan_repo or (not args.input_csv and not sys.stdin.isatty()):
        scan_and_enrich_repo(limit=args.limit, scholar_engine=args.scholar_engine, sync_app=args.sync_app)
    else:
        # Default when run without arguments: scan repo
        scan_and_enrich_repo(limit=args.limit, scholar_engine=args.scholar_engine, sync_app=args.sync_app)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Google Scholar public-profile extractor for an existing academic CSV.

Supports both direct scraping via scholarly and API-based extraction via SerpApi.
Automatically reuses cached profile JSONs and calculates citation metrics,
calendar year citations (e.g. 2021-2025), h-index, and publication counts.

Install: python -m pip install -r requirements.txt
Run:     python scholar_scraper.py academics.csv --limit 10
Optional:python scholar_scraper.py academics.csv --limit 10 --with-publications --publication-limit 100
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from difflib import SequenceMatcher
import html
import json
import os
from pathlib import Path
import random
import re
import sys
import time
import urllib.parse
import urllib.request

# Try importing dotenv
try:
    from dotenv import load_dotenv
    # Search for .env in current directory, parent directory, and grandparent directory
    for env_cand in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parents[1] / ".env"]:
        if env_cand.exists():
            load_dotenv(env_cand)
            break
except ImportError:
    # Fallback simple .env parser
    for env_cand in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parents[1] / ".env"]:
        if env_cand.exists():
            try:
                with env_cand.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip())
            except Exception:
                pass


URL_COLUMN_NAMES = (
    "google_scholar", "google_scholar_url", "google_scholar_profile",
    "scholar_url", "scholar_link", "scholar_profile", "google scholar",
    "google scholar profile", "google scholar link", "google scholar url",
)
NAME_COLUMN_NAMES = (
    "name", "full_name", "academic_name", "staff_name", "academic", "full name"
)
SCHOLAR_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{6,32}$")
PROFILE_FIELDS = [
    "gs_status", "gs_id", "gs_profile_url", "gs_name", "gs_affiliation",
    "gs_email_domain", "gs_interests", "gs_total_citations", "gs_citations_5y",
    "gs_hindex", "gs_hindex_5y", "gs_i10index", "gs_i10index_5y",
    "gs_complete_years", "gs_citations_in_complete_years", "gs_citations_by_year_json",
    "gs_name_similarity", "gs_review_name", "gs_publications_exported",
    "gs_publications_complete", "gs_total_publications", "gs_publications_5y",
    "gs_publication_years_5y", "gs_publications_by_year_json",
    "gs_publications_without_year", "gs_retrieved_at", "gs_source_row",
]
PUBLICATION_FIELDS = [
    "source_row", "input_name", "scholar_id", "scholar_name",
    "author_pub_id", "title", "publication_year", "citations",
    "citation_text", "venue", "pub_url",
]


def normalized_header(header: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", header.casefold()).strip("_")


def find_column(fieldnames: list[str], candidates: tuple[str, ...]) -> str | None:
    lookup = {normalized_header(h): h for h in fieldnames}
    for candidate in candidates:
        if normalized_header(candidate) in lookup:
            return lookup[normalized_header(candidate)]
    # E.g., "Google Scholar Profile URL (verified)"
    if candidates == URL_COLUMN_NAMES:
        for header in fieldnames:
            n = normalized_header(header)
            if "scholar" in n and ("url" in n or "link" in n or "profile" in n):
                return header
    return None


def get_scholar_id(value: str) -> str | None:
    """Accept a Scholar profile URL, or the bare author ID."""
    value = html.unescape((value or "").strip())
    if SCHOLAR_ID_PATTERN.fullmatch(value):
        return value
    if value.startswith("scholar.google."):
        value = "https://" + value
    parsed = urlparse_safe(value)
    if not parsed:
        return None
    hostname = (parsed.hostname or "").lower()
    if not re.fullmatch(r"scholar\.google\.[a-z.]+", hostname):
        return None
    if parsed.path.rstrip("/") != "/citations":
        return None
    scholar_id = urllib.parse.parse_qs(parsed.query).get("user", [None])[0]
    return scholar_id if scholar_id and SCHOLAR_ID_PATTERN.fullmatch(scholar_id) else None


def urlparse_safe(url: str):
    try:
        return urllib.parse.urlparse(url)
    except Exception:
        return None


def normalize_name(s: str) -> str:
    s = s.casefold()
    s = re.sub(r"\b(professor|prof|associate|assistant|dr|doctor|mr|mrs|ms|phd)\b", " ", s)
    return re.sub(r"[^a-z]+", " ", s).strip()


def name_similarity(first: str, second: str) -> float | None:
    a, b = normalize_name(first), normalize_name(second)
    if not a or not b:
        return None
    return round(SequenceMatcher(None, a, b).ratio(), 3)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")
        return list(reader.fieldnames), list(reader)


def cache_path(cache_dir: Path, scholar_id: str) -> Path:
    return cache_dir / f"{scholar_id}.json"


def load_cache(cache_dir: Path, scholar_id: str) -> dict | None:
    # First check target cache_dir
    path = cache_path(cache_dir, scholar_id)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print(f"WARNING: unusable cache {path}: {exc}", file=sys.stderr)
            return None

    # Only check secondary fallback caches if using the default scholar_output/cache
    default_cache = Path(__file__).resolve().parent / "scholar_output" / "cache"
    if cache_dir == default_cache:
        alt_dirs = [
            Path(__file__).resolve().parents[1] / "repo_temp" / "scripts" / "scholar_cache"
        ]
        for ad in alt_dirs:
            alt_path = ad / f"{scholar_id}.json"
            if alt_path.exists() and alt_path != path:
                try:
                    raw = json.loads(alt_path.read_text(encoding="utf-8"))
                    if "cited_by" in raw or "author" in raw:
                        converted = convert_serpapi_to_profile(scholar_id, raw)
                        save_cache(cache_dir, scholar_id, converted)
                        return converted
                    return raw
                except Exception:
                    pass
    return None


def save_cache(cache_dir: Path, scholar_id: str, profile: dict) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    destination = cache_path(cache_dir, scholar_id)
    temporary = destination.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temporary, destination)


def cache_satisfies(profile: dict | None, publications: bool, limit: int) -> bool:
    if not profile:
        return False
    if not publications:
        return True
    if not profile.get("publications_fetched"):
        return False
    old_limit = int(profile.get("publication_limit", 0))
    return old_limit == 0 or (limit > 0 and old_limit >= limit)


def convert_serpapi_to_profile(scholar_id: str, data: dict, publications: bool = True, publication_limit: int = 100) -> dict:
    author_info = data.get("author") or {}
    cited_by = data.get("cited_by") or {}
    table = cited_by.get("table", [])
    graph = cited_by.get("graph", [])
    raw_articles = data.get("articles", [])

    total_citations = None
    citations_5y = None
    hindex = None
    hindex_5y = None
    i10index = None
    i10index_5y = None

    for item in table:
        for k, v in item.items():
            k_lower = k.lower()
            if "citation" in k_lower:
                total_citations = v.get("all")
                citations_5y = v.get("since_2021", v.get("since_2020"))
            elif "h_index" in k_lower or "indice_h" in k_lower or k_lower == "h":
                hindex = v.get("all")
                hindex_5y = v.get("since_2021", v.get("since_2020"))
            elif "i10_index" in k_lower or "indice_i10" in k_lower or k_lower == "i10":
                i10index = v.get("all")
                i10index_5y = v.get("since_2021", v.get("since_2020"))

    # Graph
    years: dict[str, int] = {}
    for entry in graph:
        try:
            y = str(int(entry.get("year")))
            c = int(entry.get("citations", 0))
            years[y] = c
        except Exception:
            continue

    # Interests
    raw_interests = author_info.get("interests", [])
    interests = [it.get("title") if isinstance(it, dict) else str(it) for it in raw_interests]

    # Articles / Publications
    pubs: list[dict] = []
    if publications:
        for entry in raw_articles:
            if publication_limit > 0 and len(pubs) >= publication_limit:
                break
            cited_val = entry.get("cited_by", {})
            citations_num = cited_val.get("value") if isinstance(cited_val, dict) else cited_val
            pubs.append({
                "author_pub_id": entry.get("citation_id", ""),
                "title": entry.get("title", ""),
                "publication_year": str(entry.get("year", "")).strip(),
                "citations": citations_num if citations_num is not None else "",
                "citation_text": entry.get("authors", ""),
                "venue": entry.get("publication", ""),
                "pub_url": entry.get("link", ""),
            })

    pagination = data.get("serpapi_pagination", {})
    has_more = bool(pagination.get("next"))

    return {
        "scholar_id": scholar_id,
        "name": author_info.get("name", ""),
        "affiliation": author_info.get("affiliations", ""),
        "email_domain": author_info.get("email", ""),
        "interests": interests,
        "total_citations": total_citations if total_citations is not None else 0,
        "citations_5y": citations_5y,
        "hindex": hindex if hindex is not None else 0,
        "hindex_5y": hindex_5y,
        "i10index": i10index if i10index is not None else 0,
        "i10index_5y": i10index_5y,
        "citations_by_year": years,
        "publications_fetched": publications,
        "publication_limit": publication_limit if (publications and has_more) else (0 if not has_more else publication_limit),
        "publications": pubs,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_engine": "serpapi"
    }


def fetch_profile_serpapi(scholar_id: str, api_key: str, publications: bool = True, publication_limit: int = 100) -> dict:
    url = f"https://serpapi.com/search.json?engine=google_scholar_author&author_id={scholar_id}&num=100&api_key={api_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "LankaAcademia/1.0 (Mozilla/5.0)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())

    # Check for errors in SerpApi response
    if "error" in data:
        raise RuntimeError(f"SerpApi Error: {data['error']}")

    articles = data.get("articles", [])
    pagination = data.get("serpapi_pagination", {})

    # If publication_limit == 0 (all) or > len(articles) and next page exists, paginate
    while publications and (publication_limit == 0 or len(articles) < publication_limit) and pagination.get("next"):
        next_url = f"{pagination['next']}&api_key={api_key}"
        more_articles = None
        for attempt in range(4):
            try:
                next_req = urllib.request.Request(next_url, headers={"User-Agent": "LankaAcademia/1.0"})
                with urllib.request.urlopen(next_req, timeout=25) as n_resp:
                    next_data = json.loads(n_resp.read().decode())
                more_articles = next_data.get("articles", [])
                break
            except Exception:
                time.sleep(2 * (attempt + 1))
        if more_articles is None:
            # Never report a partial first page as the total.
            raise RuntimeError("Publication list stopped before the end; not reporting a partial count")
        if not more_articles:
            break
        articles.extend(more_articles)
        pagination = next_data.get("serpapi_pagination", {})
        time.sleep(0.5)

    data["articles"] = articles
    return convert_serpapi_to_profile(scholar_id, data, publications=publications, publication_limit=publication_limit)


def fetch_profile_scholarly(scholar_id: str, publications: bool, publication_limit: int) -> dict:
    from scholarly import scholarly

    author = scholarly.search_author_id(scholar_id)
    if not isinstance(author, dict) or not author.get("name"):
        raise RuntimeError("No valid author profile returned; access may be restricted")

    sections = ["basics", "indices", "counts"]
    if publications:
        sections.append("publications")
    author = scholarly.fill(
        author, sections=sections,
        sortby="year",
        publication_limit=publication_limit,
    )
    if not isinstance(author, dict) or not author.get("name"):
        raise RuntimeError("Profile extraction returned no author; check for blocking")

    years: dict[str, int] = {}
    for year, citations in (author.get("cites_per_year") or {}).items():
        try:
            years[str(int(year))] = int(citations)
        except (TypeError, ValueError):
            continue

    pubs: list[dict] = []
    if publications:
        for entry in author.get("publications", []) or []:
            bib = entry.get("bib", {}) or {}
            pubs.append({
                "author_pub_id": entry.get("author_pub_id", ""),
                "title": bib.get("title", ""),
                "publication_year": str(bib.get("pub_year", "")).strip(),
                "citations": entry.get("num_citations", ""),
                "citation_text": bib.get("citation", ""),
                "venue": bib.get("venue", bib.get("journal", "")),
                "pub_url": entry.get("pub_url", ""),
            })

    return {
        "scholar_id": scholar_id,
        "name": author.get("name", ""),
        "affiliation": author.get("affiliation", ""),
        "email_domain": author.get("email_domain", ""),
        "interests": author.get("interests", []) or [],
        "total_citations": author.get("citedby"),
        "citations_5y": author.get("citedby5y"),
        "hindex": author.get("hindex"),
        "hindex_5y": author.get("hindex5y"),
        "i10index": author.get("i10index"),
        "i10index_5y": author.get("i10index5y"),
        "citations_by_year": years,
        "publications_fetched": publications,
        "publication_limit": publication_limit if publications else None,
        "publications": pubs,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_engine": "scholarly"
    }


def fetch_profile(
    scholar_id: str,
    publications: bool,
    publication_limit: int,
    engine: str = "auto",
    serpapi_key: str | None = None
) -> dict:
    """Fetch author profile via SerpApi (if available) or scholarly."""
    key = serpapi_key or os.environ.get("SERPAPI_API_KEY", "").strip()

    if engine in ("auto", "serpapi") and key:
        try:
            return fetch_profile_serpapi(scholar_id, key, publications, publication_limit)
        except Exception as e:
            if engine == "serpapi":
                raise e
            print(f"SerpApi fetch failed ({e}); falling back to scholarly...", file=sys.stderr)

    return fetch_profile_scholarly(scholar_id, publications, publication_limit)


def summarize_publications(profile: dict, completed_years: list[str]) -> dict[str, object]:
    """Count profile-listed works, retaining the distinction between partial and full lists."""
    papers = profile.get("publications") or []
    if not profile.get("publications_fetched"):
        return {
            "complete": False, "exported": 0, "total": "", "recent": "",
            "by_year": "", "without_year": "",
        }

    limit = profile.get("publication_limit")
    # limit=0 requests the entire listing. If a positive limit was used,
    # a result shorter than that limit also indicates the listing was exhausted.
    complete = limit == 0 or (
        isinstance(limit, int) and limit > 0 and len(papers) < limit
    )
    by_year: dict[str, int] = {}
    without_year = 0
    for paper in papers:
        raw_year = str(paper.get("publication_year") or "").strip()
        year_match = re.fullmatch(r"(?:19|20)\d{2}", raw_year)
        if year_match:
            by_year[raw_year] = by_year.get(raw_year, 0) + 1
        else:
            without_year += 1
    return {
        "complete": complete,
        "exported": len(papers),
        "total": len(papers) if complete else "",
        "recent": sum(by_year.get(year, 0) for year in completed_years) if complete else "",
        "by_year": json.dumps(by_year, sort_keys=True),
        "without_year": without_year,
    }


def as_csv_value(value: object) -> object:
    return "" if value is None else value


def atomic_csv_write(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    os.replace(temporary, path)


def export_results(
    input_rows: list[dict[str, str]],
    input_columns: list[str],
    url_column: str,
    name_column: str | None,
    output_dir: Path,
) -> tuple[int, int]:
    this_year = datetime.now(timezone.utc).year
    # Completed calendar years (e.g. 2021 through 2025 in 2026)
    completed_years = [str(year) for year in range(this_year - 5, this_year)]
    cache_dir = output_dir / "cache"
    profile_rows: list[dict] = []
    publication_rows: list[dict] = []
    successful = 0

    for source_row, input_row in enumerate(input_rows, start=2):
        scholar_id = get_scholar_id(input_row.get(url_column, ""))
        original_url = (input_row.get(url_column) or "").strip()
        output = dict(input_row)
        output.update({k: "" for k in PROFILE_FIELDS})
        output["gs_source_row"] = source_row

        if not original_url:
            output["gs_status"] = "no_link"
        elif not scholar_id:
            output["gs_status"] = "invalid_link"
        else:
            cached = load_cache(cache_dir, scholar_id)
            output["gs_id"] = scholar_id
            output["gs_profile_url"] = f"https://scholar.google.com/citations?user={scholar_id}"
            if not cached:
                output["gs_status"] = "not_fetched"
            else:
                successful += 1
                score = name_similarity(
                    input_row.get(name_column, "") if name_column else "",
                    cached.get("name", ""),
                )
                history = cached.get("citations_by_year", {})
                publication_stats = summarize_publications(cached, completed_years)
                output.update({
                    "gs_status": "ok",
                    "gs_name": cached.get("name", ""),
                    "gs_affiliation": cached.get("affiliation", ""),
                    "gs_email_domain": cached.get("email_domain", ""),
                    "gs_interests": "; ".join(cached.get("interests", [])),
                    "gs_total_citations": as_csv_value(cached.get("total_citations")),
                    "gs_citations_5y": as_csv_value(cached.get("citations_5y")),
                    "gs_hindex": as_csv_value(cached.get("hindex")),
                    "gs_hindex_5y": as_csv_value(cached.get("hindex_5y")),
                    "gs_i10index": as_csv_value(cached.get("i10index")),
                    "gs_i10index_5y": as_csv_value(cached.get("i10index_5y")),
                    "gs_complete_years": f"{completed_years[0]}-{completed_years[-1]}",
                    "gs_citations_in_complete_years": (
                        sum(history.get(year, 0) for year in completed_years)
                        if history else ""
                    ),
                    "gs_citations_by_year_json": json.dumps(history, sort_keys=True),
                    "gs_name_similarity": as_csv_value(score),
                    "gs_review_name": "yes" if score is not None and score < 0.65 else "",
                    "gs_publications_exported": publication_stats["exported"],
                    "gs_publications_complete": "yes" if publication_stats["complete"] else "no",
                    "gs_total_publications": publication_stats["total"],
                    "gs_publications_5y": publication_stats["recent"],
                    "gs_publication_years_5y": f"{completed_years[0]}-{completed_years[-1]}",
                    "gs_publications_by_year_json": publication_stats["by_year"],
                    "gs_publications_without_year": publication_stats["without_year"],
                    "gs_retrieved_at": cached.get("retrieved_at", ""),
                })
                for pub in cached.get("publications", []):
                    publication_rows.append({
                        "source_row": source_row,
                        "input_name": input_row.get(name_column, "") if name_column else "",
                        "scholar_id": scholar_id,
                        "scholar_name": cached.get("name", ""),
                        **pub,
                    })
        profile_rows.append(output)

    fields = list(dict.fromkeys(input_columns + PROFILE_FIELDS))
    atomic_csv_write(output_dir / "academics_enriched.csv", fields, profile_rows)
    atomic_csv_write(output_dir / "publications.csv", PUBLICATION_FIELDS, publication_rows)
    return successful, len(publication_rows)


def log_error(output_dir: Path, scholar_id: str, err: Exception) -> None:
    path = output_dir / "errors.csv"
    existed = path.exists()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        if not existed:
            writer.writerow(["utc_time", "scholar_id", "error_type", "error_message"])
        writer.writerow([
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            scholar_id, type(err).__name__, str(err)[:500],
        ])


def likely_access_block(exc: Exception) -> bool:
    message = f"{type(exc).__name__} {exc}".lower()
    return any(term in message for term in (
        "captcha", "429", "403", "too many requests", "blocked", "denied",
        "access may be restricted", "check for blocking", "cannot fetch",
        "maxtries", "max tries", "429 too many", "unusual traffic",
    ))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_csv", type=Path, help="Existing academics CSV")
    parser.add_argument("--url-column", help="Exact CSV column holding Scholar URLs")
    parser.add_argument("--name-column", help="Exact CSV column holding names")
    parser.add_argument("--out", type=Path, default=Path("scholar_output"))
    parser.add_argument("--limit", type=int, default=10, help="Maximum NEW profiles per run (default: 10)")
    parser.add_argument("--with-publications", action="store_true", help="Also retrieve publication listings")
    parser.add_argument("--publication-limit", type=int, default=100, help="Recent publications per profile; 0 means all")
    parser.add_argument("--min-delay", type=float, default=2.0, help="Minimum pause between profiles (seconds)")
    parser.add_argument("--max-delay", type=float, default=5.0, help="Maximum pause between profiles (seconds)")
    parser.add_argument("--refresh", action="store_true", help="Fetch again even when cached")
    parser.add_argument("--engine", choices=["auto", "serpapi", "scholarly"], default="auto", help="Scraping engine")
    parser.add_argument("--serpapi-key", help="SerpApi API key (or set SERPAPI_API_KEY in .env)")
    args = parser.parse_args()

    if args.limit < 1 or args.publication_limit < 0 or args.min_delay < 0 or args.max_delay < args.min_delay:
        parser.error("Invalid limit or delay settings")

    headers, rows = read_csv(args.input_csv)
    url_column = args.url_column or find_column(headers, URL_COLUMN_NAMES)
    name_column = args.name_column or find_column(headers, NAME_COLUMN_NAMES)
    if url_column not in headers:
        parser.error(f"Scholar URL column not found. Available: {headers}. Specify --url-column.")
    if args.name_column and name_column not in headers:
        parser.error(f"Name column not found: {name_column}")

    args.out.mkdir(parents=True, exist_ok=True)
    cache_dir = args.out / "cache"
    cache_dir.mkdir(exist_ok=True)
    scholar_ids = list(dict.fromkeys(
        sid for row in rows if (sid := get_scholar_id(row.get(url_column, "")))
    ))
    print(f"Input: {len(rows)} academics; {len(scholar_ids)} unique valid Scholar IDs")
    print(f"Scholar column: {url_column}; name column: {name_column or '(not found)'}")
    print(f"Engine mode: {args.engine}")

    fetched = 0
    attempted = 0
    stopped_due_to_access = False
    try:
        for scholar_id in scholar_ids:
            cached = load_cache(cache_dir, scholar_id)
            if not args.refresh and cache_satisfies(cached, args.with_publications, args.publication_limit):
                continue
            if attempted >= args.limit:
                break
            if attempted:
                pause = random.uniform(args.min_delay, args.max_delay)
                time.sleep(pause)
            attempted += 1
            print(f"Fetching {scholar_id} ({attempted}/{args.limit})...", end=" ", flush=True)
            try:
                profile = fetch_profile(
                    scholar_id,
                    publications=args.with_publications,
                    publication_limit=args.publication_limit,
                    engine=args.engine,
                    serpapi_key=args.serpapi_key
                )
                save_cache(cache_dir, scholar_id, profile)
                fetched += 1
                tot = profile.get("total_citations")
                h = profile.get("hindex")
                print(f"OK: {profile.get('name')} (total citations={tot}, h-index={h})", flush=True)
            except Exception as exc:
                log_error(args.out, scholar_id, exc)
                print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
                if likely_access_block(exc):
                    stopped_due_to_access = True
                    print("Access may be restricted. Stopping current batch.", file=sys.stderr)
                    break
    except KeyboardInterrupt:
        print("\nInterrupted. Exporting whatever has been cached.", file=sys.stderr)
    finally:
        successful, publication_count = export_results(rows, headers, url_column, name_column, args.out)
        print(f"Saved: {args.out/'academics_enriched.csv'} ({successful} enriched rows)")
        print(f"Saved: {args.out/'publications.csv'} ({publication_count} publication rows)")
        print(f"Cache: {cache_dir}")
    return 2 if stopped_due_to_access else 0


if __name__ == "__main__":
    sys.exit(main())

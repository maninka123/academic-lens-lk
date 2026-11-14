# Academic scraping and metric enrichment (Google Scholar + OpenAlex)

Scripts for Lanka Academia that fetch and verify, for newly added academics:

- total citations, h-index and i10-index
- citations 2021–2025 (exact sum of calendar years, not rolling)
- total publications (works count)
- an optional per-publication CSV (title, venue, citations, year)

Enriched people are appended to `New updates/newly_updated_academics.csv` for review.

## 1. Setup

Python 3.10 or newer.

```bash
python -m pip install -r requirements.txt
```

Put keys in `.env` (this folder or the project root; see `.env.example`). Never commit it.

```
OPENALEX_API_KEY=your_openalex_api_key_here
SERPAPI_API_KEY=your_optional_serpapi_key_here
```

- **OpenAlex:** a key raises the limit to 10 requests/s and 10,000 queries/day.
- **SerpApi (optional):** if set, Scholar lookups use it (no CAPTCHA, fast). Otherwise the suite falls back to polite direct scraping with `scholarly`.

## 2. Main pipeline: `enrich_academics.py`

**Mode A: enrich a CSV of new academics**

```bash
python enrich_academics.py my_new_academics.csv --out my_new_academics_enriched.csv
```

1. Detects name, university, faculty, department and Google Scholar URL columns.
2. With a `google_scholar_url`, reads verified Scholar metrics.
3. Without one (or without publications), searches OpenAlex with institution and name disambiguation.
4. Fills missing metrics, computes the 2021–2025 totals, writes the output file, and appends to `../New updates/newly_updated_academics.csv`.

**Mode B: scan the repository for gaps**

```bash
python enrich_academics.py --scan-repo --limit 50              # fill up to 50 people
python enrich_academics.py --scan-repo --limit 50 --sync-app   # and sync the web dataset
```

Finds academics in `Data files/universities/**/academics.csv` with missing metrics, retrieves and validates them, saves the departmental CSVs (UTF-8 BOM kept), logs to `research_metric_observations.csv` and `change_log.csv`, and appends to the new-updates file.

## 3. Dedicated tools

**Google Scholar (`scholar_scraper.py`)**: profiles and publications, with disk caching and resume.

```bash
python scholar_scraper.py academics.csv --limit 10
python scholar_scraper.py academics.csv --limit 10 --with-publications --publication-limit 100
python scholar_scraper.py academics.csv --engine serpapi        # auto, serpapi or scholarly
```

Writes to `scholar_output/`: `academics_enriched.csv` (original columns plus `gs_*`), `publications.csv`, and `cache/<scholar_id>.json`.

**OpenAlex (`openalex_scraper.py`)**: search and disambiguation.

```bash
python openalex_scraper.py --search-name "K.P. Hewagamage" --university "University of Colombo"
python openalex_scraper.py academics.csv --limit 50 --out scholar_output/openalex_enriched.csv
```

Disambiguation strips titles (Prof, Dr…), matches surname and initial sequences (e.g. `H.L. De Silva`), maps 20+ Sri Lankan universities to OpenAlex institution IDs, checks topic overlap with the department, and avoids high-volume homonyms.

## 4. Tracking file

Each enriched person is logged to `New updates/newly_updated_academics.csv`. Columns: `academic_id`, `full_name`, `university`, `faculty`, `department`, `academic_position`, `platform` (Google Scholar or OpenAlex), `profile_url`, `total_citations`, `citations_2021_2025`, `h_index`, `total_publications`, `y2021`–`y2025`, `retrieved_at`, `disambiguation_method`, `source_file_path`.

## 5. Offline tests

```bash
python test_scraper.py     # no network or API credits
```

Expected: `ALL OFFLINE SMOKE TESTS PASSED (scholar_scraper, openalex_scraper, enrich_academics)!`

## Publication counts

Google Scholar lists 20 publications at a time; the true total appears only after "Show more" until the list ends. The tool reads every page (`publication_limit=0`) and, with SerpApi, requests 100 per page and retries. If the list stops early it raises an error rather than report a partial count. Treat a recorded total of exactly 20 as suspect and re-run.

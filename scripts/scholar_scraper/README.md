# Academic Scraping & Metric Enrichment Suite (Google Scholar + OpenAlex)

A unified, self-contained suite of scraping and enrichment scripts for **Lanka Academia** and custom academic datasets. 

Whenever you add new academics, you can run the scripts in this folder to automatically fetch, verify, and calculate:
- **Total Citations** (all-time)
- **h-index** and **i10-index**
- **Recent Citations (2021–2025)**: Exact sum of calendar year citations from 2021 through 2025 (not rolling metrics)
- **Total Publications (Works Count)**
- **Individual Publications CSV** (titles, venues, citation counts, publication years)

All enriched academics are automatically appended to **`New updates/newly_updated_academics.csv`** so you can easily review newly added records at any time.

---

## 1. Quick Setup

Requires Python 3.10 or newer.

```bash
# 1. Install dependencies
python -m pip install -r requirements.txt

# 2. Configure API keys in .env (in this folder or the project root)
# See .env.example for template:
OPENALEX_API_KEY=KP8jHmgUSlRrNDDD7eo60Z
SERPAPI_API_KEY=your_optional_serpapi_key_here
```

> **API Key Tips**:
> - **OpenAlex**: Providing an API key raises your rate limit to 10 requests/second and 10,000 queries/day.
> - **SerpApi**: Optional. If present in `.env`, Google Scholar lookups use SerpApi for zero-CAPTCHA, high-speed profile retrieval. If omitted, the suite seamlessly falls back to direct polite scraping via `scholarly`.

---

## 2. Master Pipeline: `enrich_academics.py`

This is the primary tool to run when adding new academics.

### Mode A: Enrich a Custom CSV of Newly Added Academics
If you have a CSV containing newly added academics (e.g., `my_new_academics.csv`):

```bash
python enrich_academics.py my_new_academics.csv --out my_new_academics_enriched.csv
```

**What it does automatically:**
1. Detects name, university, faculty, department, and Google Scholar URL columns.
2. If `google_scholar_url` is present: pulls verified Scholar metrics (citations, h-index, 2021–2025 citations, publications).
3. If `google_scholar_url` is missing or lacks publications: searches OpenAlex using institutional and name disambiguation to find and verify the researcher.
4. Fills all missing metrics and calculates calendar year totals (2021–2025).
5. Writes the enriched records to `my_new_academics_enriched.csv`.
6. **Appends all newly enriched academics to `../New updates/newly_updated_academics.csv`**!

### Mode B: Scan and Enrich the Entire Lanka Academia Repository
To scan all departmental files (`repo_temp/Data files/universities/**/academics.csv`) and enrich any academics missing citation numbers or publication counts:

```bash
# Process up to 50 missing academics:
python enrich_academics.py --scan-repo --limit 50

# Process and immediately synchronize the web application dataset:
python enrich_academics.py --scan-repo --limit 50 --sync-app
```

**What it does automatically:**
- Identifies academics with missing metrics or publications.
- Retrieves and validates metrics via Scholar and OpenAlex.
- Saves updates in departmental CSVs preserving UTF-8 BOM (`utf-8-sig`).
- Logs metric observations into `Data files/research_metric_observations.csv`.
- Logs changes into `Data files/change_log.csv`.
- Appends to `../New updates/newly_updated_academics.csv`.

---

## 3. Dedicated Tools

### A. Google Scholar Extractor (`scholar_scraper.py`)
Scrapes and exports Google Scholar public profiles and publications with disk caching and resume support.

```bash
# Basic run: fetch metrics for up to 10 academics
python scholar_scraper.py academics.csv --limit 10

# Fetch complete publication listings and export publications.csv
python scholar_scraper.py academics.csv --limit 10 --with-publications --publication-limit 100

# Force specific engine (auto, serpapi, or scholarly)
python scholar_scraper.py academics.csv --engine serpapi
```

**Outputs generated in `scholar_output/`:**
- `academics_enriched.csv`: Enriched CSV with all original columns plus `gs_*` fields.
- `publications.csv`: One row per publication linked back to the academic.
- `cache/<scholar_id>.json`: Individual cached profile records.

---

### B. OpenAlex Searcher & Disambiguator (`openalex_scraper.py`)
Directly searches OpenAlex for Sri Lankan researchers, performs multi-factor disambiguation, and extracts citation history.

```bash
# Search for a single researcher:
python openalex_scraper.py --search-name "K.P. Hewagamage" --university "University of Colombo"

# Batch enrich a CSV of academics using OpenAlex:
python openalex_scraper.py academics.csv --limit 50 --out scholar_output/openalex_enriched.csv
```

**Disambiguation Engine Features:**
- Strips academic titles (`Prof`, `Dr`, `Associate Professor`, etc.).
- Matches exact surname and initial sequences (handles Sri Lankan names like `H.L. De Silva`).
- Maps 20+ Sri Lankan university abbreviations to OpenAlex ROR/Institution IDs.
- Calculates topic keyword overlap between university department and published papers.
- Avoids high-volume homonyms in unrelated fields.

---

## 4. Tracking Newly Added Academics

Whenever an academic is enriched, a new entry is logged to:
`New updates/newly_updated_academics.csv`

**Columns:**
1. `academic_id`: Unique identifier
2. `full_name`: Academic's full name
3. `university`: Institution affiliation
4. `faculty`: Faculty name
5. `department`: Department name
6. `academic_position`: Position/designation
7. `platform`: `Google Scholar` or `OpenAlex`
8. `profile_url`: URL of the verified profile
9. `total_citations`: Total all-time citation count
10. `citations_2021_2025`: Verified citations in the 5-year period (2021–2025)
11. `h_index`: h-index
12. `total_publications`: Total publication/works count
13. `y2021`, `y2022`, `y2023`, `y2024`, `y2025`: Yearly citations breakdown
14. `retrieved_at`: Date retrieved
15. `disambiguation_method`: Evidence and verification method
16. `source_file_path`: Source file path

---

## 5. Offline Testing

You can run the offline test suite at any time to verify the tools without consuming network requests or API credits:

```bash
python test_scraper.py
```
Outputs:
`ALL OFFLINE SMOKE TESTS PASSED (scholar_scraper, openalex_scraper, enrich_academics)!`

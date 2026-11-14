# Editable Sri Lanka academic dataset

## Where the data lives

- Authoritative rows exist only in `universities/<university-id>/faculties/<faculty-slug>/academics.csv` or its `departments/<department-slug>/academics.csv` leaves. Each ID occurs once.
- Faculty-level rows have no department. Unknown faculties use `unassigned-faculty`.
- Empty CSVs are placeholders, not statements that nobody works there.
- Faculty and department spellings are published evidence, not inferred broad-field mappings.

## Current population

**3,656 academic records** across 15 institutions (collection date 2026-11-14). Live figures: [validation report](../reports/validation-report.md) and [dataset_summary.json](../public/data/dataset_summary.json); this file does not repeat per-run counts. Saegis is excluded. The collection is incomplete and has not reached 5,000 distinct academics. Older local planning notes describe an earlier 1,601-record snapshot and are historical only.

## Editing rules

- Keep the exact 32-column header, UTF-8 CSV quoting and stable IDs.
- Numbers are unformatted and nonnegative. **Blank means unknown, not zero.**
- Positions and qualifications stay as published. PhD "Reading" or candidate entries are ongoing and have no completion year.
- Source-reported experience is not extrapolated.
- SLIIT's accepted spelling differs from the manifest name; `institution_aliases.csv` maps both to one `sliit` ID.
- Save CSV replacements atomically and checkpoint each unit. Do not create editable aggregate copies.
- Import and publish with `npm run data:import`, which regenerates `public/data/` and the reports.

## Supporting files

- **Coverage:** `universities.csv`, each `faculties.csv`, `faculty_department_inventory.csv`, `coverage.csv`, `coverage_dimensions.csv`. A visited page is not proof of complete staff coverage. `inventory_excluded_rows.csv` keeps rejected news, history and navigation labels.
- **Change history:** `baseline_records.csv`, `change_log.csv`, `collection_checkpoints.csv`, `field_evidence.csv`, `field_quality_review.csv`, `web_source_checks.csv`, `profile_verification.csv`.
- **Identity and employment:** `identity_duplicate_records.csv`, `identity_aliases.csv`, `academic_affiliations.csv` (confirmed duplicates, overlapping affiliations); `identity_review.csv`, `unit_review.csv`, `employment_review.csv` (unresolved cases).
- **Research metrics:** `research_metrics_snapshots.csv` (original snapshot header), `research_metric_observations.csv` (extra live h-index and yearly values), `research_identity_evidence.csv` (official links, observed conflicts), `research_search_log.csv` and `research_search_attempts.csv` (queries, URLs, freshness limits), `research_unresolved.csv` (remaining gaps).
- **Publications:** `publication_details.csv` (one link per academic and publication, including coauthorship), `publication_verification.csv` (conservative Crossref matches), `publication_extraction_review.csv`, `publication_duplicate_records.csv`, `publication_identity_review.csv`, `publication_coverage.csv`, `q1_partial_counts.csv`. `q1_methodology.md` defines the publication-year SJR rule; complete Q1 fields need historical evidence.
- **Sources and definitions:** `source_pages.csv` (legacy reads), `source_observations.csv` (HTTP retrievals), `access_issues.csv`, `data_dictionary.csv`. `field-mapping.json` is a manual, evidence-based mapping; unknown units stay `Unmapped`.
- `_exports/` holds optional read-only delivery archives; `_archive/` is preserved unchanged and excluded from the active ZIP.

Several of these evidence and review files are not published on the website; see [DATA_POLICY.md](../docs/DATA_POLICY.md) for the current public/private status.

## Collection notes

- **Uva Wellassa University (13 Oct 2026):** 204 published records across five faculties; 29 departments in the inventory, 20 with main academic records. 67 explicitly temporary or visiting appointments are outside the main population. See [UWU collection review](universities/uwu/COLLECTION_REVIEW.md).
- **Enriched export (14 Oct 2026):** 659 existing profiles improved; qualifications cover 1,210 records and Scholar links 767 (record count then: 1,601, historical).

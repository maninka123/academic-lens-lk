# Filling "Citations received 2021–2025" from Google Scholar

Back to the [main README](../README.md) · tool: `scripts/scholar-yearly.mjs`.

Google Scholar blocks automated access (HTTP 429 is logged in `Data files/access_issues.csv`), and this project does not bypass rate limits or CAPTCHAs. So the five yearly counts are **read from each profile's citation graph by a person** and loaded with a checked importer.

## Steps

1. `node scripts/scholar-yearly.mjs worklist` → `Data files/scholar_yearly_worklist.csv` (everyone with a verified Scholar profile and no 2021–2025 value).
2. Open each `scholar_url`. In the *Cited by* bar graph read the bars for **2021, 2022, 2023, 2024, 2025**. Enter them in `y2021 … y2025` and the date in `retrieved_at` (`YYYY-MM-DD`). A bar that is absent for a year Scholar displays means 0.
3. Save the file as `Data files/scholar_yearly_citations.csv`.
4. `node scripts/scholar-yearly.mjs apply`, then `npm run data:import`.

## Rules the importer enforces

- All five years must be present as whole numbers; partial sums are rejected.
- `scholar_id` must match the profile on record; wrong profiles are rejected.
- The 2021–2025 sum cannot exceed the recorded total citations.
- Existing values are never overwritten; differences are listed as conflicts.
- **Do not use Scholar's "Since 2021" column.** It includes 2026, so it is not a 2021–2025 count.
- Each applied value is logged in `change_log.csv` and `research_metric_observations.csv` with provider *Google Scholar* and the retrieval date.

Blank stays unknown; it is never treated as zero.

# Sri Lankan academics — editable export

Exported 13 October 2026. **1,397 unique academics across 14 Sri Lankan institutions. No international academics are included.**

## Where the app data comes from

Editable source records live in the individual `academics.csv` files under `Data files/universities/`. The `source_file` column identifies each record's exact original file. `npm run data:import` builds the application snapshot in `public/data/academics.csv`. Accepted OpenAlex lookups are also loaded separately for provider-specific comparisons. The app applies display-name conventions and the broad-field mapping when loading those records.

## How to update this file

- Edit the ordinary source columns, such as `full_name`, `academic_position`, `qualifications`, source URLs and research metrics. Keep `academic_id` and `source_file` unchanged so corrections can be merged into the original records.
- `app_*` columns are reference values from the saved app snapshot, with the current broad-field mapping and display-name convention. They show the app's effective values, including existing OpenAlex fallbacks. They are not the authoritative editable source fields.
- `openalex_*` columns keep the separate accepted OpenAlex values used for like-for-like comparisons. Failed or ambiguous lookup counts are left blank. They are not added to Scholar or ResearchGate counts.
- When adding or correcting research metrics, also record the provider in `research_metrics_source`, a supporting `metrics_source_url`, and the relevant evidence in `notes`. Do not combine different providers' counts. Existing per-metric provenance remains in `app_metricEvidence` as JSON.
- Leave unavailable values blank; use 0 only for a genuine measured zero. Keep names and source-backed qualification evidence as published. Prof/Dr alone does not establish a completed PhD.
- Save as UTF-8 CSV. The export includes a UTF-8 BOM for Excel. Quoted commas and line breaks are intentional CSV formatting.

**Editing this exported CSV does not automatically change the running app.** After editing, merge changes into the original files by `academic_id`, update supporting evidence where needed, run the dataset importer and checks, and rebuild/deploy the app. This export does not replace source history or pending identity review files.

## Editable source columns

| Column | Meaning |
|---|---|
| `academic_id` | Stable source-backed record identifier. Existing IDs preserved; confirmed alias IDs map through identity_aliases.csv. Not a national identifier. |
| `full_name` | Name as shown in an official directory or profile. Abbreviated names and unresolved spelling variants may remain. |
| `university` | One of the 14 institutions selected by the user. Saegis is excluded. |
| `faculty` | Published faculty, school or equivalent top-level academic unit; blank when parent affiliation unresolved. Exact wording retained unless correction logged. |
| `department` | Published department or equivalent academic unit, including an explicitly named teaching unit. Unknown parent uses unassigned-faculty/departments. |
| `academic_position` | Official position text. Some entries retain administrative roles. Employment verification is outstanding. |
| `qualifications` | Qualifications explicitly encountered in the staff entry or its biography. May be incomplete. Attribute degree text to the named person's own profile section; exclude shared staff panels, placeholder text, navigation and unrelated awards. Previous misattributed values remain traceable in change_log.csv. |
| `phd_university` | Doctoral awarding institution where conservatively resolved. Other degrees must not be substituted. |
| `phd_country` | Country of the doctoral awarding institution or explicit qualification wording; not nationality or necessarily study location. Basis retained; unknown remains blank. |
| `phd_completion_year` | Explicit year in the doctoral qualification evidence only. Do not use years from another staff member's shared panel. If the correct person's explicit doctoral entry lacks a date, leave the year blank. |
| `teaching_academic_experience_years` | Only documented source-reported duration or a sufficiently complete dated academic history. No extrapolation of an old claim. |
| `research_interests` | Interests explicitly encountered. Blank may mean not extracted rather than not published. |
| `total_publications` | Platform-specific total from a documented snapshot. Legacy ResearchGate item totals may include non-journal works; do not equate to Scholar or Q1 totals. |
| `total_citations` | Platform-specific all-time citations. Dated official-linked Scholar values and retained legacy ResearchGate values have field evidence; never add platforms. |
| `citations_2021_2025` | Citations received during the five complete calendar years 2021–2025, summed only when all five annual values are explicitly verified. Rolling Since values are not substituted. |
| `h_index` | Platform-specific all-time h-index from dated evidence. Unknown remains blank; does not measure Q1 publication coverage. |
| `total_q1_journal_publications` | Count of distinct journal articles in Q1 journals using a specified ranking system and publication-year quartiles. All values blank because classification was not performed. |
| `q1_publications_2021_2025` | Q1 journal articles published in calendar years 2021 to 2025. All values blank. |
| `staff_profile_url` | Individual profile when identified, otherwise the official directory containing the entry. |
| `google_scholar_url` | Profile linked from an official staff source where unambiguous. A link alone does not verify its current metrics. |
| `researchgate_url` | Officially linked or name-and-affiliation matched research profile. |
| `research_metrics_source` | Actual metric platform; mixed-source records explicitly labelled and each populated metric attributed in field_evidence.csv. |
| `metrics_source_url` | Exact researcher profile supporting the research counts. |
| `collected_at` | Date of collection, not the last time the original website was updated. |
| `employment_status` | Explicit permanent staff evidence is marked permanent_officially_listed. Existing uncertain staff are retained. New unsupported appointment types stay in employment_review.csv. |
| `record_status` | Evidence and review state; directory listing alone does not prove current full-time employment. |
| `research_lookup_status` | Actual search/official linkage/metric retrieval status. A submitted query is not an identity match. |
| `phd_status` | listed_completed, in_progress, or not_published_or_not_extracted. Unknown is not evidence of no PhD. |
| `phd_country_basis` | How the country was established: explicit in qualification evidence or the institution name, or inferred_from_institution_name (a hand-checked institution-to-country mapping; the country is not stated in the source). Inferred countries are labelled on the site. |
| `qualification_evidence` | Supporting qualification text. Use the associated staff profile URL. Automated extraction requires review. |
| `experience_evidence` | Source wording for reported experience, which may be an approximate number or an older snapshot. |
| `notes` | Specific source freshness and interpretation limitations. |

## Merge completed 14 October 2026

Your enriched input and original baseline are preserved. `sri_lankan_academics_merged.csv` contains the refreshed 1,601-record dataset, including UWU, with current `source_file` paths and app reference columns. The accepted values and their provenance are in the source hierarchy and app data; held proposals remain in `reports/enriched-merge-2026-10-14/field-decisions.csv`.

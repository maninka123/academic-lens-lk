# Continue collecting Lanka Academia data

Continue from the existing **Data files/** directory. Preserve all existing IDs and evidence; do not restart. Inspect the actual files and report their current count instead of assuming the outdated claim of 3,468 records. The initial imported snapshot had 1,173 unique academics.

## Work boundary

Work only in `Data files/` and a separate export location for a deliverable ZIP. The application is being developed in parallel. Do not edit `src/`, `public/`, `scripts/`, application configuration, screenshots, or deployment files. Do not deploy or push the project. Do not replace the directory with an older flat ZIP. Save incremental progress directly in the authoritative hierarchy.

## Scope

Cover Colombo, Peradeniya, Sri Jayewardenepura, Kelaniya, Moratuwa, Jaffna, Ruhuna, General Sir John Kotelawala Defence University, SLIIT, NSBM, CINEC, Horizon, KIU, ICBT, and Uva Wellassa University of Sri Lanka (uwu). Exclude Saegis. Use the exact institution names and IDs in `universities.csv`.

## Inspect first

Read `README.md`, `data_dictionary.csv`, `COLLECTION_NOTES.txt`, all active academic CSVs, faculty inventories, coverage reports, unresolved fields, research lookup and source/access logs. The `_archive/` folder is a historical backup, not an input. Summarise actual unique academics, institutions and units covered, verified identities, populated metrics, missing fields, and pending directories. Distinguish staff-directory coverage from individual-field completeness.

## Authoritative structure

Every institution follows:

```text
Data files/universities/<university-id>/faculties/<faculty-slug>/academics.csv
Data files/universities/<university-id>/faculties/<faculty-slug>/departments/<department-slug>/academics.csv
```

Each person appears in exactly **one** active academic CSV. Faculty-level CSVs contain only people without a documented department. People with a documented department go in that department's CSV. Unknown faculty uses `unassigned-faculty`; a documented department may sit under it. Do not infer organisational membership. Preserve actual published faculty and department names in the CSV, independently of folder slugs. Use lowercase hyphenated slugs consistently, reusing existing folders before creating new ones. Header-only placeholder CSVs are valid.

Keep every existing academic CSV header, column, and ID. Obtain the header from an existing authoritative file. Do not add a second master CSV or duplicate institution-level academic copies. `universities.csv` and each institution's `faculties.csv` are inventories. Supporting logs and evidence CSVs live at the root of `Data files/`, linked by `academic_id`.

For corrections to a person's documented unit, move the existing row to the right authoritative CSV without duplicating it. Maintain a change log. Do not merge ambiguous names. New IDs must be stable, collision-free, and documented; preserve existing IDs unchanged.

## Complete coverage and person-level evidence

Check every official faculty, school, department and equivalent unit's staff directory and personal profiles. Add missing academics, prioritising KIU and ICBT. Prefer current permanent/full-time staff. Record visiting, honorary, adjunct, retired, temporary, or uncertain staff in `employment_review.csv`; do not infer employment from titles. Preserve uncertain existing records with status and evidence rather than silently deleting them.

Collect full name, institution, faculty, department, published position, qualifications, completed PhD institution/country/year, documented academic experience, research interests, publications, citations, citations received during 2021–2025, h-index, total Q1 journal publications, and Q1 journal publications published during 2021–2025. Keep profile URLs, Scholar/ResearchGate URLs, retrieval dates, snapshot dates, identity checks, verification status and notes in the existing schema. Record ORCID and field-level provenance in supporting evidence tables when the existing academic schema has no corresponding column. Do not infer gender, age, qualification, or experience from a person's name, photo or title.

Search Scholar for every person. Prefer official-profile links; otherwise verify affiliation, field and publication history. ResearchGate is a labelled backup; verified OpenAlex identities can supplement it. Do not combine platform counts or present them as interchangeable. Preserve source-specific snapshots and timestamps. An inaccessible profile means unknown, not zero.

For five-year citations, count citations **received in calendar years 2021–2025**, not citations to papers published in those years and not a rolling “since” value. Blank unknown numeric fields remain blank; explicit zero requires evidence. Do not infer a doctorate from “Dr”, substitute a master's university, or treat an ongoing doctorate as completed. Calculate experience only from a sufficiently complete dated academic employment history, documenting the calculation.

Keep publication evidence in `publication_details.csv`, linked by academic_id: title, authors, year, journal/venue, DOI, publication type, source URL, citation source/count, and quartile evidence. Deduplicate by DOI, then normalised title/year conservatively; retain authorship verification.

Use a consistent documented quartile source and **publication-year** journal classification; record category, classification year and evidence URL. Q1 counts include journal articles only. Partial bibliographies or incomplete historical quartiles must not become complete Q1 totals; store verified partial counts separately. Describe the policy in `q1_methodology.md`. Optional `metadata.json` may set `collectionDate`, `window`, `scopeNote`, `description`, `limitations`, or `q1Methodology`; read the existing values before changing the measurement window.

## Incremental handoff

Save after each completed faculty/department and maintain checkpoint, source, access-issue, identity/employment review, unresolved-field, coverage and change logs. Respect access restrictions, CAPTCHAs and rate limits. Correct existing values only with stronger evidence, recording the old value, new value, source, date and reason. Never fabricate unavailable fields.

Validate CSV parsing, identical academic headers, stable unique IDs across all active leaf files, valid institution names/IDs, numeric fields, source links, publication deduplication, organisational membership, and inventory consistency. Count only authoritative leaf records, excluding archives and supporting evidence rows.

Deliver the updated hierarchical **Data files/** folder and a ZIP preserving the same relative structure, updated inventory/data dictionary/README, supporting evidence and logs, and a concise handoff reporting actual records added/corrected, verified research profiles, metric completeness, units checked and still pending. Do not claim an institution complete until every identified unit has been checked. Deliver available evidence even when some fields remain unknown. The app developer will run `npm run data:import` and deployment after handoff.

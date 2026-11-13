# Data policy: publication, attribution, reuse and corrections

## What is published

The website is static. Although the repository is private, the deployed site and every file under `public/data/` (copied to `dist/data/`) can be read by anyone with the link. Only the files and columns listed in [`scripts/public-assets.mjs`](../scripts/public-assets.mjs) are published:

| File | Content |
|---|---|
| `academics.csv` | Public fields of each collected academic record (published name, institution, unit, position, qualifications as published, doctorate status, research metrics with provider and date, source links with tracking and session parameters removed, evidence status) |
| `universities.csv`, `faculties.csv`, `departments.csv` | Institutional hierarchy represented in the collection |
| `coverage_summary.csv` | Per-institution coverage indicators (records, verified identity, verified employment, metric availability, units discovered/visited, review counts) |
| `dataset_summary.json`, `metadata.json`, `datasets.json` | Snapshot summary, version, limitations and dataset registry |
| `data_dictionary.csv`, `field-mapping.json` | Field definitions and the manual field mapping |
| `international/*` | International benchmark samples, benchmark universities and departments, and matched OpenAlex values for Sri Lankan academics |
| `world.geo.json` | Natural Earth boundaries (world-atlas) |

**Kept private** (in `Data files/`, never published): identity review and duplicate records, employment and unit reviews, unresolved research searches, research identity evidence, field-level evidence and correction logs (`field_evidence.csv`, `missing_field_resolutions.csv`, `change_log.csv`), profile verification logs, access issues, source page logs, collection notes and handoff reports.

### Automated safeguards

- `npm run data:import` publishes only allowlisted files and columns, removes stale files from `public/data`, strips signed tokens, session and tracking parameters from every published URL (Google Scholar links keep only `user`), and fails if the public check finds a problem.
- `node scripts/check-public-assets.mjs` (and `… dist` after a build) fails on any file outside the allowlist, internal evidence columns, or credential-like strings (GitHub, AWS, Slack and API keys, private keys, `token=`/`key=`/`sig=` parameters).
- The GitHub workflow runs both checks and uploads the built site as an artifact for inspection. Successful pushes to `main` automatically deploy to GitHub Pages after all build, test, and public-output checks pass. Pull requests only build and check. Manual republishing remains available (`workflow_dispatch`) on `main`.

## Source attribution

Academic records are compiled from official university websites (directories and individual profile pages). Research metrics come from Google Scholar, ResearchGate and OpenAlex as recorded with each value, with retrieval dates. International benchmark rosters come from official department directories; benchmark rankings come from the QS World University Rankings 2027. Map boundaries: Natural Earth via world-atlas.

Cite the dataset with its snapshot version (shown on the site and in `dataset_summary.json`), for example: *Lanka Academia, dataset version partial-xxxxxxxxxx, collected YYYY-MM-DD.*

## Limitations that apply to every use

- The collection is a **partial set of published profiles**, not a census of academic staff. Directory coverage is incomplete for every institution, and an institution or unit without collected profiles is not one without staff.
- Employment is verified only where an official source states it. A listing is not proof of current employment.
- A completed doctorate is counted only with explicit evidence; titles and recorded institutions are not evidence of completion.
- Bibliometric providers report different counts. Do not combine or compare values from different providers.
- International benchmarks are samples (up to 25 academics per department), not national censuses.
- No measure on the site is an assessment of an individual's academic quality or teaching.

## Reuse conditions

Aggregate statistics and original research reports are licensed under CC BY 4.0: reuse them with attribution and the dataset version (see [DATA_LICENSE.md](legal/DATA_LICENSE.md)). Individual-level records are not covered by that licence. Individual-level records describe identifiable people: reuse them only for research or educational purposes consistent with the limitations above, do not use them to rank or evaluate named individuals, and do not republish them outside their source context. Respect the terms of the original sources.

## Corrections and removal requests

Requests for a factual correction or for removal of a record can be made through the project repository.

1. Send the profile link (or the academic ID), the field concerned and, for corrections, an official source supporting the change. Use the project repository (GitHub issue form or private advisory), as linked on the Methodology page.
2. The maintainer checks the evidence against official sources. Corrections are applied to the authoritative CSV in `Data files/universities/…`; the previous value, source and date are logged privately in `change_log.csv`/`field_evidence.csv`. Academic IDs never change.
3. Removal requests: the record is removed from the published files at the next import and recorded privately (ID, date, reason) so it is not re-collected. Evidence needed for research integrity is retained privately.
4. Re-run `npm run data:import`, check the public output, and deploy manually.

Our target is to respond to requests within 14 days.

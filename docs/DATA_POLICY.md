# Data policy: publication, attribution, reuse and corrections

## What is published

The website is static. The repository is public, and the deployed site and every file under `public/data/` (copied to `dist/data/`) can be read by anyone with the link. Only the files and columns listed in [`scripts/public-assets.mjs`](../scripts/public-assets.mjs) are published:

| File | Content |
|---|---|
| `academics.csv` | Public fields of each collected academic record (published name, institution, unit, position, qualifications as published, doctorate status, research metrics with provider and date, source links with tracking and session parameters removed, evidence status) |
| `universities.csv`, `faculties.csv`, `departments.csv` | Institutional hierarchy represented in the collection |
| `coverage_summary.csv` | Per-institution coverage indicators (records, verified identity, verified employment, metric availability, units discovered/visited, review counts) |
| `dataset_summary.json`, `metadata.json`, `datasets.json` | Snapshot summary, version, limitations and dataset registry |
| `data_dictionary.csv`, `field-mapping.json` | Field definitions and the manual field mapping |
| `international/*` | International benchmark samples, benchmark universities and departments, and matched OpenAlex values for Sri Lankan academics |
| `world.geo.json` | Natural Earth boundaries (world-atlas) |

**Internal evidence and review files** (identity and employment reviews, unresolved searches, correction logs such as `change_log.csv`, collection notes, rejected matches) are not published. They stay in the local, git-ignored `Data files/` folder (or `private/`) and in the maintainer's private backup. They are not in the current repository.

Internal verification and review files are excluded from the current published dataset. Earlier versions may remain accessible through Git history or third-party copies.

**Published free text.** The `notes` column is a short provenance statement ("Listed on the official staff page"), produced at import by `scripts/public-notes.mjs`. Internal review wording, remarks about an individual's leave or employment, and links to personal social profiles (LinkedIn, Facebook, X and similar) are removed before publication; the full note stays private. `caution` and `qualificationReview` are published deliberately as reader-facing context and contain no investigation detail.

### Automated safeguards

Details and how to extend them: [PRIVACY_SAFEGUARDS.md](PRIVACY_SAFEGUARDS.md).

- `npm run data:import` publishes only allowlisted files and columns, removes stale files from `public/data`, strips signed tokens, session and tracking parameters from every published URL (Google Scholar links keep only `user`), and fails if the public check finds a problem.
- `node scripts/check-public-assets.mjs` (and `… dist` after a build) fails on any file outside the allowlist, internal evidence columns, credential-like strings, and personal links, contact details or internal wording in published free text.
- `node scripts/privacy-guard.mjs` checks the whole tracked repository (not only `public/data`) for internal evidence file names and folders, tracked-but-git-ignored files and credentials. It runs as a pre-commit hook, a pre-push hook (which also inspects the commits being pushed) and as a required step in the GitHub workflow.
- The GitHub workflow runs these checks, then builds and uploads the site as an artifact for inspection. Successful pushes to `main` deploy to GitHub Pages after all checks pass. Pull requests only build and check. The workflow does not run the data import: `public/data` is generated locally with `npm run data:import` and committed.

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

Aggregate statistics and original research reports are licensed under CC BY 4.0. Individual academic records are excluded from this licence and may be subject to other applicable rights.

We recommend using these data for research and educational purposes, avoiding evaluations of named individuals, and retaining appropriate source context. This guidance is advisory.

## Corrections and removal requests

Requests for a factual correction or for removal of a record can be made through the project repository.

1. Send the profile link (or the academic ID), the field concerned and, for corrections, an official source supporting the change. Use the project repository (GitHub issue form or private advisory), as linked on the Methodology page.
2. The maintainer checks the evidence against official sources. Corrections are applied to the authoritative CSV in `Data files/universities/…`; the previous value, source and date are logged privately in `change_log.csv`/`field_evidence.csv`. Academic IDs never change.
3. Removal requests: run `node scripts/removals.mjs add <ID> --reason "…"`. The record is removed from the source file and the published files at once, archived privately, and entered in a private list (ID, date, reason) that every import and the privacy guard enforce, so it is not re-collected or re-published. Evidence needed for research integrity is retained privately.
4. Re-run `npm run data:import`, check the public output, and deploy manually.

Our target is to respond to requests within 14 days.

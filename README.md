<div align="center">

# Lanka Academia

**Explore who teaches and researches at Sri Lankan universities, how they compare, and where their PhDs were awarded.**

`Ongoing Research | Public Preview`

[**Open the app**](https://maninka123.github.io/academic-lens-lk/) | [Application README](App/README.md) | [Dataset guide](Data/Lanka-Academia/README.md) | [Report a correction](https://github.com/maninka123/academic-lens-lk/issues/new/choose)

![License: MIT](https://img.shields.io/badge/code-MIT-blue) ![Stats: CC BY 4.0](https://img.shields.io/badge/stats-CC%20BY%204.0-blue) ![Status: partial collection](https://img.shields.io/badge/data-partial%20collection-orange)

</div>

<!-- dataset-summary:start -->
<!-- Snapshot partial-aad29575e2 -->
**7,615 Sri Lankan profiles | 23 institutions | 1,774 international benchmark profiles.** Partial collection, updated 2026-11-22. [Coverage report](App/reports/validation-report.md).
<!-- dataset-summary:end -->

Lanka Academia is a public dataset and web app of academics at Sri Lankan universities: positions, doctoral qualifications, where and when PhDs were awarded, and research metrics from public sources.

![Overview](App/docs/screenshots/overview.png)

## Where things are

| Path | What is in it |
|---|---|
| [`App/`](App/README.md) | The website (React, Vite, TypeScript): source, generated site data, import and check scripts, tests, design system, documentation and reports |
| [`Data/Lanka-Academia/`](Data/Lanka-Academia/README.md) | The single authoritative dataset: one CSV per department, plus rankings and public review files |
| [`App/docs/`](App/docs/PROJECT_GUIDE.md) | Methodology, data policy, workflows, legal notices and screenshots |
| [`App/reports/`](App/reports/validation-report.md) | Generated coverage and validation reports |
| `.github/` | CI workflow, issue forms and the private-request guide |

Internal research evidence and the private doctoral-training study are **never** committed (see [Privacy safeguards](App/docs/PRIVACY_SAFEGUARDS.md)).

## Run locally

Node.js 22.12 or newer. No backend is needed.

```sh
cd App
npm ci
npm run dev        # http://localhost:5173/academic-lens-lk/
```

| Task | Command |
|---|---|
| Re-import data after editing the CSVs in `Data/Lanka-Academia/` | `npm run data:import` |
| Type-check, unit and script tests | `npm test` |
| Privacy and public-asset checks | `npm run check:privacy` and `npm run check:public` |
| Production build | `npm run build` |
| End-to-end tests | `npm run test:e2e` |

## How the data works

- **Missing stays missing.** An unknown value is never treated as zero.
- **Only completed doctorates count.** Reading for a PhD is in progress, never completed, and a study period is not a completion year.
- **Every comparison shows its source, sample size and coverage.** Citation counts are not a measure of academic quality.
- **Corrections and removals** are welcome through the issue form; accepted removals are permanent.

## Please note

> [!IMPORTANT]
> This project uses only publicly available information. The data is a **partial collection**, may be incomplete, outdated or wrong, and is **not** an assessment of any individual. Verify details with the original sources. Anyone named here can ask for a correction or removal, without giving a reason: [open a request](https://github.com/maninka123/academic-lens-lk/issues/new/choose).

## Licence

| | |
|---|---|
| **Code** | [MIT](LICENSE) |
| **Aggregate statistics and reports** | [CC BY 4.0](App/docs/legal/DATA_LICENSE.md). Individual records are excluded from this licence. |
| **Notice, privacy and ethics** | [NOTICE](App/docs/legal/NOTICE.md), [PRIVACY](App/docs/legal/PRIVACY.md), [ETHICS_AND_DATA](App/docs/legal/ETHICS_AND_DATA.md) |

Copyright (c) 2026 Pasindu Ranasinghe.

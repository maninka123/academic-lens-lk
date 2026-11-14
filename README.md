<div align="center">

# Lanka Academia

**Explore who teaches and researches at Sri Lankan universities, how they compare, and where their PhDs were awarded.**

`Ongoing Research | Public Preview`

[**Open the app**](https://maninka123.github.io/academic-lens-lk/) | [Documentation](docs/PROJECT_GUIDE.md) | [Dataset guide](Data%20files/README.md) | [Report a correction](https://github.com/maninka123/academic-lens-lk/issues/new/choose)

![License: MIT](https://img.shields.io/badge/code-MIT-blue) ![Stats: CC BY 4.0](https://img.shields.io/badge/stats-CC%20BY%204.0-blue) ![Status: partial collection](https://img.shields.io/badge/data-partial%20collection-orange)

</div>

<!-- dataset-summary:start -->
<!-- Snapshot partial-e191f13547 -->
**3,656 Sri Lankan profiles | 15 institutions | 1,740 international benchmark profiles.** Partial collection, updated 2026-11-14. [Coverage report](reports/validation-report.md).
<!-- dataset-summary:end -->

## Screenshots

Light theme shown. Every page and popup also has a dark theme (Appearance switch in the sidebar), and works from phone to wide desktop.

![Overview](docs/screenshots/overview.png)

| Universities | Academic profile and research standing |
|---|---|
| ![Universities](docs/screenshots/universities.png) | ![Academic profile](docs/screenshots/profile.png) |

| Compare | PhD origins |
|---|---|
| ![Comparison Studio](docs/screenshots/compare.png) | ![PhD origins](docs/screenshots/origins.png) |

| Global benchmarks | Mobile |
|---|---|
| ![Global benchmarks](docs/screenshots/global.png) | <img src="docs/screenshots/mobile.png" alt="Mobile view" width="220" /> |

## What you can do

| | |
|---|---|
| **Universities** | A card per institution: profiles, PhD share, PhD from abroad, median citations and h-index. |
| **Academics** | Search profiles, view up to three people side by side, and download a profile report (PDF) or its data (CSV). |
| **Research standing** | A transparent 0-100% score showing where a person sits among comparable academics. Click it to see the calculation. |
| **Compare** | Build your own comparisons across universities, faculties, departments, positions and PhD countries. |
| **PhD origins** | Where doctorates were awarded and how that differs by institution, position and discipline. |
| **Global benchmarks** | Sri Lanka against elite, middle and lower QS-ranked universities in seven countries, by discipline and seniority. |
| **Light and dark** | One design system across every page, chart, popup and drawer; light, dark or follow the device. |

## Repository layout

| Path | What is in it |
|---|---|
| `src/` | The web app (React, TypeScript, ECharts) and its styles |
| `design-system/` | Design tokens and the written reference (`DESIGN.md`) |
| `Data files/` | The editable dataset: one CSV per department, plus rankings and review files |
| `public/` | Files served by the site (generated data, images, map) |
| `scripts/` | Data import, metric collection (OpenAlex, Google Scholar) and checks |
| `tests/` | Browser tests and their Playwright config |
| `docs/` | Guides and policies; legal notices are in `docs/legal/` |
| `.github/` | CI workflow, issue forms and `SECURITY.md` (private-request guide) |
| `reports/` | Generated coverage and validation reports |
| `private/` | Local only, never committed (API keys, ethics documents) |

## Run locally

Node.js 22.12 or newer. No backend is needed.

```sh
npm ci
npm run dev        # http://localhost:5173/academic-lens-lk/
```

| Task | Command |
|---|---|
| Re-import data after editing the CSVs in `Data files/` | `npm run data:import` |
| Type-check, unit and script tests | `npm test` |
| Production build | `npm run build` |
| End-to-end tests | `npm run test:e2e` |


## How the data works

- **Missing stays missing.** An unknown value is never treated as zero.
- **Every comparison shows its source, sample size and coverage.** Citation counts are not a measure of academic quality.
- **Adding people:** list pages give names and positions; each person's own profile page gives their Google Scholar and ResearchGate links, which are then used for metrics before any name search.
- **Titles:** **Prof** for documented professorial positions, otherwise **Dr** for a completed research doctorate.
- **Asterisk (\*)** marks a documented completed research doctorate. A medical qualification alone does not count.
- **Research standing:** [how the score is calculated](docs/STANDING_SCORE.md) | **Yearly citations:** [how to add them](docs/SCHOLAR_YEARLY.md)

More: [Methodology & setup](docs/PROJECT_GUIDE.md) | [Data policy](docs/DATA_POLICY.md) | [Collection prompt](docs/DATA_COLLECTION_PROMPT.md)

## Global benchmark method

Research comparisons use matched OpenAlex profiles on both sides, with Computer Science and Physics selected by default. Selected Medicine, Engineering, Law, Management and Business profiles are also included; their unverified metrics stay blank. [Dataset details](Data%20files/international/README.md).

<details>
<summary>Method, sampling and substitutions</summary>

- QS World University Rankings 2027, published 18 June 2026. Each country contributes two elite universities (top two with accessible directories), two middle-tier universities (~420-560) and two lower-tier universities (~800-1200). Australia has one lower-tier sample because other directories blocked access.
- Official staff directories exclude visiting, adjunct, courtesy and emeritus roles. Departments larger than 25 are sampled systematically in directory order. These are samples, not national censuses.
- OpenAlex matches require name and institution agreement. Ambiguous or implausibly merged profiles remain blank; lookup attempts are not matches. Groups need at least 10 valid values to report a median.
- Use the career-stage control to compare similar positions. Elite samples often contain more professors than Sri Lankan directories.
- Data and source rosters: [international dataset](Data%20files/international/). Build scripts: [scripts/baselines](scripts/baselines/).

### Substitutions

Where a first-choice directory was unreachable, the next university in the same band was used:

| Used | Instead of | Reason |
|---|---|---|
| ANU (AU, elite) | Melbourne (QS 22) | directories return HTTP 403 |
| Murdoch (AU, middle) | Canberra (QS 477) | HTTP 403; Murdoch lists senior academics only |
| UniSC (AU, lower) | Charles Sturt (951-1000) | HTTP 403; no physics, so engineering used |
| CDU (AU, middle) | Canberra, JCU, CQU, ECU | all block automated access; no physics, only IT sampled |
| IIT BHU (IN, middle) | Anna University (470) | sites unreachable |
| IIT Indore (IN, middle) | none | physics site returns 403; only CSE sampled |
| IIT Bhubaneswar (IN, lower) | Aligarh Muslim | JavaScript-only pages |
| Bordeaux (FR, middle) | Montpellier (473) | JavaScript-only directory |
| CY Cergy (FR, lower) | Nantes (901-950) | AJAX-protected; only computing sampled |
| Windsor (CA, middle) | Guelph (546) | JavaScript-only directory |
| Würzburg (DE, middle) | Leipzig (540) | no professor lists |
| TU Chemnitz (DE, lower) | Bielefeld (1001-1200) | no consolidated professor list |
| Wuppertal (DE, lower) | Oldenburg | no consolidated professor list |

</details>

## Please note

> [!IMPORTANT]
> This project uses only publicly available information. The data is a **partial collection**, may be incomplete, outdated or wrong, and is **not** an assessment of any individual. Verify details with the original sources. Anyone named here can ask for a correction or removal, without giving a reason: [open a request](https://github.com/maninka123/academic-lens-lk/issues/new/choose).

## Acknowledgements

Map boundaries: [Natural Earth / world-atlas](https://github.com/topojson/world-atlas) | Research indexes: [OpenAlex](https://openalex.org) | University rankings: QS World University Rankings 2027 | Flag icons: [country-flag-icons](https://github.com/catamphetamine/country-flag-icons) | Campus photographs are credited to their owners in [docs/CAMPUS_IMAGES.md](docs/CAMPUS_IMAGES.md).

## Licence

| | |
|---|---|
| **Code** | [MIT](LICENSE) |
| **Aggregate statistics and reports** | [CC BY 4.0](docs/legal/DATA_LICENSE.md): free to use with credit. Individual records are excluded from this licence. |
| **Notice** | [Data may be wrong, no warranty, third-party material](docs/legal/NOTICE.md) |
| **Privacy and data use** | [PRIVACY.md](docs/legal/PRIVACY.md): what is collected, why and how long it is kept |
| **Ethics and data statement** | [ETHICS_AND_DATA.md](docs/legal/ETHICS_AND_DATA.md) |

Copyright (c) 2026 Pasindu Ranasinghe.

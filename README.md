# Sri Lanka Academic Atlas

Explore Sri Lankan academic profiles, compare peer groups, and keep research data coverage visible.

**[Open the website](https://maninka123.github.io/academic-lens-lk/)** · [Editable dataset guide](Data%20files/README.md) · [Collection prompt](DATA_COLLECTION_PROMPT.md)

![Academic Atlas overview](docs/screenshots/overview.png)

## What you can do

- Compare institutions, faculties, departments, fields, ranks, qualifications, PhD origins and custom groups.
- Pin academics across chart changes and inspect their values, peer statistics and percentile positions.
- Switch between appropriate totals, means, medians and distributions; compare pooled academics with equal university weighting.
- Explore scatter/bubble plots, boxes, histograms, composition charts, heatmaps and treemaps.
- Search every person by name, open their full profile, and follow their university → faculty → department hierarchy. Profile charts compare the same position, qualification, both, or PhD holders at every level.
- Benchmark Sri Lanka internationally on **Global Benchmarks**: 1,630 sampled Computer Science and Physics academics from 41 universities in seven countries (USA, Australia, China, India, Canada, France, Germany), grouped into QS 2027 elite, middle and lower tiers. Compare Sri Lanka against each tier, by country and university, and against QS position; the Comparison Studio can add the tiers or the benchmark universities as extra groups.
- Explore a locally bundled world map and PhD Sankey. Illustrated profile placeholders reflect documented qualifications and positions; appearance styles are user selected, with no gender inference.
- Save custom groups in your browser, share configurations by URL, and export charts as PNG or records as CSV.
- Keep people without a documented department at faculty level, with no invented department groups.
- Use light/dark appearance, keyboard-accessible fullscreen charts, and readable desktop, tablet and mobile layouts.

![Comparison Studio](docs/screenshots/comparison-studio.png)

![Individual profile and peer comparisons](docs/screenshots/person-profile.png)

[Interface audit and edge-case coverage](docs/AUDIT.md)

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Open the URL shown by Vite. The application is React + TypeScript + Vite, with Tailwind, shadcn-style Radix components, Apache ECharts, TanStack Table, Zustand and HashRouter. All dashboard data and map assets are local; no backend, accounts or paid APIs are required.

```sh
npm run typecheck
npm test                 # Statistics and component interactions
npm run build            # Static production output in dist/
npm run preview
npm run test:e2e          # Isolated Chrome browser checks and screenshot capture
```

Browser tests use installed Chrome. To use Playwright's bundled Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and run `npx playwright install chromium`.

## Update the data

Edit the authoritative CSVs in `Data files/universities/<institution>/faculties/…`. Each academic appears once, in either a faculty CSV without a named department or a department CSV. Keep IDs and the existing header. Blank numeric cells mean unknown; zero requires evidence.

```sh
npm run data:import
npm test
npm run build
```

Optional `Data files/metadata.json` can configure collection dates and the metric window; `q1_methodology.md` documents any verified Q1 policy.

The importer discovers new academic CSVs recursively and regenerates `public/data/{academics,universities,faculties,departments}.csv` and metadata. Duplicate IDs, malformed CSVs and invalid numeric values stop import. Update `Data files/field-mapping.json` for manual field classifications; ambiguous units stay Unmapped. See the [dataset guide](Data%20files/README.md) for folder rules and the [collection prompt](DATA_COLLECTION_PROMPT.md) for independent research work.

The updated collection has **1,393 unique academic records across 12 populated institutions**, with **14 institutions in scope**. It adds 233 records and preserves 13 merged identities as aliases relative to the initial 1,173 records. There are 294 citation values, 241 h-index values and 131 exact five-year citation values; complete Q1 totals remain unavailable. Employment verification and collection coverage are partial. Per-metric sources distinguish live Scholar measurements from indexed ResearchGate snapshots.

The website always uses the collected dataset. Visitors cannot switch datasets, and shared links cannot change the data source. Synthetic records live only in `tests/fixtures/` for browser testing and are excluded from production.

## International baselines

`Data files/international/` holds the benchmark samples in the same 32-column layout, nested by country, with the QS 2027 rank and tier of each university, the source rosters and the OpenAlex match evidence. See its [README](Data%20files/international/README.md) for selection, sampling and limitations. To rebuild them:

```sh
pip install requests beautifulsoup4 pypinyin
python scripts/baselines/build_international.py
python scripts/baselines/sri_lanka_openalex.py   # optional: like-for-like OpenAlex metrics for Sri Lanka
npm run data:import
```

OpenAlex responses are cached in `scripts/baselines/_cache/`. Set `OPENALEX_API_KEY` to go beyond the small anonymous daily budget.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` imports the current editable data, validates TypeScript, runs tests, builds and deploys whenever `main` changes. Set repository **Settings → Pages → Source → GitHub Actions**. Pull requests run checks without deploying.

Vite uses `/academic-lens-lk/` as its base; HashRouter keeps deep links working on Pages. If you rename the repository, update `vite.config.ts`. Commit source/data changes and let the workflow rebuild; `dist/`, dependencies, local test traces and original collection backups are excluded from Git.

## Interpreting comparisons

Missing values are excluded from metric denominators. Percentiles use midrank ties and are suppressed below five valid peers. Quartiles use linear interpolation; box whiskers show observed min/max. Equal university weight means the arithmetic mean of available university statistics. PhD percentages use documented qualifications; unknowns remain visible in composition charts.

Combined career publication/citation totals are **not** a university's historical output and may repeat coauthored work. h-index values are never summed. Five-year citations refer to citations received in 2021–2025; five-year Q1 refers to qualifying papers published in that period. Citation position does not measure overall academic or teaching quality. Full definitions and completeness tables are on **Data & Methodology**.

World boundaries: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas), bundled locally. Screenshots show the real collected dataset.

## Display names and verification

The app displays **Dr Name*** only for a documented completed PhD or higher research doctorate. The asterisk identifies that evidence. Medical qualifications alone, ongoing doctorates and a source’s Dr/Professor title do not qualify under this project’s display convention. Other profiles use **Mr Name**, preserving explicitly recorded Ms/Mrs/Miss. Mr is a requested display default, not an inferred gender. Names contain no position or qualification suffix; published source names and positions remain visible in the profile and unchanged in the editable CSVs.

Research links show their recorded verification status. Metric evidence lists the platform and retrieval date for each populated field. Old profile URLs and pinned identities resolve through documented aliases. The data review notes are in [docs/DATA_UPDATE_REVIEW.md](docs/DATA_UPDATE_REVIEW.md).

Comparison presets provide starting points; chart values use one decimal place while calculations retain full precision. Academic Explorer supports column text filters and numeric ranges, and CSV export respects those filters.

Portrait hairstyles follow explicitly recorded honorifics (Ms/Mrs/Miss or Mr); otherwise the default illustration is used. No hairstyle selector is shown.

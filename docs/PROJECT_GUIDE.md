# Lanka Academia

Explore Sri Lankan academic profiles, compare peer groups, and keep research data coverage visible.

**[Open the website](https://maninka123.github.io/academic-lens-lk/)** · [Editable dataset guide](../Data%20files/README.md) · [Collection prompt](DATA_COLLECTION_PROMPT.md)


## What you can do

- Compare institutions, faculties, departments, fields, ranks, qualifications, PhD origins and custom groups.
- Pin academics across chart changes and inspect their values, peer statistics and percentile positions.
- Switch between appropriate totals, means, medians and distributions; compare pooled academics with equal university weighting.
- Explore scatter/bubble plots, boxes, histograms, composition charts, heatmaps and treemaps.
- Search every person by name, open their full profile, and follow their university → faculty → department hierarchy. Profile charts compare the same position, qualification, both, or PhD holders at every level.
- Benchmark Sri Lanka internationally on **Global Benchmarks**: 1,740 sampled academics from 41 universities in seven countries (USA, Australia, China, India, Canada, France, Germany), grouped into QS 2027 elite, middle and lower tiers. Compare Sri Lanka against each tier, by country and university, and against QS position; the Comparison Studio can add the tiers or the benchmark universities as extra groups.
- Explore a locally bundled world map and PhD Sankey. Profile placeholders use initials, with no gender inference.
- Save custom groups in your browser, share configurations by URL, and export charts as PNG or records as CSV.
- Keep people without a documented department at faculty level, with no invented department groups.
- Use light/dark appearance, keyboard-accessible fullscreen charts, and readable desktop, tablet and mobile layouts.




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

Optional `Data files/metadata.json` can configure collection dates and the metric window.

The importer discovers new academic CSVs recursively and regenerates `public/data/{academics,universities,faculties,departments}.csv` and metadata. Duplicate IDs, malformed CSVs and invalid numeric values stop import. Update `Data files/field-mapping.json` for manual field classifications; ambiguous units stay Unmapped. See the [dataset guide](../Data%20files/README.md) for folder rules and the [collection prompt](DATA_COLLECTION_PROMPT.md) for independent research work.

<!-- dataset-summary:start -->
**Current snapshot:** the counts of profiles, institutions, faculties, departments and research coverage are regenerated at every import; see [reports/validation-report.md](../reports/validation-report.md) and the Overview page. Collected profiles are not the total academic population.
<!-- dataset-summary:end -->

The website always uses the collected dataset. Visitors cannot switch datasets, and shared links cannot change the data source. Synthetic records live only in `tests/fixtures/` for browser testing and are excluded from production.

## International baselines

`Data files/international/` holds the benchmark samples in the same 32-column layout, nested by country, with the QS 2027 rank and tier of each university, the source rosters and the OpenAlex match evidence. See its [README](../Data%20files/international/README.md) for selection, sampling and limitations. To rebuild them:

```sh
pip install requests beautifulsoup4 pypinyin
python scripts/baselines/build_international.py
python scripts/baselines/sri_lanka_openalex.py   # optional: like-for-like OpenAlex metrics for Sri Lanka
npm run data:import
```

OpenAlex responses are cached in `scripts/baselines/_cache/`. Set `OPENALEX_API_KEY` to go beyond the small anonymous daily budget.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` imports the current editable data, checks the public-asset allowlist, validates TypeScript, runs tests, builds, checks the built site for internal files or credentials, and uploads it as the `public-site` artifact on every push and pull request. **Successful pushes to `main` deploy automatically** after these checks pass. Pull requests never publish. Manual republishing is also available from the Actions tab ("Run workflow") on `main`. Set repository **Settings → Pages → Source → GitHub Actions**.

The site is public even though the repository is private. Only allowlisted files and columns are published; internal evidence and review files stay in `Data files/`. See [docs/DATA_POLICY.md](DATA_POLICY.md) for what is published, attribution, reuse conditions and the correction/removal process, and [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the data flow and how to add country datasets.

Vite uses `/academic-lens-lk/` as its base; HashRouter keeps deep links working on Pages. If you rename the repository, update `vite.config.ts`. Commit source/data changes and let the workflow rebuild; `dist/`, dependencies, local test traces and original collection backups are excluded from Git.

## Interpreting comparisons

Missing values are excluded from metric denominators and never treated as zero. Primary comparisons use a single bibliometric provider (Google Scholar, ResearchGate or OpenAlex); mixed providers are an explicitly labelled exploratory mode. Groups with fewer than 10 valid values are flagged and never ranked, and logarithmic charts leave zero values out (reported beside the chart) instead of shifting them. Every comparison shows eligible records, valid values, completeness, provider and measurement date, and statistics export as CSV with the selection, metric definition, provider, counts and dataset version. Percentiles use midrank ties and are suppressed below five valid peers. Quartiles use linear interpolation; box whiskers show observed min/max. Equal university weight means the arithmetic mean of available university statistics. PhD percentages use documented qualifications; unknowns remain visible in composition charts.

Combined career publication/citation totals are **not** a university's historical output and may repeat coauthored work. h-index values are never summed. Five-year citations refer to citations received in 2021–2025; five-year Q1 refers to qualifying papers published in that period. Citation position does not measure overall academic or teaching quality. Full definitions and completeness tables are on **Data & Methodology**.

World boundaries: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas), bundled locally. Figures describe the real collected dataset.

## Display names and verification

The app uses **Prof** when the source name or documented position states a professorial role (including senior, associate and assistant professors). Other documented completed research doctorate holders use **Dr**. The asterisk identifies completed research doctorate evidence; medical qualifications alone, ongoing doctorates and a source title do not establish that evidence. Other profiles retain an explicitly published Mr/Mrs/Ms/Miss or use the plain name. Published source names, qualifications and positions remain unchanged in the editable CSVs.

Research links show their recorded verification status. Metric evidence lists the platform and retrieval date for each populated field. Old profile URLs and pinned identities resolve through documented aliases. The collection evidence and review logs live in `Data files/` (see its README).

Comparison presets provide starting points; chart values use one decimal place while calculations retain full precision. Academic Explorer supports column text filters and numeric ranges, and CSV export respects those filters.

Profile placeholders show initials only; they never depict appearance or imply gender. Each profile shows compact evidence badges (verified, recorded but unverified, needs review, not documented) beside identity, employment, doctorate and metric values, with the last checked date.

### Individual peer comparisons

The selected cohort (position, qualification, both, PhD holders or all) applies to every context card. "All selected peers" spans collected Sri Lankan institutions within that cohort; "All collected profiles" appears only when all positions and qualifications are selected. Groups include the person when eligible. Only values from the same bibliometric provider enter the distribution; missing values are excluded and zero is retained. Median, mean, quartiles and midrank percentile require at least 10 valid values. The percentile is `100 × (below + 0.5 × tied) / valid`.

The distribution view plots each available profile value with a vertical spread used only to separate overlapping dots. The two-measurement scatter includes only profiles with both values from that provider. A green diamond highlights the person when their required values are available. Profile counts, contributing records and hover/focus definitions explain each result.

The 13 October 2026 peer review reproduced the example for Nalin De Silva from the saved Google Scholar values: university median 878, percentile `(9 + 0.5 × 1) / 11 × 100 = 86.4%`; faculty median 1,116.5 and percentile 85%. Identical 606.5 medians across several contexts result from the same 16 available values, despite different eligible profile counts. Missing exact Chemistry department mappings at Colombo and Jaffna were added to Natural Sciences; clinical biochemistry remains in its medical grouping. The resulting Natural Sciences / Senior Professor context has five profiles and three citation values, so summary statistics remain suppressed below the ten-value minimum.

## Position grouping

The site shows the Sri Lankan title **Senior Lecturer** everywhere. Internally, analyses treat *Senior Lecturer* and *Associate Professor* as the same seniority, because the two titles describe equivalent grades in different systems (international benchmark data uses Associate Professor). Position charts, standards by position, percentile peer groups and the international comparison therefore pool both titles into the single "Senior Lecturer" group. The original title for each person is kept unchanged in the data and shown on profiles and in tables.

## PhD-awarding universities and QS 2027 ranks

`Data files/qs_rankings_phd_institutions_2027.csv` holds, for each awarding institution (spelling variants merged through `Data files/phd_institution_aliases.csv`) and for every Sri Lankan university, its QS World University Rankings 2027 position as published ("=22", "1001-1200", "1401+"), a status (`ranked`, `not_ranked` or `not_located`), the source and how it was read. A `not_located` row means the rank was not found, never that the university is unranked. The importer adds `phdInstitution`, `phdQsRank` and `phdQsStatus` to each profile and publishes `qs_rankings_2027.csv`. When adding academics, check their awarding university here and add the institution, any alias, and its QS 2027 rank. topuniversities.com blocks automated page fetches; ranks were read from QS profile summaries returned by search, Wikipedia infoboxes showing the 2027 value, and university announcements. Never record another year's figure as 2027.

## Institution notices and comparison exclusions

`Data files/institution_notices.csv` lists institutions whose public staff data is too thin to trust. Columns: `university_id`, `severity` (`warning`), `exclude_from_comparison` (`yes` or blank), `title`, `message`, `source`, `status`.

- The importer copies them into `public/data/universities.csv` (`notice_*` and `exclude_from_comparison` columns), so adding a row and running `npm run data:import` is all that is needed.
- A notice is shown as a red warning on the institution page, on its card in Universities and in Methodology.
- With `exclude_from_comparison = yes` the institution keeps its page, directory entries and profiles, but its people are left out of every comparison, ranking, national statistic and filter list (`Dataset.academics`); `Dataset.allAcademics` still holds them for the directory.
- Current entry: ICBT Campus (no public academic staff directory could be located).

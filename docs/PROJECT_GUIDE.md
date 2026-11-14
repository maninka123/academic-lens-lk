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

Browser tests use installed Chrome. To use Playwright's bundled Chromium instead, remove `channel: 'chrome'` from `tests/playwright.config.ts` and run `npx playwright install chromium`.

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

- On every push and pull request, `.github/workflows/deploy.yml` imports the data, checks the public-asset allowlist, type-checks, tests, builds, scans the built site for internal files or credentials, and uploads it as an artifact.
- Pushes to `main` deploy automatically once those checks pass. Pull requests never publish. You can also republish from the Actions tab ("Run workflow").
- Set Settings → Pages → Source → GitHub Actions.
- The site and repository are public. Only allowlisted files and columns are published; see [DATA_POLICY.md](DATA_POLICY.md) for what is published, reuse and corrections, and [ARCHITECTURE.md](ARCHITECTURE.md) for the data flow and adding country datasets.
- Vite's base is `/academic-lens-lk/` (update `vite.config.ts` if you rename the repo); a hash router keeps deep links working. `dist/` and dependencies are not committed.

## Interpreting comparisons

- Missing values are excluded, never treated as zero. Log charts leave zeros out and report how many.
- Primary comparisons use one provider (Google Scholar, ResearchGate or OpenAlex); mixed providers are a labelled exploratory mode.
- Groups under 10 valid values are flagged and not ranked; percentiles need at least 5 valid peers. Percentiles use midrank ties; quartiles use linear interpolation; whiskers show observed min/max.
- Every comparison shows eligible records, valid values, completeness, provider and date, and exports to CSV with its settings and dataset version.
- Equal university weight = the mean of available university statistics. h-index values are never summed, and combined career totals are not a university's historical output.
- "Five-year" citations means received in 2021–2025; five-year Q1 means qualifying papers published then.
- Citation position does not measure academic or teaching quality. Definitions are on Data & Methodology.

## Display names and verification

- **Prof** for any documented professorial role; **Dr** for a documented completed research doctorate; otherwise a published Mr/Mrs/Ms/Miss or the plain name.
- An asterisk marks completed-doctorate evidence. Medical qualifications alone, ongoing doctorates and a source title do not count.
- Source names, qualifications and positions are never changed in the CSVs.
- Research links show their verification status, and metric evidence lists platform and retrieval date. Old URLs and pins resolve through documented aliases.
- Profile placeholders show initials only, never appearance or gender. Evidence badges (verified, recorded but unverified, needs review, not documented) carry a last-checked date.
- Chart values show one decimal; calculations keep full precision. Academic Explorer supports text and numeric filters, and CSV export respects them.

### Individual peer comparisons

- The chosen cohort (position, qualification, both, PhD holders, all) applies to every card. "All selected peers" spans Sri Lankan institutions in that cohort.
- Only same-provider values count; zero is kept. Median, mean, quartiles and percentile need at least 10 valid values, with percentile = 100 × (below + 0.5 × tied) / valid.
- Distribution plots jitter vertically only to separate dots. The scatter uses profiles with both values from that provider.
- Worked check (13 Oct 2026, saved Google Scholar values): university percentile (9 + 0.5 × 1) / 11 × 100 = 86.4%. Groups under 10 values show no statistics.

## Position grouping

The site shows "Senior Lecturer" everywhere. Internally, Senior Lecturer and Associate Professor are pooled as equivalent grades (international data uses Associate Professor). The original title is kept in the data and shown on profiles and tables.

## PhD-awarding universities and QS 2027 ranks

- `Data files/qs_rankings_phd_institutions_2027.csv` holds each awarding institution's QS 2027 rank as published ("=22", "1001-1200", "1401+"), a status (ranked, not_ranked, not_located), source and method. Spelling variants merge via `phd_institution_aliases.csv`.
- **not_located means not found, never unranked.** Never record another year's rank as 2027.
- The importer adds `phdInstitution`, `phdQsRank` and `phdQsStatus` to profiles and publishes `qs_rankings_2027.csv`.
- When adding academics, add their awarding university, any alias and its rank.
- topuniversities.com blocks automated fetches, so ranks come from QS summaries in search, Wikipedia infoboxes and university announcements.

## Institution notices and comparison exclusions

`Data files/institution_notices.csv` flags institutions with too little public staff data. Columns: `university_id`, `severity`, `exclude_from_comparison` (yes or blank), `title`, `message`, `source`, `status`. Add a row and run `npm run data:import`.

- A notice shows as a red warning on the institution page, its card and Methodology.
- With `exclude_from_comparison = yes` the institution keeps its page and profiles but is left out of comparisons, rankings, national statistics and filters (`Dataset.academics`); `Dataset.allAcademics` still holds them.
- Current entry: ICBT Campus (no public staff directory found).

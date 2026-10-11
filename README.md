# Sri Lanka Academic Atlas

Explore Sri Lankan academic profiles, compare peer groups, and keep research data coverage visible.

**[Open the website](https://maninka123.github.io/academic-lens-lk/)** · [Editable dataset guide](Data%20files/README.md) · [Collection prompt](DATA_COLLECTION_PROMPT.md)

![Academic Atlas overview](docs/screenshots/overview.png)

## What you can do

- Compare institutions, faculties, departments, fields, ranks, qualifications, PhD origins and custom groups.
- Pin academics across chart changes and inspect their values, peer statistics and percentile positions.
- Switch between appropriate totals, means, medians and distributions; compare pooled academics with equal university weighting.
- Explore scatter/bubble plots, boxes, histograms, composition charts, heatmaps and treemaps.
- Browse searchable profiles, drill into institutional hierarchies, and explore a locally bundled world map and PhD Sankey.
- Save custom groups in your browser, share configurations by URL, and export charts as PNG or records as CSV.
- Use light/dark appearance and responsive layouts with readable 16px body text.

![Comparison Studio with fictional demonstration data](docs/screenshots/comparison-studio.png)

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

The importer discovers new academic CSVs recursively and regenerates `public/data/{academics,universities,faculties,departments}.csv` and metadata. Duplicate IDs, malformed CSVs and invalid numeric values stop import. Update `Data files/field-mapping.json` for manual field classifications; ambiguous units stay Unmapped. See the [dataset guide](Data%20files/README.md) for folder rules and the [collection prompt](DATA_COLLECTION_PROMPT.md) for independent research work.

The initial real snapshot has **1,173 records from 12 institutions**, with **14 institutions in scope**. Saegis is excluded by the supplied collection notes; KIU and ICBT have no collected profiles yet. Coverage is partial, employment is not individually verified, and extracted facts require review. ResearchGate indexed snapshots are not Scholar totals. Missing h-index, five-year citation and Q1 values remain unavailable.

Select **Demo Data** in the sidebar to explore 720 fictional profiles across all 15 institutions in the original brief. Regenerate them with `npm run data:demo`. Demo profiles and metrics are explicitly labelled and never merged with the real collection.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` imports the current editable data, validates TypeScript, runs tests, builds and deploys whenever `main` changes. Set repository **Settings → Pages → Source → GitHub Actions**. Pull requests run checks without deploying.

Vite uses `/academic-lens-lk/` as its base; HashRouter keeps deep links working on Pages. If you rename the repository, update `vite.config.ts`. Commit source/data changes and let the workflow rebuild; `dist/`, dependencies, local test traces and original collection backups are excluded from Git.

## Interpreting comparisons

Missing values are excluded from metric denominators. Percentiles use midrank ties and are suppressed below five valid peers. Quartiles use linear interpolation; box whiskers show observed min/max. Equal university weight means the arithmetic mean of available university statistics. PhD percentages use documented qualifications; unknowns remain visible in composition charts.

Combined career publication/citation totals are **not** a university's historical output and may repeat coauthored work. h-index values are never summed. Five-year citations refer to citations received in 2021–2025; five-year Q1 refers to qualifying papers published in that period. Citation position does not measure overall academic or teaching quality. Full definitions and completeness tables are on **Data & Methodology**.

World boundaries: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas), bundled locally. Screenshots show the application; the Comparison Studio screenshot uses fictional demo data.

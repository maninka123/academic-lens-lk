# Architecture and future country datasets

The atlas stays a static React + TypeScript + Vite + ECharts site that reads CSV/JSON files. There is no backend and no database; the extension points below are deliberately lightweight.

## Data flow

```
Data files/universities/<inst>/faculties/…/academics.csv   (authoritative, editable, private)
Data files/*.csv                                           (evidence and reviews, private)
Data files/international/…                                  (benchmark samples)
        │  npm run data:import
        ▼
scripts/import-data.mjs + import-international.mjs
  · doctorate interpretation, rank normalisation (scripts/evidence.mjs, scripts/countries.mjs)
  · URL sanitising, public allowlist (scripts/public-assets.mjs)
  · coverage + snapshot summary, validation report, README snapshot block
        ▼
public/data/  (allowlisted, published)        reports/  (validation report, not published)
        ▼
src/data/loader.ts → DataContext → pages
src/analytics/engine.ts   grouping and statistics (missing ≠ zero, small-sample flags)
src/analytics/quality.ts  provider rules, coverage, log-scale exclusions
src/analytics/exports.ts  reproducible statistics exports
```

## Country profiles

`scripts/countries.mjs` holds one profile per dataset: code, role (`primary` or `benchmark-sample`), source folder and researcher identifier systems, plus the rules that map published position titles onto the shared position scale and an approximate career stage. The importer writes `public/data/datasets.json` from these profiles and adds a `country` column to every academic and institution record.

### Adding a country

1. Collect the hierarchy in the same 32-column layout under a new folder, e.g. `Data files/countries/<country>/universities/<inst>/faculties/…/academics.csv`, with an institution manifest (`universities.csv`: id, name, short, type).
2. Add a profile in `scripts/countries.mjs` (code, role, source, identifier systems) and, if needed, rank rules for that country's titles (original titles always stay in `position`).
3. Add an importer branch modelled on `import-international.mjs`: reuse `doctorateStatus`, `sanitizeUrl`, `rankFor`, `careerStage` and `checkPublicData`, write to `public/data/<code>/`, and add the new files to `PUBLIC_FILES`.
4. Register any new public columns in `PUBLIC_ACADEMIC_COLUMNS` (only fields the site needs).
5. In the app, load the dataset next to `loadBenchmarks()` in `src/data/international.ts`, and add it to the comparison views with its role clearly labelled (national collection vs sample).

Sri Lanka remains the primary dataset (`datasets.json → primary`). International benchmarks stay labelled as samples, never as national censuses.

## Comparability rules (enforced in code)

- One bibliometric provider per primary comparison (`withProvider`); mixed providers only in a labelled exploratory mode.
- OpenAlex values for Sri Lanka come only from successful matches, never from attempted lookups.
- Groups below `minimumSample` (default 10, `metadata.json`) are flagged and never ranked.
- Log axes exclude non-positive values and report the exclusions; values are never shifted.
- Missing values are null, never zero; collected profiles are never presented as a staff census.

# International baseline dataset

Benchmark samples from universities in seven countries. They let the app show where Sri Lankan academics sit relative to elite, middle and lower QS-ranked universities. The Sri Lankan dataset under `../universities/` is unchanged.

## Selection

QS World University Rankings 2027 (published 18 June 2026). For each country (United States, Australia, China, India, Canada, France, Germany):

| Tier | Rule |
|---|---|
| elite | Top 2 in the country with an accessible official staff directory |
| middle | Two universities ranked ~QS 420–560 |
| lower | Two universities in the QS ~800–1200 bands (the University of Colombo is 1001–1200) |

Australia has five universities. Its other lower-band universities (ACU, Charles Sturt, Southern Cross) block automated directory access. Substitutions, where the first-choice university's directory was unreachable, are listed in `universities.csv` (`substitution_note`). `qs_rankings_2027.csv` adds the Sri Lankan QS 2027 bands: Colombo 1001–1200, Peradeniya 1201–1400, Sri Jayewardenepura 1401+, Moratuwa 1401+.

## Departments and sampling

The sampled departments are Computer Science and Physics. Where a university has no Physics department, the nearest physical-science or engineering unit is used and marked in `departments.csv`. Rosters come only from official directories and are preserved verbatim in `_source_rosters/`. Visiting, adjunct, courtesy, emeritus, honorary and postdoctoral entries are excluded. Departments with more than 25 eligible staff are sampled systematically in directory order, so the sample is not chosen by fame. Some directories only list professors (Germany, French labs, Murdoch). Rank composition therefore differs from Sri Lankan lists, which include lecturers.

## Layout

Same as the Sri Lankan hierarchy, nested by country:

```
international/<country>/universities/<id>/faculties.csv
international/<country>/universities/<id>/faculties/<faculty>/departments/<department>/academics.csv
```

`academics.csv` uses the exact 32-column Sri Lankan header. `employment_status` is `listed_in_official_directory`; `record_status` is `baseline_sample_official_directory`.

## Fields

- **Research metrics:** `total_publications`, `total_citations`, `h_index` and `citations_2021_2025` come from OpenAlex. The author is matched by name within the university's OpenAlex institution IDs (`universities.csv`). Ambiguous names (a second plausible profile with ≥35% of the top profile's works) stay blank with `research_lookup_status = openalex_multiple_candidates_requires_review`. Every lookup is listed in `openalex_matches.csv`. OpenAlex counts are generally lower than Google Scholar's, so do not treat them as interchangeable with the Sri Lankan Scholar values.
- **PhD fields:** taken from the doctoral statement on the directory or the individual profile page, where published. Country comes from a conservative institution-keyword mapping; anything unknown stays blank.
- **Chinese names:** romanised with pypinyin; the original name is kept in `notes`.

Blanks mean unknown, never zero.

## Rebuilding

```sh
python scripts/baselines/build_international.py   # needs requests, beautifulsoup4, pypinyin
npm run data:import                                # also runs scripts/import-international.mjs
```

OpenAlex and profile responses are cached in `scripts/baselines/_cache/`, so a rerun only fetches what is missing. Without an API key OpenAlex allows a small daily budget; set `OPENALEX_API_KEY` to finish any `openalex_pending` records.

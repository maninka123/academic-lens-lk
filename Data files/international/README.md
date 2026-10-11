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

The dataset contains 1,740 academics across 41 universities. The original sampled departments are Computer Science and Physics. An expansion on 12 October 2026 added 110 academics in Medicine, Engineering, Law, Management and Business. Where a university has no Physics department, the nearest physical-science or engineering unit is used and marked in `departments.csv`. Rosters come only from official directories and are preserved verbatim in `_source_rosters/`. Visiting, adjunct, courtesy, emeritus, honorary and postdoctoral entries are excluded. Departments with more than 25 eligible staff are sampled systematically in directory order, so the sample is not chosen by fame. Some directories only list professors (Germany, French labs, Murdoch). Rank composition therefore differs from Sri Lankan lists, which include lecturers.

### New discipline coverage (12 October 2026)

| Discipline | University and unit | Added academics |
|---|---|---:|
| Medicine | Stanford, School of Medicine / Genetics | 25 |
| Engineering | Stanford, Civil and Environmental Engineering | 25 |
| Law | McGill, Faculty of Law | 25 |
| Management | Stanford GSB, Organizational Behavior | 15 |
| Business | Stanford GSB, Finance | 20 |

These are selected departmental samples, not coverage of all five disciplines at every university. Medicine includes basic medical research in Genetics. Business currently represents Finance; Management represents Organizational Behavior. New samples use alphabetical systematic selection, with Genetics sampled across alphabetical pages. Only eligible professor roles are included; duplicate names within each university are excluded. New citation metrics and doctorate details remain blank pending verification. These records support profile and discipline exploration but do not yet contribute measured citation values to benchmark charts.

`_field_expansion_2026-10-12.json` records the counts and official source URLs. `_source_rosters/` contains the extracted eligible names, titles and profile links (rather than verbatim HTML for this expansion).

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
# The original baseline builder covers CS/Physics only and overwrites manifests.
# Do not run it against the expanded dataset without preserving the new units.
# Publish the existing expanded hierarchy:
node scripts/import-international.mjs
npm run data:import                                # also runs scripts/import-international.mjs
```

OpenAlex and profile responses are cached in `scripts/baselines/_cache/`, so a rerun only fetches what is missing. Without an API key OpenAlex allows a small daily budget; set `OPENALEX_API_KEY` to finish any `openalex_pending` records.

## Individual profile enrichment (12 October 2026)

All 110 new official profiles were read, plus 24 directly linked full Stanford profiles and accessible researcher websites linked by official pages. Research descriptions are available for 108 people, education for 100, explicit doctorate evidence for 79, official-linked Scholar identities for 21 and ORCID links for 13. Unpublished or ambiguous details remain blank. No ResearchGate link was found on these checked pages.

`research_profiles.csv` records full research-profile URLs, ORCID and source-listed bibliography counts. `publications.csv` contains 8,181 researcher–publication attributions from official page lists across 89 profiles. The same coauthored work may appear under multiple researchers. These are not 8,181 globally unique works, or an exhaustive lifetime bibliography. McGill selected citations retain their full citation with unparsed title/author fields blank. Source and collection date accompany every entry.

The international app importer now publishes research interests, exact qualification statements, Scholar/ResearchGate links, ORCID, research-profile URLs and source-listed publication counts in `public/data/international/academics.csv`, plus a separate `publications.csv` bibliography. Citation metrics remain independently unverified for the new profiles; source-listed bibliography counts are not used as citation-provider publication totals.

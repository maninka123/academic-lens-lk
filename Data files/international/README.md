# International baseline dataset

Benchmark samples from universities in seven countries, so the app can show where Sri Lankan academics sit against elite, middle and lower QS-ranked universities. The Sri Lankan dataset under `../universities/` is unchanged.

## Selection

QS World University Rankings 2027 (published 18 June 2026). For each country (United States, Australia, China, India, Canada, France, Germany):

| Tier | Rule |
|---|---|
| elite | Top 2 in the country with an accessible official staff directory |
| middle | Two universities ranked ~QS 420–560 |
| lower | Two universities in the QS ~800–1200 bands (Colombo is 1001–1200) |

- Australia has five universities: its other lower-band universities (ACU, Charles Sturt, Southern Cross) block automated access.
- Substitutions, where the first choice's directory was unreachable, are in `universities.csv` (`substitution_note`).
- `qs_rankings_2027.csv` adds Sri Lankan QS 2027 bands: Colombo 1001–1200, Peradeniya 1201–1400, Sri Jayewardenepura 1401+, Moratuwa 1401+.

## Departments and sampling

- **1,740 academics across 41 universities.** Original departments: Computer Science and Physics. On 12 October 2026, 110 academics in Medicine, Engineering, Law, Management and Business were added (table below).
- Where a university has no Physics department, the nearest physical-science or engineering unit is used and marked in `departments.csv`.
- Rosters come only from official directories and are kept in `_source_rosters/`. Visiting, adjunct, courtesy, emeritus, honorary and postdoctoral entries are excluded.
- Departments with more than 25 eligible staff are sampled systematically in directory order, so the sample is not chosen by fame.
- Some directories list only professors (Germany, French labs, Murdoch), so rank mix differs from Sri Lankan lists, which include lecturers.

| Discipline | University and unit | Added |
|---|---|---:|
| Medicine | Stanford, School of Medicine / Genetics | 25 |
| Engineering | Stanford, Civil and Environmental Engineering | 25 |
| Law | McGill, Faculty of Law | 25 |
| Management | Stanford GSB, Organizational Behavior | 15 |
| Business | Stanford GSB, Finance | 20 |

These are selected departmental samples, not all five disciplines at every university. Only professor roles are included, with duplicate names removed. Adam Nayak (a summer 2027 Stanford appointment) is excluded from current-staff benchmarks, leaving 1,739 eligible records. `_field_expansion_2026-10-12.json` has the counts and source URLs.

## Layout

Same hierarchy as the Sri Lankan data, nested by country:

```
international/<country>/universities/<id>/faculties.csv
international/<country>/universities/<id>/faculties/<faculty>/departments/<department>/academics.csv
```

`academics.csv` uses the exact 32-column Sri Lankan header. Most records are `listed_in_official_directory` / `baseline_sample_official_directory`. Future appointments use `future_appointment` / `official_future_appointment` and are excluded from current benchmarks.

## Fields

- **Research metrics** (`total_publications`, `total_citations`, `h_index`, `citations_2021_2025`) come from OpenAlex, matched by name within the university's OpenAlex institution IDs. A second plausible profile with at least 35% of the top profile's works leaves the record blank (`openalex_multiple_candidates_requires_review`). Every lookup is in `openalex_matches.csv`. OpenAlex counts are generally lower than Google Scholar's, so do not treat them as interchangeable with the Sri Lankan Scholar values.
- **PhD fields** come from the doctoral statement on the directory or profile page, where published. Country uses a conservative institution-keyword mapping; unknown stays blank.
- **Chinese names** are romanised with pypinyin; the original is kept in `notes`.
- Blanks mean unknown, never zero.

## Rebuilding

```sh
node scripts/import-international.mjs   # publish the existing expanded hierarchy
npm run data:import                     # also runs the line above
```

Do not run the original baseline builder (`scripts/baselines/build_international.py`) on the expanded dataset: it covers CS/Physics only and overwrites manifests. OpenAlex and profile responses are cached in `scripts/baselines/_cache/`. Without an API key OpenAlex allows a small daily budget; set `OPENALEX_API_KEY` to finish any `openalex_pending` records.

## Profile enrichment (12 October 2026)

- All 110 new official profiles were read, plus 24 linked full Stanford profiles and researcher websites linked by official pages.
- Found: research descriptions for 108 people, education for 100, explicit doctorate evidence for 79, official-linked Scholar identities for 21, ORCID links for 13. No ResearchGate link appeared on the checked pages. Unpublished or ambiguous details stay blank.
- `research_profiles.csv` holds profile URLs, ORCID and source-listed bibliography counts. `publications.csv` holds 8,496 researcher–publication attributions across 95 profiles. A coauthored work can appear under several researchers, so these are not 8,496 unique works or a lifetime bibliography. Source and date accompany every entry.
- The importer publishes interests, qualification statements, Scholar/ResearchGate links, ORCID, profile URLs and listed publication counts in `public/data/international/academics.csv`, plus a separate `publications.csv`. Listed bibliography counts are not used as citation-provider publication totals.

## Metric verification (12 October 2026)

- 102 of 110 OpenAlex author identities were accepted, through official-linked ORCID or matching publications from official biographies, bibliographies, linked researcher sites or primary publishers. Subject clusters were reviewed to reject merged namesakes. This verifies identity and the provider snapshot, not an exhaustive lifetime record.
- Imported values (OpenAlex snapshots of 12 October 2026): indexed works, total citations, h-index, and citations received in 2021–2025. A measured zero is kept; unresolved values stay blank. Q1 metrics remain unknown. Use the app's OpenAlex view for these.
- Where a corroborated profile has small split fragments, only the main profile's totals are used. Large unresolved splits are not summed. Jesse Engreitz's profile has only eight indexed works, so coverage is likely incomplete.

| Unresolved profile | Why metrics stay blank |
|---|---|
| Adam Nayak | Future appointment; not corroborated by publication or official ORCID |
| Barbara G Simpson | Candidate mixes structural engineering and unrelated archaeology |
| Haoqi (Nina) Zhao | ORCID-linked record also has unrelated photonics papers |
| Hanno Lustig | Several substantial corroborated profiles; no safe aggregation |
| Michael Blank | Finance paper mixed into unrelated subject clusters |
| Aaron Mills | Law publication found, but OpenAlex authorship has no author ID |
| Catherine Walsh | Law publications merged with a mostly astrophysics profile |
| Jonathan Chan | Several corroborated profiles; no safe aggregation |

Evidence is in `_metric_verification_2026-10-12.json` (summary: `_metric_verification_summary_2026-10-12.json`); the quality-check notebook is `../../scripts/baselines/international_verification_audit.ipynb`. The importer regenerates the app CSVs at their existing paths.

On 13 October 2026, a wider missing-link review added 92 source-backed Google Scholar links from university pages, official-linked researcher sites and an official CV. Direct Scholar requests were rate-limited, so no live Scholar metrics were added. Association checks and searches are in `research_identity_evidence.csv` and `research_search_attempts.csv`.

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

These are selected departmental samples, not coverage of all five disciplines at every university. Medicine includes basic medical research in Genetics. Business currently represents Finance; Management represents Organizational Behavior. New samples use alphabetical systematic selection, with Genetics sampled across alphabetical pages. Only eligible professor roles are included; duplicate names within each university are excluded. The 12 October verification pass corroborated OpenAlex identities and imported metrics for 102 of the 110 profiles. Eight unresolved profiles retain blank metrics. Explicit doctorate details are available for 79 people. Adam Nayak is listed for a summer 2027 Stanford appointment and is excluded from current-staff benchmarks, leaving 1,739 eligible international records.

`_field_expansion_2026-10-12.json` records the counts and official source URLs. `_source_rosters/` contains the extracted eligible names, titles and profile links (rather than verbatim HTML for this expansion).

## Layout

Same as the Sri Lankan hierarchy, nested by country:

```
international/<country>/universities/<id>/faculties.csv
international/<country>/universities/<id>/faculties/<faculty>/departments/<department>/academics.csv
```

`academics.csv` uses the exact 32-column Sri Lankan header. Most records use `employment_status = listed_in_official_directory` and `record_status = baseline_sample_official_directory`. Future appointments use `future_appointment` / `official_future_appointment` and are excluded from current benchmarks.

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

`research_profiles.csv` records full research-profile URLs, ORCID and source-listed bibliography counts. `publications.csv` contains 8,496 researcher–publication attributions from official page lists across 95 profiles. The same coauthored work may appear under multiple researchers. These are not 8,496 globally unique works, or an exhaustive lifetime bibliography. McGill selected citations retain their full citation with unparsed title/author fields blank. Source and collection date accompany every entry.

The international app importer now publishes research interests, exact qualification statements, Scholar/ResearchGate links, ORCID, research-profile URLs and source-listed publication counts in `public/data/international/academics.csv`, plus a separate `publications.csv` bibliography. Citation metrics are verified separately from source-listed bibliography counts, which are not used as citation-provider publication totals.

## Research metric verification (12 October 2026)

All 110 new profiles were checked. The pass accepted 102 OpenAlex author identities through official-linked ORCID or matching publications from official staff biographies, bibliographies, researcher websites linked by those pages, or primary publishers. Author subject clusters were reviewed to reject merged namesakes. This verifies identity and the provider snapshot; it does not establish an exhaustive lifetime research record or certify every indexed work.

The imported values are indexed works, total citations, author h-index and citations received during calendar years 2021–2025, as reported in OpenAlex author snapshots retrieved on 12 October 2026. A measured zero is retained; unresolved values stay blank. Q1 publication metrics remain unknown. Metrics are OpenAlex, not Google Scholar, and should be compared using the app's OpenAlex view.

Where a main corroborated profile has small split fragments, only the main profile's totals are used and the limitation is documented. Large unresolved splits are not summed. Jesse Engreitz's corroborated profile contains only eight indexed works, so coverage is likely incomplete. This limitation applies to interpreting the provider totals as lifetime output.

| Unresolved profile | Reason metrics remain blank |
|---|---|
| Adam Nayak | Future appointment; candidate not corroborated by publication or official ORCID |
| Barbara G Simpson | Candidate includes structural engineering and unrelated archaeology |
| Haoqi (Nina) Zhao | ORCID-linked record also contains unrelated photonics papers |
| Hanno Lustig | Multiple substantial corroborated profiles; no safe author-total aggregation |
| Michael Blank | Matching finance paper mixed into unrelated subject clusters |
| Aaron Mills | Primary law publication found, but its OpenAlex authorship has no author ID |
| Catherine Walsh | Law publications merged with a predominantly astrophysics profile |
| Jonathan Chan | Multiple corroborated profiles; no safe author-total aggregation |

`_metric_verification_2026-10-12.json` preserves identity evidence, candidate results, provider snapshots, retrieval dates and the imported values. `_metric_verification_summary_2026-10-12.json` summarizes coverage. The quality-check notebook is `../../scripts/baselines/international_verification_audit.ipynb`. The existing importer regenerates the app CSVs at their existing paths; no data-path migration is needed.


On 13 October 2026, the wider missing-link review added 92 source-backed international Google Scholar links using university pages, official-linked researcher websites and an official CV. Profile links and check dates are retained separately from the OpenAlex metric snapshot. Direct Scholar requests were rate-limited; no live Scholar metrics were added. `research_identity_evidence.csv` and `research_search_attempts.csv` preserve the association checks and individual searches.

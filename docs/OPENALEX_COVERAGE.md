# OpenAlex lookup coverage

Imported 12 October 2026. The latest submitted lookup results are integrated into the app.

- **1,346 lookups · 416 matched researchers.**
- 547 no-name-match results and 383 ambiguous results remain blank.
- 51 profiles have no lookup row: Horizon Campus (46), ICBT Campus (4), and University of Kelaniya (1).
- Research comparisons require at least 10 valid values after discipline and career-stage filters. An attempted lookup is not a match; missing metrics are never zero.

| Institution | Profiles | Lookups | Matched |
| --- | ---: | ---: | ---: |
| CINEC Campus | 71 | 71 | 13 |
| General Sir John Kotelawala Defence University | 65 | 65 | 40 |
| Horizon Campus | 46 | 0 | 0 |
| ICBT Campus | 4 | 0 | 0 |
| KIU | 1 | 1 | 0 |
| NSBM Green University | 111 | 111 | 42 |
| Sri Lanka Institute of Information Technology | 48 | 48 | 22 |
| University of Colombo | 341 | 341 | 93 |
| University of Jaffna | 133 | 133 | 51 |
| University of Kelaniya | 89 | 88 | 47 |
| University of Moratuwa | 245 | 245 | 57 |
| University of Peradeniya | 170 | 170 | 19 |
| University of Ruhuna | 59 | 59 | 32 |
| University of Sri Jayewardenepura | 14 | 14 | 0 |

International dataset: **1,740 profiles across 41 universities**; 1,133 have matched OpenAlex metrics. The 110 newer profiles in Medicine, Engineering, Law, Management and Business have source evidence and bibliography data, but their research metrics remain unverified. The default comparison retains Computer Science and Physics.

Source: `Data files/international/sri_lanka_openalex_metrics.csv`. API credentials and cached responses are excluded from Git and published assets.


Update, 13 October 2026: the existing 1,346 Sri Lankan lookups were already published; Horizon and ICBT had not been queued by the original institution-only configuration. Fifty additional checks now bring the file to 1,396 lookups, with 420 successfully matched author records. Four new matches were corroborated using person-specific publication affiliation evidence. ICBT has an OpenAlex institution record; no corresponding Horizon Campus institution was established, so its checks use global candidates with publication/affiliation corroboration. Unresolved candidates retain blank metrics. The source audit is `Data files/international/_missing_sl_openalex_2026-10-13.json`.

The app importer now fills missing metric fields from successful OpenAlex lookups without replacing recorded provider values. Each filled field is labelled OpenAlex and retains its author URL; legacy snapshots without a retrieval date stay undated. The institution explorer displays its collected scope independently of saved comparison filters, fixing the false zero-record CINEC view. OpenAlex links and match statuses are now available on profile pages and coverage panels. Minimum-sample rules still apply to charts.

Browser verification, 13 October 2026: the local app renders CINEC with 71 collected profiles, 13 matched research identities and 15 profiles with any metric. In the Computer Science / OpenAlex / h-index benchmark selection, Horizon renders 1 usable value / 12 matching profiles and ICBT 1 / 1; neither says lookup pending. These groups remain below the minimum sample of 10, so their medians are suppressed. The header collection date remains 12 October: it describes the original profile collection date, not a fresh date for every bibliometric value.

UWU update, 13 October 2026: 204 new university lookups and a corroborated retry for Y.W.R. Amarasinghe bring the Sri Lankan lookup table to 1,600 attempted profiles, with 477 approved author identities exposed in the app. The current source table also contains nine additional matched snapshots pending publication review (486 populated author IDs total); these remain withheld by the importer. UWU contributes 56; the Amarasinghe retry contributes one. 148 UWU candidates remain unresolved/possible, with blank metrics. Accepted observations are provider-labelled and carry the retrieval date.

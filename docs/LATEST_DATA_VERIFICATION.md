# Latest dataset verification — 12 October 2026

Checked the current local revision `bdd499b647`, regenerated the app data, and independently checked IDs, hierarchy, profile-link collisions, metric evidence, qualification classifications and benchmark coverage. Targeted official-page checks are listed below; this was not a fresh web verification of every person.

## Passed

- 1,397 Sri Lankan records across all 14 institutions; unique IDs and valid hierarchy joins.
- 1,740 international source records across 41 universities; one future appointment is excluded from the active benchmark.
- 1,235 matched international researchers, including 102 of the 110 newly added records. Eight remain unresolved.
- Every populated local citation, h-index and 2021–2025 citation field has dated, linked evidence. No 2021–2025 citation count exceeds its recorded all-time citation count.
- All 64 automated tests, type checking, production build and public-file checks passed.

## Findings that remain

1. **Two duplicate identity pairs at University of Moratuwa.** J.M.A. Manatunge (`SL-58905f642d83`) and J. Manatunge (`SL-40c7bc9e6d53`) share the same Scholar account and identical degrees. R. Munasinghe (`SL-0794ff4eb488`) and Rohan Munasinghe (`SL-82f188e307a7`) share another Scholar account and the same doctoral background. The latter also occupies two differently named versions of the same faculty/department. Resolve these pairs with canonical records and aliases before treating 1,397 as a deduplicated headcount. Sources: [Moratuwa council](https://www.uom.lk/council), [official Rohan Munasinghe profile](https://ent.uom.lk/team/prof-rohan-munasinghe/).
2. **One false contradictory-doctorate flag.** V. G. Krishanthi Dilrukshi Wimalasiri, University of Colombo (`SL-1d86ba1e2dc4`), already has source status `in_progress`. The text `(On Ph.D. study leave)` is not recognised by the importer’s ongoing-degree rule, causing a contradictory label. No completed PhD should be inferred. Her [official profile](https://www.res.cmb.ac.lk/ir/vgk.dilrukshi.wimalasiri/) lists BA and two MAs.
3. **Outdated qualification follow-up queue.** Nine entries in the 543-row queue are now classified, while seven currently unknown records are absent. The app itself has **541 unknown qualifications**. Refresh the follow-up queue from the current app classification while retaining prior review notes.
4. **Stale benchmark documentation.** `docs/OPENALEX_COVERAGE.md` still states 1,133 matches and says all 110 new profiles are unverified. The current total is 1,235, with 102 new matches. README wording should make clear that only the remaining unresolved metrics stay blank. `docs/DATA_UPDATE_REVIEW.md` is an older, dated snapshot and should not be read as current totals.
5. **Remaining coverage gaps.** 323 positions are Unknown. Local OpenAlex has 416 matches out of 1,346 attempts, with 547 no-name-match and 383 ambiguous results; 51 local records have no lookup row. These are missing verification, not evidence of absent research. Q1 publication counts remain blank throughout.
6. **Historical review rows.** `research_unresolved.csv` has 1,606 IDs but only 1,397 are current records; `identity_review.csv` also contains repeated or non-current IDs. Review-file row counts should not be presented as current-person counts without filtering IDs and aliases.

## Already-classified entries still in qualification follow-up

| Name | University | Current classification |
| --- | --- | --- |
| Dr. Harsha Wijesekera | Sri Lanka Institute of Information Technology | PhD |
| Dr. Iresha Ratnayake | Sri Lanka Institute of Information Technology | PhD |
| Dr. Lakmini Abeywardhana | Sri Lanka Institute of Information Technology | PhD |
| Dr. Nimal Ratnayake | Sri Lanka Institute of Information Technology | PhD |
| Dr. Praneeth Ratnayake | Sri Lanka Institute of Information Technology | PhD |
| Dr. Virajith Gamage | Sri Lanka Institute of Information Technology | PhD |
| Prof. Ayantha Gomes | Sri Lanka Institute of Information Technology | PhD |
| Prof. Jagath Kasturiarachchi | Sri Lanka Institute of Information Technology | PhD |
| Prof. Renuka Herath | Sri Lanka Institute of Information Technology | PhD |

## Unknown qualifications missing from the follow-up queue

| Name | University | ID |
| --- | --- | --- |
| Dr. Chandru Sandrasekaran | ICBT Campus | SL-4c6f4e5253bc |
| Mrs. Nadeeka Ranadeva | KIU | SL-c2cff03674d5 |
| Ms. Aushadharie Kaushalya | NSBM Green University | SL-a5f42ba576d4 |
| Ms. Kavishka Rajapaksha | NSBM Green University | SL-34ca3896e60a |
| Mr. Isuru Sri Bandara | NSBM Green University | SL-f3b070e4456f |
| Ms. Nipuni Fernando | NSBM Green University | SL-3cc2d0137b61 |
| Ms. Imesha Wijedasa | NSBM Green University | SL-bfac954abcfc |

# How the record counts relate

Aggregate counts only. Reproduced on 2026-11-19 (after the first verified PhD-year corrections: two records moved from completed to in progress, so 1,829 became 1,827).

| Figure | Count | What it is |
|---|---|---|
| Source rows | 5,693 | One row per academic ID across all department CSVs in `Data/Lanka-Academia/universities/` |
| Excluded non-academic posts | 69 | Instructors, research assistants and similar posts, kept privately in `Data/Lanka-Academia/excluded_non_academic.csv` |
| Public academic records | 5,624 | Source rows minus exclusions; the generated `App/public/data/academics.csv`. The ID sets match exactly |

## Completed doctorates: 1,767 vs 1,827
The website's "documented doctorates" (1,827) uses `doctorateStatus` in `App/scripts/evidence.mjs`: a doctorate is counted when the recorded status is completed, **or** when the qualification text names a doctorate that is not described as ongoing.

| Source | Count |
|---|---|
| Recorded status is completed | 1,767 |
| Status not set, but qualification text names a completed doctorate | 60 |
| **Website documented doctorates** | **1,827** |

All 69 excluded posts have no completed doctorate, so the figures are the same with or without the exclusion. Records that contradict (status says completed but the text says ongoing) are not counted as completed; there are none at present.

## Other counts you may see
- Doctorates with a known country (1,539) and a known completion year (398) are subsets of the 1,827.
- A research-only analysis may apply further filters (current post, completion year); those are documented with that analysis, not here.

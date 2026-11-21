# How the record counts relate

Aggregate counts only. Updated 2026-11-21 after eight universities were added (Sabaragamuwa, Wayamba, Rajarata, Eastern, South Eastern, Open University, Visual and Performing Arts and APIIT) and further profile-based qualification updates. Two duplicate listings were merged (aliases kept).

| Figure | Count | What it is |
|---|---|---|
| Source rows | 7,375 | One row per academic ID across all department CSVs in `Data/Lanka-Academia/universities/` |
| Excluded non-academic posts | 69 | Instructors, research assistants and similar posts, kept privately in `Data/Lanka-Academia/excluded_non_academic.csv` |
| Public academic records | 7,306 | Source rows minus exclusions; the generated `App/public/data/academics.csv`. The ID sets match exactly |

## Completed doctorates
The website's "documented doctorates" (2,204) uses `doctorateStatus` in `App/scripts/evidence.mjs`: a doctorate is counted when the recorded status is completed, **or** when the qualification text names a doctorate that is not described as ongoing.

| Source | Count |
|---|---|
| Recorded status is completed | 2,135 |
| Status not set, but qualification text names a completed doctorate | 69 |
| **Website documented doctorates** | **2,204** |

All 69 excluded posts have no completed doctorate. Records whose text contradicts the status (for example both a completed and an ongoing doctorate) are not counted as completed and are listed for review: 2 at present.

## Other counts you may see
- Doctorates with a known country (1,859) and a known completion year (639) are subsets of the 2,204.
- A research-only analysis may apply further filters (current post, completion year); those are documented with that analysis, not here.

## PhD institution and country on the website
The published institution and country are shown only when the doctoral entry in the qualification text supports them. Where the entry is bare, joint or split, or the institution comes from another degree, the value is withheld on the website. The source files keep the recorded value for review.

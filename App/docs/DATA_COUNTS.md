# How the record counts relate

Aggregate counts only. Updated 2026-11-20 after seven universities were added (Sabaragamuwa, Wayamba, Rajarata, Eastern, South Eastern, Open University, Visual and Performing Arts: 1,528 source rows) and further profile-based qualification updates.

| Figure | Count | What it is |
|---|---|---|
| Source rows | 7,221 | One row per academic ID across all department CSVs in `Data/Lanka-Academia/universities/` |
| Excluded non-academic posts | 69 | Instructors, research assistants and similar posts, kept privately in `Data/Lanka-Academia/excluded_non_academic.csv` |
| Public academic records | 7,152 | Source rows minus exclusions; the generated `App/public/data/academics.csv`. The ID sets match exactly |

## Completed doctorates
The website's "documented doctorates" (2,106) uses `doctorateStatus` in `App/scripts/evidence.mjs`: a doctorate is counted when the recorded status is completed, **or** when the qualification text names a doctorate that is not described as ongoing.

| Source | Count |
|---|---|
| Recorded status is completed | 2,044 |
| Status not set, but qualification text names a completed doctorate | 62 |
| **Website documented doctorates** | **2,106** |

All 69 excluded posts have no completed doctorate. Records whose text contradicts the status (for example both a completed and an ongoing doctorate) are not counted as completed and are listed for review: 4 at present, all from the ambiguous entry "(Reading, UK)", which can mean the University of Reading.

## Other counts you may see
- Doctorates with a known country (1,719) and a known completion year (558) are subsets of the 2,106.
- A research-only analysis may apply further filters (current post, completion year); those are documented with that analysis, not here.

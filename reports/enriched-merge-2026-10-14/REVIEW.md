# Enriched dataset merge — 14 October 2026

Reviewed **1,397 supplied records** by stable ID. Retained **1,601 Sri Lankan records**, including 204 UWU profiles, and 1,740 international records.

Updated **659 profiles** with **3,136 field changes**: **2,807** missing source cells filled and **329** existing values or metadata updated. These counts include evidence and status metadata; they are not new people.

| Source coverage | Before | After | Added |
|---|---:|---:|---:|
| Qualifications | 1,055 | 1,210 | +155 |
| Doctoral institutions | 403 | 548 | +145 |
| Doctoral countries | 430 | 567 | +137 |
| Doctoral completion years | 268 | 337 | +69 |
| Scholar links | 562 | 767 | +205 |
| ResearchGate links | 274 | 394 | +120 |
| Academic positions | 1,288 | 1,391 | +103 |
| Research interests | 502 | 566 | +64 |
| Recorded departments | 1,069 | 1,302 | +233 |

App coverage already includes approved OpenAlex fallbacks. Source-cell gains therefore differ from app gains.

| App coverage | Before | After | Added |
|---|---:|---:|---:|
| Any research metric | 663 | 826 | +163 |
| Documented completed doctorate | 564 | 630 | +66 |
| Citations | 660 | 824 | +164 |
| h-index | 627 | 809 | +182 |
| Citations received 2021–2025 | 568 | 747 | +179 |

Checked 663 cited official university pages; 613 returned HTTP 200. Availability alone is not field verification. Metric receipts are reviewed user-supplied snapshots with their original dates (mostly 13 October); this merge does not claim independent live Scholar metric retrieval. Providers remain separate.

986 proposed metric cells were already available through approved OpenAlex and were not relabelled as Scholar or counted as new coverage. 2,812 proposed changes were held. See [every field decision](field-decisions.csv) and [machine-readable summary](summary.json).

Held changes include missing field evidence, inferred interests, page headings, uncertain identities, incomplete five-year citation windows, blank deletions and conflicts with newer source values. Four Reading doctoral entries remain ongoing, not completed. Two unsupported doctoral-country assignments were withheld; an MSc institution and an ambiguous joint PhD entry cannot establish one doctoral awarding country.

Clinical MDs remain separate from research PhDs. Titles alone do not prove a doctorate. Shared Scholar profiles are recorded for review without automatically merging distinct employment records. Country values inferred from a documented institution are labelled as inferred.

The original input and 1,397-row baseline are preserved. [sri_lankan_academics_merged.csv](../../Data%20files/to_user/sri_lankan_academics_merged.csv) is the refreshed 1,601-row editable snapshot, with current source paths and app reference columns. Accepted affiliations were placed into the corresponding source hierarchy: 246 placements reconciled. Twenty-two newly resolved unit IDs retain unambiguous existing broad-field mappings by exact published title; [mapping receipts](field-mapping-additions.json) are saved.

App paths remain public/data/academics.csv and the existing metadata/hierarchy files. The header uses the last logged dataset update date, while individual collection/observation dates remain unchanged.

The audit notebook validates the reported counts. The merge script is guarded against repeated ingestion of this exact input; rerunning its review prints the saved result. Primary-page caches stay outside the repository. Durable field evidence and change logs retain the accepted result.

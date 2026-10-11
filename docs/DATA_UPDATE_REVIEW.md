# Data compatibility review — 11 October 2026

Reviewed the active hierarchy and the latest loose-file updates after the delivery ZIP. The handoff reports 1,388 records; five subsequent additions bring the imported snapshot to **1,393 unique records** across 12 populated institutions (14 in scope). The generated app count is authoritative for this snapshot.

- All academic leaves parse with the existing 32-column schema. The 1,173 baseline IDs remain active or resolve through 13 documented aliases. This represents 233 additions and 13 merged duplicates, a net increase of 220.
- Available metrics: 90 publication counts, 294 citation counts, 131 exact 2021–2025 citation counts and 241 h-index values. Both Q1 count fields remain unknown.
- Recorded researcher links: 315 Scholar and 236 ResearchGate URLs. These are populated-link counts, not verified-identity counts. Eight profiles retain link-review flags in the reviewed snapshot.
- Faculty and department corrections are imported from the authoritative rows. Unassigned people stay at the documented hierarchy level. No broad-field mapping is inferred.

## Application changes

Import preserves researcher-link statuses and per-metric platforms, dates and evidence. Mixed Scholar/ResearchGate fields are displayed separately. Confirmed aliases redirect old profile links and remap saved pins/custom groups. Assistant Professors and Assistant Lecturers no longer collapse into the higher rank, and missing positions are explicitly Unknown.

Names follow the requested project convention: Dr Name* for documented completed PhDs or higher research doctorates; otherwise Mr, retaining an explicit Ms/Mrs/Miss. Source names and positions remain available. Medical qualifications alone and ongoing doctorates do not receive the asterisk. Automatic portrait styling uses recorded honorifics; there is no style selector.

Comparison presets, horizontal bars, bounded legends, local scrolling and one-decimal plot formatting improve readability without rounding underlying statistics. Academic Explorer column filters combine text and numeric ranges; export respects them. PhD Origins uses its available space and expandable detail lists. Body text remains 16px and controls retain 44px touch targets.

## Data items still requiring review

Three source rows combine `in_progress` with qualifications naming the **University of Reading**, including a past PhD year. The application flags these contradictions and retains the source status pending correction:

- SL-0ece31a7c31f — Prof Dharshani Bandupriya
- SL-3dc55f974674 — Prof Tara D Silva
- SL-122d7cca3b9c — Dr Anushka Wickramasuriya

The collection's handoff/coverage reports predate the five latest additions. Their stated 1,388 total is historical; the app calculates totals from active leaf records. This remains a partial collection with variable employment, identity and field verification.

## Validation

Independent CSV/ID/schema checks, three importer evidence tests, 28 unit/component tests, production build and 12 browser checks. Browser checks cover all five routes from 320px to 1440px, profile aliases, column filters, exports, comparison modes, keyboard navigation and desktop/mobile layouts.

## Publication copy

Four meeting-access URL occurrences were removed from the published research search log after automatic approval review detected an embedded access token. The publication retains every log row. Original local data files were not edited.

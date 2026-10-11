# Interface and logic audit

Checked the five main routes at 320, 390, 768, 1024, and 1440px, plus individual profiles, faculty routes, light/dark appearance, numeric chart types, empty filters, fullscreen dialogs, exports and shared configurations.

Corrections:

- Department grouping includes only documented departments. Unassigned people remain at faculty level; unknown faculties remain at institution level. No synthetic unknown-unit links are created.
- Faculty pages list directly assigned people separately, retain all faculty members in totals, and reject invalid or mismatched unit routes.
- Individual profiles omit absent department breadcrumbs, comparison options, charts and buttons. The default Studio peer falls back to faculty, then university.
- Profile actions clear stale selections and incompatible chart settings. Equivalent-field comparisons use all documented fields in the unit and compare institutions.
- Equal university weighting is consistent between heatmap cells and supporting statistics. h-index never uses totals or per-10 aggregation.
- Hidden log settings reset on unsupported charts. Zero log coordinates are excluded from ordinary and pinned points; zeros remain in summaries. Bubble plots require documented h-index sizes.
- Empty histograms are unavailable rather than fabricated zero-frequency distributions; the final bin includes the observed maximum.
- Chart controls no longer clip at negative offsets. Fullscreen charts mount correctly in accessible dialogs, close with Escape and restore focus.
- Tablet comparison panels use dialogs; long names, source URLs, headings and small-screen toolbars wrap. Dense heatmaps and Sankeys scroll locally without widening the page.
- Missing metrics display a consistent unavailable label; screen-reader chart descriptions avoid NaN. Peer quartiles no longer repeat long unavailable labels.
- PhD flow diagrams respect the selected country, and country counts correctly describe people rather than numbers of institutions.
- Duplicate faculty/department names are disambiguated with institution labels. Inverted ranges explain why no records match.
- Shared and persisted configuration are validated; invalid shared links show a visible message. Deleted custom groups cannot remain selected. Oversized URL shares are rejected with a clear recovery action.
- The production dataset is fixed. There is no selector, demo loader or deployed demo dataset; saved demo preferences and old demo links cannot switch it. Fictional records are confined to browser-test fixtures.
- Source downloads match the available files; demonstration-only mapping links were removed.
- Skip links move focus without changing the app route. Closed mobile navigation is hidden from keyboard access; its open menu traps Tab, closes with Escape and restores focus to the menu button.

Regression coverage is in `src/analytics/charts.test.ts`, `src/components/ProfileStanding.test.tsx`, and `tests/audit.spec.ts`. Browser audit images are local artifacts under `output/playwright/`. README images show the real collected dataset.

This audit records the cases checked and corrected; it does not establish that every possible future data change or browser behavior is defect-free. Editable source records were not changed by this interface audit.

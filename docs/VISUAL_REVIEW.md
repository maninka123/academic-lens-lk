# Visual consistency review — 14 October 2026

The source dataset and application snapshot remain separate, joined by stable academic IDs. Missing metrics are still unavailable rather than zero. The visual changes retain provider, sample-size and qualification distinctions.

| Before | After | Why |
|---|---|---|
| Comparison controls occupy a long left column | Six primary controls above the plot; secondary options and filters expand below | More space for the chart and less scrolling between controls |
| A bar click changes the comparison immediately | A group-details popup shows the statistic, coverage and profiles; exploration is an explicit action | Inspect data without losing the current view |
| Pinned values use the raw record regardless of selected provider | Pins and plot references use the same selected-provider projection as the groups | Avoid comparing unlike bibliometric sources |
| Group bar charts have no individual reference markers | Dashed, numbered reference lines with names and values in a nearby key; equal values share a line | Show individual h-index values in relation to group medians |
| Adding one person clears the search | Search stays active, offers 12 results and supports adding all shown | Add several people without repeated searching |
| Plot colours and labels differ across pages | Shared chart palette, axis/tooltip styling, readable light/dark labels and number formatting | Consistent reading across comparison, benchmarks, profile and origin charts |
| Table surfaces and control placement vary | Shared borders, backgrounds, focus treatment and number alignment | Consistent data surfaces across directory, group popup and statistics tables |
| Update badge shows the profile collection date | Latest logged data update date; individual observations retain their own dates | Make a merged dataset visibly current without claiming fresh platform measurements |
| Coverage can count staged OpenAlex matches differently across pages | Approved public identities counted consistently by the importer and UI | Prevent pending matches from appearing verified |

Bar reference lines are drawn for per-person statistics (median/mean/distribution), not combined totals. Missing selected-provider values have no marker; measured zeros remain zero and are omitted only on logarithmic axes. A larger pinned value expands the axis rather than being clipped. Composition bars also expose group details.

Validation includes unit/component tests for bar popups, provider agreement, out-of-range and equal-value reference lines, zero/missing values and batch selection. Browser review covers the main navigation pages, both themes, and the comparison layout at desktop and mobile widths. Production build and public-asset checks are required before GitHub publication.

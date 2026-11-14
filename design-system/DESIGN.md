---
version: alpha
name: "Lanka Academia"
description: "Design system for Lanka Academia, a research atlas of Sri Lankan academics. Started from measurements of linear.app (calm, dense, hairline-bordered product UI); the identity, palette, type pairing and every component are original."
colors:
  background: "#f6f7f9"
  text: "#3a4357"
  heading: "#0b1020"
  text-muted: "#5f697d"
  border: "#e2e5ec"
  border-strong: "#c9cfda"
  surface: "#ffffff"
  surface-raised: "#fbfbfd"
  surface-inverse: "#0b1020"
  primary: "#4658d8"
  primary-foreground: "#ffffff"
  primary-hover: "#3647c4"
  primary-soft: "#e9ecfd"
  link: "#3647c4"
  focus: "#4658d8"
  teal: "#14937f"
  violet: "#7a5ad9"
  amber: "#b9770e"
  rose: "#c4344d"
  success: "#23844d"
  warning: "#b9770e"
  danger: "#c4344d"
  sidebar: "#0b1020"
  sidebar-border: "#1b2136"
  sidebar-text: "#98a1b8"
  sidebar-heading: "#f3f5fa"
  sidebar-active: "#1a2040"
  chart-1: "#4658d8"
  chart-2: "#14937f"
  chart-3: "#7a5ad9"
  chart-4: "#d08a1a"
  chart-5: "#c4344d"
  chart-6: "#5b7aa8"
typography:
  display:
    fontFamily: "\"Newsreader Variable\", \"Newsreader\", \"Iowan Old Style\", Georgia, serif"
    fontSize: 56px
    fontWeight: 420
    lineHeight: 1.04
    letterSpacing: -0.022em
  h1:
    fontFamily: "\"Newsreader Variable\", \"Newsreader\", \"Iowan Old Style\", Georgia, serif"
    fontSize: 40px
    fontWeight: 430
    lineHeight: 1.1
    letterSpacing: -0.02em
  h2:
    fontFamily: "\"Newsreader Variable\", \"Newsreader\", \"Iowan Old Style\", Georgia, serif"
    fontSize: 26px
    fontWeight: 440
    lineHeight: 1.2
    letterSpacing: -0.016em
  h3:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 17px
    fontWeight: 590
    lineHeight: 1.35
    letterSpacing: -0.012em
  h4:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 14px
    fontWeight: 590
    lineHeight: 1.4
    letterSpacing: -0.008em
  body-lg:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.011em
  body:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.01em
  body-sm:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.006em
  label:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 12.5px
    fontWeight: 510
    lineHeight: 1.4
  caption:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.002em
  code:
    fontFamily: "\"IBM Plex Mono\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.6
  numeral:
    fontFamily: "\"Inter Variable\", \"Inter\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: 28px
    fontWeight: 510
    lineHeight: 1.1
    letterSpacing: -0.02em
rounded:
  xs: 3px
  sm: 5px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "12": 48px
  "16": 64px
  "24": 96px
  section: 64px
  section-alt: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0px 14px"
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    rounded: "{rounded.md}"
    padding: "0px 14px"
    height: 36px
  button-outline-hover:
    backgroundColor: "{colors.surface-raised}"
  button-subtle:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.link}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0px 12px"
    height: 32px
  button-subtle-hover:
    backgroundColor: "{colors.primary-soft}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 20px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0px 12px"
    height: 38px
  badge:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.link}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  link:
    textColor: "{colors.link}"
  band-inverse:
    backgroundColor: "{colors.surface-inverse}"
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
  navigation:
    backgroundColor: "{colors.surface-inverse}"
    height: 56px
---

# Lanka Academia design system

> The authoritative reference for the interface. **Read this before changing any UI.** Build from the tokens in `design-system/tokens.css` (loaded through `src/styles/index.css`); never hard-code a colour, font size, radius or shadow. If a value is missing, add a token to `design-system/roles.json`, rebuild with the extract-design script (`extract.mjs --rebuild --out design-system`), and re-read the diff of `DESIGN.md` (a rebuild refreshes only the front matter).
>
> Provenance: the starting measurements (spacing grid, hairline borders, 36px controls, tight tracking, 510/590 weights) were taken from linear.app on 2026-11-08 (`design-system/source/report.md`). Nothing else is borrowed: no logo, icon, illustration, copy or brand colour. Lanka Academia is inspired by that discipline, not affiliated with it.

## Overview

A quiet, dense, editorial research instrument. Pages sit on an off-white `{colors.background}` (or a deep midnight navy in dark mode), content lives in white hairline-bordered cards, and the left rail is permanently dark navy in both themes so the product always has one strong anchor. Headlines are set in Newsreader, a serif with a bookish tone suited to an academic subject; everything that is data (numbers, tables, controls) is Inter. One accent, indigo, carries interaction; teal, violet and amber are reserved for meaning (see Colors).

The bold move: the Overview hero is **the data itself**. `OverviewLandscape` draws one dot per collected profile, grouped by institution, and recolours on demand by qualification, position or research-data availability. It replaces the usual gradient banner and is always captioned as collected profiles, not the national academic population.

What it never does: gradient hero banners, glassmorphism, drop-shadow stacks, rainbow category palettes, bright "good/bad" traffic-light colours on people, or any visual that implies a score is definitive.

## Colors

Roles (full light and dark values are in the front matter and in `tokens.css` as `--color-<name>`):

| Role | Use it for | Never for |
|---|---|---|
| `{colors.background}` / `{colors.surface}` / `{colors.surface-raised}` | page canvas, cards, table headers and nested panels | decoration |
| `{colors.heading}`, `{colors.text}`, `{colors.text-muted}` | headings and key numbers, body copy, secondary copy and captions | muted text for essential information (keep it ≥ 4.5:1) |
| `{colors.border}`, `{colors.border-strong}` | hairlines between and inside cards; input and outline-button borders | thick or coloured dividers |
| `{colors.primary}`, `{colors.primary-soft}`, `{colors.link}` | the one main action per view, selected states, links, **Sri Lanka** in comparisons | more than one filled primary button per view |
| `{colors.amber}` / chart-4 | **overseas** and international benchmark tiers; "needs review" cautions | success |
| `{colors.teal}` | non-state institutions and documented evidence | "positive" judgement |
| `{colors.violet}` | secondary category in stacked or dot charts | emphasis |
| `{colors.success}`, `{colors.warning}`, `{colors.danger}` | data-quality status (verified, thin sample, conflict) | ranking people or institutions |
| `{colors.sidebar*}` | the navigation rail | content |

Semantics are fixed across the product: **indigo = Sri Lanka / the focus, amber = overseas and benchmark tiers, teal = non-state / documented**. A standing score uses a single slate-to-indigo ramp (`standingColor`) so a lower score is never painted red. Chart categorical order is `chart-1…6`; the first is the highlight.

Dark mode is a designed theme, not an inversion: surfaces step up in lightness (`#080b14` → `#0e1220` → `#141a2c`), borders become `#212638`, primary lifts to `#7b8cff`, and heatmaps switch to a dark ramp (`HEAT_RAMP_DARK`). It follows the Appearance switch in the sidebar (Light / Dark / System), applied as `data-theme` on `<html>`.

## Typography

- **Display and page headings**: Newsreader (`--font-display`), weight 420–440, tracking −0.02em. Used for the page `h1` (40px), card and section titles (`h2`, 22–26px) and for large "name" numerals such as a department name in a key fact.
- **Everything else**: Inter (`--font-sans`) at 400 for reading text, **510** for labels, controls and emphasised numbers, **590** for small headings (`h3`/`h4`). Never 700.
- **Numerals**: `font-variant-numeric: tabular-nums` on every figure that is compared down a column or across cards; the stat numeral is 26–28px / 510 / −0.02em.
- Sizes: display 56 (36 on phones), body 15, table and control text 13.5, labels and captions 12–12.5. No text under 12px. Sentence case everywhere; eyebrow labels are small indigo text with a short rule, not uppercase.

## Layout

- 4px grid (`--space-1…24`). Cards pad 20–24px; the gap between cards is 16px (`--space-4`); sections are separated by space and a small eyebrow, not rules.
- App shell: 248px dark sidebar, 52px translucent topbar, content column max 1280px (`--container-page`). Below 1100px the sidebar becomes a drawer opened from the topbar.
- Page template: eyebrow → serif `h1` → one-sentence lede → content. Filters live in a global drawer (the topbar "Filters" button), not in each page.
- Responsive rule: one column below 1100px; two-up grids collapse to one; wide tables scroll inside `.table-scroll` rather than stretching the page. Every page must have no horizontal page scroll at 390, 820 and 1440 (enforced by `tests/smoke.spec.ts`).

## Elevation & Depth

Flat by default: cards use `{shadow-xs}` plus a 1px `{colors.border}`; menus, popovers and tooltips use `--shadow-md`; dialogs and the drawer use `--shadow-lg`. The only dark panel inside a light page is the landscape hero, which gets `--shadow-md`. No coloured or stacked shadows. Dark mode relies on border and surface steps, with deeper shadows only for overlays.

## Shapes

Radius scale: controls 8px (`{rounded.md}`), cards 12px (`{rounded.lg}`), hero and large panels 16px (`{rounded.xl}`), chips and status pills fully round, bars 2–3px. Borders are always 1px; a stronger border (`border-strong`) marks form controls. Dots in the landscape are circles sized to the grid pitch.

## Components

- **Buttons** (`src/components/ui/button.tsx`; classes `.button`, `.primary`, `.btn-outline`, `.ghost`, `.icon-button`): 36px tall, 8px radius, 13.5px/510. Primary is filled indigo with a 1px top highlight; outline is surface-coloured with `border-strong`; ghost is text-only. **Do not name a class `outline`**: Tailwind's `.outline` utility will add a currentColor outline (this caused harsh black/white borders until it was renamed).
- **Cards** (`Card`, `.card`): white surface, 12px radius, 1px border, title in Newsreader 22px, optional subtitle and right-aligned action. Cards never nest a second bordered card except for deliberate sub-panels (`{colors.surface-raised}`).
- **Fact strip / stats**: label (12.5px muted) above a 26–28px/510 numeral above a caption; separated by hairlines, no boxes. Used on the Overview, profile and Methodology.
- **Segmented control** (`.chip-group`, `.chart-scale-toggle`): a 2px-padded track with a raised selected segment. Used for chart modes and filters with ≤ 4 options; longer lists use the base-select menu.
- **Selects** use `appearance: base-select` with a custom popover; **multi-selects** (`.multi`) show chips and a searchable list.
- **Tables** (`.table-scroll > table`): sticky 12px/510 muted header on `surface-raised`, 13.5px rows with hairlines, left-aligned first column, tabular numerals with an inline value bar (`.table-number-track`) for compared metrics.
- **Charts** (`src/components/Chart.tsx` + `src/analytics/plot-format.ts`): ECharts with the shared theme: no chart borders, hairline gridlines (`chartInk.grid`), 12.5px labels in Inter, tooltips built with `tooltipHtml`, 200–400ms enter motion that is switched off under `prefers-reduced-motion`. Hatched bars mean small samples (5–9); fewer than 5 are not drawn. Always show n.
- **Landscape** (`OverviewLandscape`): dark midnight panel, dot per profile, colour by mode, labels placed on the first free lane, right-edge labels right-aligned, hover/focus lifts one institution and shows its counts, click opens the institution.
- **Profile dossier** (`Academics.tsx` + `.person-hero`, `.key-facts`, `.source-tile`, `.profile-layout`): monogram disc (initials, never a generated face) beside the name; the research standing ring at right (single-colour ramp, labelled "Middle / High …" and confidence); a ruled key-fact strip; source tiles with a 2px status rail; peer results as cards; a sticky "Work with this profile" panel.
- **Drawer** (Radix Dialog with `.drawer`): used for Filters and the Compare people list.
- **Badges / status**: 11.5px/510 pills tinted 10% with the semantic colour; text colour mixed toward the heading colour to keep contrast.

## Do's and Don'ts

### Do

- Use tokens for every colour, size, space, radius and shadow; add a token if one is missing.
- Keep one filled primary button per view; everything else outline or ghost.
- Show the sample size (n) and the data source next to any statistic; label missing values "—" or "Not recorded", never 0.
- Use "collected profiles" wording, not "all academics"; describe scores as indicative and never as a judgement of a person.
- Check both themes and 390px before calling a UI change done (`tests/smoke.spec.ts` covers overflow).

### Don't

- Don't add gradients behind text, glass blur on content, emoji icons, or per-category rainbow palettes.
- Don't colour people red/green. Don't use the amber or teal for generic emphasis.
- Don't use a Tailwind utility name (`outline`, `inline`, `container`, `shadow`…) as a component class.
- Don't hide content behind hover; touch users need the same information.
- Don't use linear.app's logo, illustrations, photography, icons or copy.

## Motion

`--duration-fast` 120ms (hover, colour), `--duration-base` 200ms (popovers, toggles), `--duration-slow` 360ms (bars and chart enter); easing `--ease-standard` for state changes and `--ease-emphasized` for entrances. Motion explains change (a bar growing, a ring filling, a drawer sliding); it never loops or decorates. `prefers-reduced-motion` disables chart animation and transitions globally.

## Iconography & Graphics

- Icons: Lucide line icons, 1.6–1.7px stroke on a 24px grid, drawn at 14–18px in `currentColor`; no filled or duotone icons.
- Brand mark (`BrandMark.tsx`): an original orbit-and-node mark in indigo; avatars are monograms (`AcademicPortrait`).
- Custom graphics are hand-drawn inline SVG using the same tokens (hand-built): flat, one or two colours from the palette, 1.2–1.6px strokes, dashed orbits for "in progress/uncertain", no gradients or 3D.
- Chart colours in order: `{colors.chart-1}` indigo, `chart-2` teal, `chart-3` violet, `chart-4` amber, `chart-5` rose, `chart-6` slate-blue (`--color-chart-<n>`). Gridlines `#e9ecf2` (dark `#1b2033`), labels `#5f697d` (dark `#8189a0`).

## Responsive Behavior

- Breakpoints: 640 (phone), 820 (tablet), 1100 (sidebar becomes a drawer, rails stack), 1440 (reference desktop).
- Phones: display 56→36px, h1 40→30px, h2 26→22px; segmented controls wrap their labels; the landscape scrolls sideways with its labels intact; tables scroll inside their card; peer cards and key facts go to 1–2 columns.
- Touch targets are ≥ 36px; the mobile menu and Filters are always one tap from the topbar.

## Accessibility

Focus uses a 3px indigo ring (`--shadow-ring`) on `:focus-visible`; contrast for text is ≥ 4.5:1 in both themes; charts have an `aria-label` description and keyboard-reachable alternatives (tables, details lists); the landscape columns are focusable buttons; status is never conveyed by colour alone (labels and patterns accompany tints); dialogs trap focus and restore it.

## Known Gaps

- `src/styles/legacy.css` (~600 lines, lowest cascade layer) still styles the PhD Origins details, Global benchmark tables, the pinned-people panel and a few small components. They render correctly with token aliases but should be migrated to the `ds` layer.
- The Origins Sankey and map use their own ECharts palettes that are close to, but not exactly, the chart tokens.
- Hover and focus states were measured on Linear's most common controls only; the rest were designed.
- On phones the landscape needs sideways scrolling to see every institution.

## Files

- `design-system/tokens.css`: every token as a CSS custom property (loaded in `src/styles/index.css` into the `ds` layer).
- `design-system/theme.css`: the same tokens as a Tailwind v4 `@theme`.
- `design-system/design.tokens.json` / `design.dark.tokens.json`: W3C Design Tokens.
- `design-system/roles.json`: the choices behind the names; change it, then `--rebuild`.
- `design-system/preview.html` and `design-system/source/`: token preview and the original Linear measurement report and screenshots.
- `src/styles/`: `aliases.css` (legacy variable names → tokens), `base.css`, `shell.css`, `controls.css`, `surfaces.css`, `pages.css`, `legacy.css`.

# Website analytics

## 1. Overview

Lanka Academia uses [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) to measure aggregate website activity. The beacon is a short snippet in `index.html` (the site token is public by design). Hosting on GitHub Pages and all URLs are unchanged.

## 2. Data collected

Cloudflare reports **visits** (a page view that arrives from another site or directly) and **page views**, with daily trends. Aggregate traffic dimensions such as country, referring site, and device and browser type are available in the Cloudflare dashboard. Cloudflare does **not** report unique visitors, so none is shown or claimed.

## 3. Privacy

- **The application** sets no cookies, uses no local storage for analytics and creates no visitor identifier. The snippet loads once and is skipped on localhost and for visitors whose browser sends Do Not Track or Global Privacy Control.
- **Cloudflare** processes each request on its side, including deriving an approximate country from the IP address. We receive aggregate counts only, through a Cloudflare account protected by sign-in.

The full disclosure is in [legal/PRIVACY.md](legal/PRIVACY.md).

## 4. Public statistics

The Website Analytics card on the Data & Methodology page shows four KPIs (total visits, total page views, page views per visit, average daily visits) and a daily line chart of visits and page views, with the reporting period, source and last-updated date. Everything comes from one approved aggregate file, `public/data/platform_usage.json`, written only by the export command below with `--publish`. It holds the totals and one `{date, visits, pageViews}` entry per reported day.

- **Derived values** are calculated in the page from those numbers: page views per visit = total page views / total visits; average daily visits = total visits / calendar days in the reporting period. Days without a reported value are gaps in the chart, never zero.
- **Validation:** a strict schema (`scripts/usage-schema.mjs`) checks the file on every export, privacy check and CI run, and the page ignores a file that fails. Daily values must add up to the totals, and unknown keys (a country, a path) make it invalid.
- **Before the first export** the card shows "Analytics data not yet available". Values are never invented.

## 5. Private reporting

Cloudflare's API keeps only a limited window of data (at least 30 days), so run a monthly export:

```sh
node scripts/usage-export.mjs --from 2026-12-01 --to 2026-12-31            # private dated export
node scripts/usage-export.mjs --from 2026-12-01 --to 2026-12-31 --publish  # also write the public aggregate
node scripts/usage-export.mjs --publish-from <saved export>                # publish from a saved export
node scripts/usage-export.mjs --introspect                                 # list the fields your account exposes
```

- **Credentials:** `CF_API_TOKEN` (read access to account analytics), `CF_ACCOUNT_ID` and `CF_SITE_TAG`, in the environment or `private/analytics/.env`. Never in the repository, a publishing workflow or the site.
- **Archive:** exports are written to `private/analytics/exports/` (per-day totals, country and referrer counts, no visitor identifiers) with a `manifest.csv` recording each file's period, export time and SHA-256. The folder is git-ignored and blocked by the privacy guard; include it in the private backups.
- **Check the beacon** after changes: build, then `node scripts/verify-analytics-beacon.mjs` (records requests without sending anything to Cloudflare).

## 6. Limitations

- Figures are **approximate**. Ad blockers, Do Not Track and Global Privacy Control signals and bots affect counts.
- The site uses **hash-based routing** (`/#/...`). Cloudflare does not see the part after `#`, so every route is recorded under one address: reliable page-level breakdowns are not available, and in-app navigation is counted only by some browsers.
- Counts show traffic, not how many people read or relied on any statement.

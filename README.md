# Sri Lanka Academic Atlas

Explore academics, compare peer groups, and discover where their PhDs were awarded.

**[Open the app](https://maninka123.github.io/academic-lens-lk/)** · [Dataset guide](Data%20files/README.md) · [Full documentation](docs/PROJECT_GUIDE.md)

<!-- dataset-summary:start -->
**1,393 Sri Lankan profiles · 12 institutions · 1,630 international benchmark profiles.** Partial collection, updated 11 October 2026. [Coverage report](reports/validation-report.md).
<!-- dataset-summary:end -->

- Search people and inspect qualifications, research links and peer comparisons.
- Compare universities, faculties and departments; explore global benchmarks.
- Filter, pin, share and export. Desktop-first, mobile-friendly.

## Screenshots

![Overview](docs/screenshots/overview.png)

| Compare academics | Individual profiles |
| --- | --- |
| ![Comparison Studio](docs/screenshots/comparison-studio.png) | ![Academic profile](docs/screenshots/person-profile.png) |

![PhD origins map](docs/screenshots/phd-origins.png)

<details>
<summary>Mobile preview</summary>

<img src="docs/screenshots/mobile.png" alt="Academic Atlas on mobile" width="320" />

</details>

## Run locally

Node.js 22.12+; no backend required.

```sh
npm ci
npm run dev
```

Edit the CSVs in `Data files/`, then run `npm run data:import`. Validate with `npm test` and `npm run build`.

## Data notes

Missing values stay missing. Comparisons show coverage and source information; citation counts are not a measure of overall academic quality. **Dr Name*** means a documented completed research doctorate; medical qualifications alone do not qualify under this display convention.

[Methodology & setup](docs/PROJECT_GUIDE.md) · [Data policy](docs/DATA_POLICY.md) · [Collection prompt](DATA_COLLECTION_PROMPT.md)

GitHub Pages releases: **Actions → Build, check and deploy GitHub Pages → Run workflow**. Map boundaries: [Natural Earth / world-atlas](https://github.com/topojson/world-atlas).

> [!NOTE]
> This project uses only publicly available information. Data may be incomplete, outdated or incorrect—please verify details with the original sources.

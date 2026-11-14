# Research standing score

The application displays a 0–100 **weighted blend of component percentiles** relative to collected Sri Lankan profiles. It is not a percentile rank of the composite score and does not measure overall research quality, teaching, service or professional merit. [Main README](../README.md) · implementation: `src/analytics/standing-score.ts` · [independent methodological evaluation](../research/scoring-validation/README.md).

## Implemented calculation

The app ranks each available measure in a selected peer pool using `100 × (number below + ½ number tied) / n`. For each measure, peers normally need values labelled with the same provider. The target is included if present in the dataset. The score is the weighted mean of available component percentiles, rescaled over the weights used and rounded to an integer:

| Measure | Weight | Limited meaning |
|---|---:|---|
| h-index | 40% | accumulated citation-linked output |
| Citations 2021–2025 | 35% | citation activity in that recorded window |
| Publications | 25% | indexed output volume |

The weights are project assumptions, not established scientific constants. Different measures can have different peer pools. A score of 50 is not necessarily the median of composite scores. The app groups broad academic titles into Professor, Mid-career and Early-career, and uses a broad discipline where mapped. These are imperfect proxies for field and career stage.

## Bands

| Rounded score | Display label |
|---|---|
| 80–100 | Upper |
| 60–79 | High-Mid |
| 40–59 | Middle |
| 20–39 | Low-Mid |
| 0–19 | Lower |

These are fixed bands on the blended score, not evidence of research quality or validated performance categories.

## Missing data and fallback behavior

Missing values are skipped, not zero; recorded zero is a value. Standard scoring tries same field × stage, then stage alone, with at least ten same-provider observations per usable measure, at least two usable measures and at least one h-index or recent-citation measure. Stage-only scores remain standard. If no standard score is possible, the implementation tries, in order: staged groups with a five-person minimum and one usable measure; field across stages then everyone with minimum ten and one usable measure; and finally those levels pooling provider labels at minimum ten. Such fallback scores are labelled indicative and low confidence. When no viable pool exists the person is not scored.

The across-stage fallback can occur even when the stage is known; its current caveat nevertheless says the stage was not recognised. Standard stage-only results may not explicitly say that disciplines were mixed. Provider equality can also match missing or generic provider labels; it is not proof of source comparability. These are implementation and presentation limitations, not changes made by the study.

Standard-score confidence awards one point each for field × stage, all three measures, smallest component pool ≥25, and *any* recognised verified research identity. High requires four points; medium requires two or three; otherwise low. Indicative scores are low and stage-only scores are capped at medium. This is a heuristic checklist, not a statistical confidence interval or proof that every input is correctly attributed.

## Scientific basis and validation status

Publication counts, recent citations and h-index can describe aspects of indexed output and citation activity, subject to provider coverage, career length, discipline, document type and attribution. They cannot reliably establish research quality, originality, reputation or total academic performance. H-index and citations are related and the weighted inputs may overlap. The [Leiden Manifesto](https://doi.org/10.1038/520429a), [DORA guidance](https://sfdora.org/resource/guidance-on-the-responsible-use-of-quantitative-indicators-in-research-assessment/) and [OECD/JRC handbook](https://doi.org/10.1787/9789264043466-en) inform transparency, contextual interpretation and sensitivity testing; none endorses this application's indicators or weights.

The [study](../research/scoring-validation/README.md), [methods](../research/scoring-validation/METHODOLOGY.md) and [results](../research/scoring-validation/RESULTS.md) evaluate implementation at commit `ab0ad8ac72d7d668b66331c938e166a528048fd4` using the captured `partial-e191f13547` public dataset snapshot, including pre-existing uncommitted changes. In 3,651 eligible records, 2,535 received scores; 1,748 had unmapped disciplines. Named weight alternatives gave high overall rank correlations but changed 134–221 bands and moved individual scores by up to 8–15 points. This does not establish validity, fairness or an optimal weighting. Identity, provider and peer selection changed both coverage and results.

## Responsible interpretation and proposed safeguards

Do not use the score as a standalone assessment of a person, for high-stakes decisions or as an international or national ranking. Before any future publication of named composite scores, the study recommends verifying each metric's actual identity and provider, dates and comparability; requiring sufficient comparable peers and complete inputs; and withholding scores when field, stage or provenance is inadequate. These are recommendations for review, **not rules implemented in the current application**. The effects of restricting eligibility and removing fallback require a separate impact review. The existing algorithm, weights, score labels and published values remain unchanged.

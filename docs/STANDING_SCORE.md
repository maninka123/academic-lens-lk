# Research standing score

A single 0–100% figure that says where an academic sits **among comparable collected profiles**. It is descriptive, not a rating of quality, teaching or service. Back to the [main README](../README.md) · code: `src/analytics/standing-score.ts`.

## How it is calculated

1. **Peer group** – same career stage × same broad discipline.
   Stages: *Professor* (Senior Professor, Professor), *Mid-career* (Associate Professor, Senior Lecturer), *Early-career* (Assistant Professor, Lecturer, Assistant Lecturer).
2. **Percentile** – each measure is ranked inside that group: `(below + ½ ties) ÷ n × 100`. Only peers with a value **from the same source** (Google Scholar, OpenAlex, …) are counted.
3. **Blend** – weighted average of the percentiles that exist:

| Measure | Weight | Tells you |
|---|---|---|
| h-index | 40% | sustained impact |
| Citations 2021–2025 | 35% | current influence |
| Publications | 25% | output volume |

`score = Σ(weight × percentile) ÷ Σ(weights used)` → rounded. 50% is typical for the group.

## Bands

| Score | Label |
|---|---|
| 80–100 | High for their group |
| 60–79 | Above typical |
| 40–59 | Typical |
| 20–39 | Below typical |
| 0–19 | Low for their group |

## Missing data and fallbacks

Missing is **never zero**: a missing measure is skipped and the weights are rescaled. A recorded 0 is a real value.

The *standard* score needs ≥ 2 measures (one must be h-index or recent citations) and ≥ 10 same-source peers per measure. If that fails the app builds an **indicative** score (shown as `~54%`, tagged *Indicative*, always low confidence), relaxing one rule at a time and listing what was relaxed:

| Order | Fallback | Caveat shown |
|---|---|---|
| 1 | Stage × discipline → stage only | "compared across all disciplines" |
| 2 | One measure is enough; peer groups of 5–9 accepted | "only one measure" / "5+ accepted" |
| 3 | Career stage unknown → compare across all stages | "career stage not recognised" |
| 4 | Pool peers from other sources | "not strictly like-for-like" |
| – | No h-index, citation or publication value at all | **Not scored** |

## Confidence (standard scores)

One point each for: same discipline × stage group · all 3 measures · smallest peer group ≥ 25 · verified research identity. **High** 4 · **Medium** 2–3 · **Low** 0–1 (stage-only is capped at Medium). Indicative scores are always Low.

## Where it appears

Profile page (stamp, per-measure bars, click for the full calculation) and the Academics side-by-side view. Every number links back to this calculation panel.

## Limits

Relative to **collected profiles**, not all academics. Citation counts differ by source and field. Q1 journal data are not used. Not a measure of teaching, service or overall quality.

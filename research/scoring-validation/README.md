# Research scoring: methodological evaluation

**Status:** internal research study, 14 November 2026; not peer-reviewed, externally validated or endorsed. **Version:** evaluation 1.0; live score implementation at base commit `ab0ad8ac72d7d668b66331c938e166a528048fd4`. The input snapshot is `partial-e191f13547` and includes pre-existing uncommitted public data changes; its exact hashes are in [manifest.json](data/manifest.json).

## Objective and questions

This independent-of-implementation evaluation asks what the live composite actually calculates, how complete and comparable its inputs are, how sensitive scores are to weights and peer-group choices, and whether the evidence supports the intended interpretation. It aims to enable criticism and responsible interpretation, not to confirm predetermined results.

The live score averages same-provider midrank percentiles of h-index (40%), citations in 2021–2025 (35%) and publications (25%), with weights rescaled when measures are unavailable. It is **not the percentile of a composite score**, and it cannot measure overall academic quality. Its target is a limited position within collected bibliometric records, with broad and sometimes fallback peer groups. See [methodology](METHODOLOGY.md) for exact conditions.

The study is informed by the [Leiden Manifesto](REFERENCES.md), [DORA's quantitative-indicator guidance](REFERENCES.md), the [OECD/JRC handbook](REFERENCES.md), and bibliometric literature. They do not approve this implementation or its chosen weights. We compare named alternative weights and a simplex grid, provider and identity restrictions, completeness, field and stage definitions, minimum peer thresholds, winsorisation and a different tie convention. Calculations are cross-checked against the live scorer.

## Findings

The snapshot contains 3,651 app-eligible profiles, of which 2,535 received a score. Field classification is missing for 1,748 profiles. The tested named weight alternatives have high overall rank correlation with the baseline but change 134–221 score bands and can shift individual scores by 8–15 points; wider grid changes can be larger. The indicators are strongly correlated. Broader peer grouping, identity restrictions and tie treatment also change scores and coverage. These findings are conditional on the collected sample and do not establish fair or valid individual assessment. The 40/35/25 weights remain an unvalidated assumption, and no optimal weights can be identified here.

Detailed tables, scenario definitions, captions and qualifications: [RESULTS.md](RESULTS.md), [METHODOLOGY.md](METHODOLOGY.md), [LIMITATIONS.md](LIMITATIONS.md), [REFERENCES.md](REFERENCES.md). No live algorithm or published score is changed by this study. See also the [application score documentation](../../docs/STANDING_SCORE.md).

## Reproduce

From repository root, using Python 3.9.6 and Node 22.23.2 (the run recorded here):

```sh
python3 -m venv /tmp/lanka-score-venv
/tmp/lanka-score-venv/bin/pip install -r research/scoring-validation/requirements.txt
npm ci
MPLCONFIGDIR=/tmp/lanka-score-mpl /tmp/lanka-score-venv/bin/python research/scoring-validation/scripts/analyze.py
./node_modules/.bin/esbuild research/scoring-validation/scripts/live-check.ts --bundle --platform=node --format=esm --outfile=/tmp/lanka-score-live-check.mjs
node /tmp/lanka-score-live-check.mjs research/scoring-validation/data/snapshot.csv /tmp/lanka-score-live.json
MPLCONFIGDIR=/tmp/lanka-score-mpl /tmp/lanka-score-venv/bin/python research/scoring-validation/scripts/crosscheck.py /tmp/lanka-score-live.json
/tmp/lanka-score-venv/bin/python research/scoring-validation/scripts/report.py
MPLCONFIGDIR=/tmp/lanka-score-mpl /tmp/lanka-score-venv/bin/python -m unittest discover -s research/scoring-validation/tests
```

The analysis generates aggregate JSON and CSV tables in `results/` and PNG figures in `figures/`; the TypeScript comparison writes per-record temporary scores only to `/tmp`, not the repository. A successful cross-check reports 3,651 checked and zero mismatches. `snapshot.py` can reconstruct the minimal input **only** if all current public input hashes match the manifest; it overwrites the snapshot and manifest and should not be run on newer data when reproducing this study. No raw source file is altered by analysis. Small groups in subgroup tables are suppressed; values and charts are not proof of individual validity.

The snapshot contains no names, original IDs, URLs or emails, but is pseudonymised rather than anonymous and could be linked to public records. Review that risk before public publication. A clean checkout of the base commit alone cannot reconstruct the dirty input files; the included snapshot and hashes are the provenance for this exact run.

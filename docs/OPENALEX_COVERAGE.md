# OpenAlex lookup coverage

Checked 12 October 2026. Collection is paused at the user's request until the API budget is available.

- The original file contained 212 lookups for Ruhuna, KDU and Kelaniya.
- Complete saved query batches recovered 31 Moratuwa lookups: five unambiguous matches. Multiple candidates remain blank for review.
- Most other institutions still need OpenAlex lookups. A pending lookup is neither a failed match nor a zero research score.
- The API returned HTTP 429 (shared daily budget exhausted). No API key is configured. No paid access was requested.
- The collector now preserves previous results, checkpoints completed batches and supports `--cache-only` without network access.

Resume when budget is available:

```sh
python scripts/baselines/sri_lanka_openalex.py
npm run data:import
```

An optional free OpenAlex key can be configured as `OPENALEX_API_KEY`; never commit it. Official API responses are cached locally under `scripts/baselines/_cache/openalex/` and excluded from Git. Matches require surname/initial agreement and an institutional affiliation; ambiguous candidates are not assigned metrics.

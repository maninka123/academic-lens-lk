# Privacy safeguards: how internal evidence is kept out of the repository

The repository is public. Internal research evidence (identity and employment reviews, investigation notes, correction and collection logs, unresolved searches, rejected matches, confidential notes) must never be committed. This page explains the protections and how to maintain them. Rules for contributors and coding agents are in [AGENTS.md](../AGENTS.md).

## Where things live

| Kind | Location | Tracked? |
|---|---|---|
| Public academic data (one `academics.csv` per department, rankings, aliases) | `Data files/universities/…`, `Data files/international/…` | Yes |
| Published output | `public/data/` (allowlist) | Yes |
| Internal evidence, reviews, logs | `Data files/` (matching `.gitignore` patterns) or `private/` | **No** |
| Private backups | outside the repository | No |

Internal files stay on disk and in the backup. Nothing deletes them, and no script copies them anywhere public.

## The layers

1. **`.gitignore` patterns** exclude evidence, review, verification, log, worklist, rejected-match and candidate files under `Data files/`, plus `private/`, `.env*`, keys and bundles. Patterns, not file lists, so new files of these kinds are covered automatically.
2. **`scripts/privacy-guard.mjs`** is the enforcement point. Modes: `--staged` (pre-commit), `--push` (pre-push; checks every commit being pushed, so a file committed then deleted is still caught), `--all` (every tracked file, used in CI and `npm run check:privacy`), `--history` (manual audit of all branches).
3. **Git hooks** in `.githooks/` run the guard. `npm install` / `npm ci` enables them (`core.hooksPath`).
4. **GitHub Actions** runs `privacy-guard.mjs --all` and `check-public-assets.mjs` before building. A failure stops the deploy.
5. **Publishing allowlist** (`scripts/public-assets.mjs`): only listed files and columns reach `public/data`. Published free text is scanned for personal links, email addresses, phone numbers and internal wording.
6. **Import-time sanitising** (`scripts/public-notes.mjs`): the published `notes` field keeps provenance only. Internal wording, remarks about leave or employment, and social-media profile links are dropped. The full note stays private.
7. **Tests** (`scripts/privacy-guard.test.mjs`) create throwaway repositories and prove that internal files, secrets and sensitive fields are detected and that the hooks block the commit.

## Adding a new kind of internal file

1. Add a pattern to the privacy block in `.gitignore`.
2. Add the matching regular expression to `FORBIDDEN_PATHS` in `scripts/privacy-guard.mjs`, with a reason.
3. Add an example path to the first test in `scripts/privacy-guard.test.mjs`.
4. Run `npm run check:privacy` and `npm test`.

## Publishing a new kind of file or field

Add the file to `PUBLIC_FILES` or the column to `PUBLIC_ACADEMIC_COLUMNS` in `scripts/public-assets.mjs`, check the values for personal or internal wording, and extend the tests. If the guard wrongly blocks a file that is public by design, add it to `ALLOWED_PATHS` with a comment.

## If something internal was committed

1. Stop pushing. If it is only local, remove it from the commit (`git rm --cached`, amend or reset).
2. If it was pushed, treat it as published: back up the repository first (`git bundle create … --all`), remove the file from history on all branches, verify with `node scripts/privacy-guard.mjs --history`, and only then force-push, with the owner's explicit approval. Ask GitHub Support to clear cached views and pull-request references.

## Limitations

- Local hooks can be skipped (`git commit --no-verify`) or not installed (`core.hooksPath` unset, `npm install` not run). CI is the backstop, but it runs after a push, so a bypassed push has already reached GitHub. Enable branch protection and required checks to close this gap.
- The guard matches names and patterns. A sensitive file with an innocuous name, or sensitive wording that is not in the phrase list, is not detected. Review new data columns by hand.
- Detection is not erasure. Anything ever pushed may exist in GitHub's cache or references (for example pull-request refs), forks, clones and archives.
- The free-text scan finds listed patterns (social links, emails, phone numbers, internal phrases), not every possible subjective remark.

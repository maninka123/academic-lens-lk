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

1. **`.gitignore` patterns** exclude evidence, review, verification, log, worklist, rejected-match, candidate and removal-request files under `Data files/`, plus `private/`, `.env*`, keys and bundles. Patterns, not file lists, so new files of these kinds are covered automatically.
2. **`scripts/privacy-guard.mjs`** is the enforcement point. Every file is scanned in full whatever its size; a file that cannot be read, is binary where text is expected, or is too large to inspect is reported, never skipped. Modes:
   - `--staged` (pre-commit) and `--all` (every tracked file; CI and `npm run check:privacy`)
   - `--push` (pre-push): every commit being pushed, including a new branch compared with the remotes, for forbidden paths, credentials in added lines and credentials in commit messages. A file committed and then deleted is still caught. If the commits cannot be inspected the push is blocked, not assumed safe.
   - `--range <revs>` (CI, pull requests and pushes), `--history` (all branches), `--refs` (the full committed content of every local and remote branch) and `--full` (all three, used by the weekly audit).
3. **Git hooks** in `.githooks/` run the guard. `npm install` / `npm ci` enables them (`core.hooksPath`).
4. **GitHub Actions.** `privacy.yml` runs on every push to every branch and every pull request (job name **Privacy guard**), and weekly runs the full audit of every branch and all history. `deploy.yml` runs the same checks before it builds, so a failure stops the deploy.
5. **Publishing allowlist** (`scripts/public-assets.mjs`): only listed files and columns reach `public/data`. Published free text is scanned for personal links, email addresses, phone numbers and internal wording. Contact details are checked in every text column, remarks about leave in names and positions, and internal workflow wording in the structured and status columns.
6. **Import-time sanitising** (`scripts/public-notes.mjs`), applied to public output whatever the source holds:
   - `notes` keeps provenance only.
   - Email addresses, phone numbers, social links and scraped website footers are removed from `qualifications` and `interests`.
   - Remarks about leave are removed from names and positions.
   - `researchIdentities`, `researchObservations`, `metricEvidence` and the status columns use a neutral public vocabulary: review and conflict wording is replaced, a profile recorded as belonging to a different person is not published (link, identity, evidence or numbers), and a match recorded with a conflict is not published as an identity.
   The full original stays in the private files.
7. **Tracked source CSVs are as public as `public/data`.** `node scripts/redact-public-sources.mjs --apply` brings them to the same rules and first copies every original value to the git-ignored `Data files/_research_reviews/source_redactions.csv`. The guard fails if contact details or leave remarks reappear in a source CSV.
8. **Accepted removals are permanent** (`scripts/removals.mjs`, `scripts/removals-lib.mjs`, see below).
9. **Tests** (`scripts/privacy-guard.test.mjs`, `scripts/privacy-hardening.test.mjs`) create throwaway repositories and prove that internal files, secrets, large files, contact details, history, new-branch pushes and other branches are checked, and that the hooks block the commit.

## Applying a removal request

An accepted removal should reach the live site in one commit, and must not be undone by a later import.

1. `node scripts/removals.mjs add SL-xxxxxxxxxxxx --reason "<short reason>" --ref "<request reference>"` copies the full source row to `Data files/_research_reviews/removed_records.csv`, records the person in the private list `Data files/removal_requests.csv`, and deletes the row from the tracked source CSV.
2. `npm run data:import`, `npm run check:privacy`, `npm test`, then commit and push. The push deploys the site.
3. From then on `data:import` withholds that ID and that name at that university, `node scripts/removals.mjs check` verifies it, and the privacy guard fails if the person reappears in `public/data` or in a source CSV. The list is private, so the guard enforces it on the maintainer's machine; CI cannot see it.
4. Old copies: the person remains in earlier commits. Removing them needs a history rewrite, which needs the owner's explicit approval and a backup (see below), plus a GitHub Support request for cached views and pull-request references. Evidence needed for research integrity stays in the private archive.

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

## Branch protection (recommended, not enabled by the scripts)

Local hooks can be skipped, so server-side rules are the real backstop. In Settings > Branches (or a ruleset) on `main`:
- require the status check **Privacy guard** (and **build**) to pass before merging
- require a pull request before merging, and block force pushes and branch deletion
- keep Actions permissions read-only by default and review any workflow change
- delete merged branches (every older branch is already contained in `main`)
- enable secret scanning and push protection (Settings > Code security), and Dependabot alerts

Branch protection stops unreviewed changes reaching `main`. It does not remove anything already published.

## Limitations

- Local hooks can be skipped (`git commit --no-verify`) or not installed (`core.hooksPath` unset, `npm install` not run). CI is the backstop, but it runs after a push, so a bypassed push has already reached GitHub. Enable branch protection and required checks to close this gap.
- The guard matches names and patterns. A sensitive file with an innocuous name, or sensitive wording that is not in the phrase list, is not detected. Review new data columns by hand.
- Detection is not erasure. Anything ever pushed may exist in GitHub's cache or references (for example pull-request refs), forks, clones and archives.
- The free-text scan finds listed patterns (social links, emails, phone numbers, internal phrases), not every possible subjective remark.

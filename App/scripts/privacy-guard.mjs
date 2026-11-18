#!/usr/bin/env node
// Repository privacy guard. Keeps internal research evidence out of the public repository.
//
//   node scripts/privacy-guard.mjs --all        every tracked file (CI, manual audit)
//   node scripts/privacy-guard.mjs --staged     files staged for commit (pre-commit hook)
//   node scripts/privacy-guard.mjs --push       commits about to be pushed (pre-push hook; stdin as git sends it)
//   node scripts/privacy-guard.mjs --history    every commit reachable from any branch: paths, secrets in added lines and commit messages
//   node scripts/privacy-guard.mjs --range <revs>   a commit range, for example origin/main..HEAD (CI on pull requests and pushes)
//   node scripts/privacy-guard.mjs --refs       the full content of every local and remote branch (paths, secrets, sensitive fields)
//   node scripts/privacy-guard.mjs --full       --all, --refs and --history together (CI audit)
//
// To protect a new kind of internal file, add a pattern to FORBIDDEN_PATHS (and the
// matching line to .gitignore). To publish a new kind of legitimate file that the guard
// wrongly blocks, add it to ALLOWED_PATHS with a comment saying why it is public.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { SECRET_PATTERNS, sourceFieldProblems, sensitiveFieldProblems } from "./public-assets.mjs";
import { loadRemovals } from "./removals-lib.mjs";

/** Directories and files that must never be tracked, anywhere in the repository. */
export const FORBIDDEN_PATHS = [
  [/(^|\/)private\//i, "private/ is local-only storage"],
  [/(^|\/)Ethics Approval\//i, "ethics application documents are private"],
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/i, "environment file with secrets (only .env.example may be committed)"],
  [/\.(pem|key|p12|pfx|bundle|sqlite3?|db)$/i, "key, bundle or database file"],
  [/^Data\/(_research_reviews|_archive|_exports|User updates)\//i, "internal research folder"],
  [/(^|\/)(New updates|scholar_output)\//i, "scraper working output"],
  [/^Data\/(APPLICATION_HANDOFF|MISSING_INSTITUTIONS_RESEARCH|PROFILE_COMPLETION_REPORT)\b/i, "internal collection report"],
  // Internal evidence data: reviews, investigations, logs, unresolved searches, rejected matches.
  [
    /^Data\/.*(review|evidence|verification|change_log|observation|unresolved|followup|follow_up|worklist|rejected|overlapping|search_log|search_attempts|checkpoint|handoff|candidates|excluded|removal|removed)[^/]*\.(csv|tsv|json|jsonl|md|txt|xlsx|ipynb)$/i,
    "internal verification, review, log or evidence file",
  ],
  [/^International-Doctoral-Training-Study\//i, "the doctoral-training study is local and private; it is never committed"],
  [/^reports\/enriched-merge[^/]*\//i, "internal merge audit"],
  [/^research\/.*\/data\/snapshot\.csv$/i, "record-level research snapshot (pseudonymised, not anonymous)"],
];

/** Exceptions: files whose names look internal but are public by design. */
export const ALLOWED_PATHS = [
  // (none yet) Example: /^Data\/international\/openalex_matches\.csv$/
];

// Every file is scanned in full, whatever its size: a large file is exactly where something is easiest to miss.
// A file that cannot be read or is too large to inspect is reported, never skipped.
const TEXT_EXT = /\.(csv|tsv|json|jsonl|md|txt|mjs|js|ts|tsx|css|html|yml|yaml|py|sh|toml|ipynb|xml|svg|map|cfg|ini|env|example)$/i;
const KNOWN_BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|webm|avif)$/i;
const looksBinary = (buf) => buf.subarray(0, 8192).includes(0);
const MAX_INSPECT_BYTES = 200 * 1024 * 1024;

const git = (args, opts = {}) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts });
const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** Problems with a list of repository-relative paths. */
export function checkPaths(paths) {
  const problems = [];
  for (const p of paths) {
    if (ALLOWED_PATHS.some((re) => re.test(p))) continue;
    for (const [re, why] of FORBIDDEN_PATHS)
      if (re.test(p)) {
        problems.push(`${p}: ${why}`);
        break;
      }
  }
  return problems;
}

/** Problems with the text of one file (credentials; sensitive public-record fields). Never skips on size. */
export function checkContent(rel, text, { removedIds = null } = {}) {
  const problems = [];
  if (!TEXT_EXT.test(rel)) return problems;
  for (const [re, label] of SECRET_PATTERNS) {
    // Source data and tests legitimately contain tracking-style URL parameters (the importer strips them from published data).
    if (label === "credential-like URL parameter" && !/^public\//.test(rel)) continue;
    if (re.test(text)) problems.push(`${rel}: possible ${label}`);
  }
  if (/^public\/data\/academics\.csv$/.test(rel) || /^public\/data\/international\/academics\.csv$/.test(rel)) {
    const [headerLine] = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1);
    const header = headerLine.split(",");
    if (header.length > 60) problems.push(`${rel}: unexpectedly many columns`);
  }
  if (/^public\/data\/academics\.csv$/.test(rel)) problems.push(...sensitiveFieldProblems(text, rel));
  if (/^Data\/universities\/.*\/academics\.csv$/.test(rel)) problems.push(...sourceFieldProblems(text, rel));
  if (removedIds && removedIds.size && /(^public\/data\/academics\.csv$|^Data\/universities\/.*\/academics\.csv$)/.test(rel)) {
    const ids = text.match(/SL-[0-9a-f]{12}/g) || [];
    const hit = new Set(ids.filter((i) => removedIds.has(i)));
    if (hit.size) problems.push(`${rel}: ${hit.size} record(s) from an accepted removal request are present again`);
  }
  return problems;
}

/** Read bytes as text; unreadable or oversized files become a problem, not a silent skip. */
function inspect(rel, buf, opts) {
  if (buf.length > MAX_INSPECT_BYTES) return [`${rel}: larger than ${MAX_INSPECT_BYTES / 1048576} MB, cannot be inspected; keep large files out of the repository`];
  if (KNOWN_BINARY.test(rel)) return [];
  if (looksBinary(buf)) return TEXT_EXT.test(rel) ? [`${rel}: binary content in a text file`] : [];
  // Unknown extensions that are plain text are scanned for credentials too.
  return checkContent(TEXT_EXT.test(rel) ? rel : `${rel}.txt`, buf.toString("utf8"), opts);
}

const removedIdsHere = (cwd) => {
  try { return loadRemovals(`${cwd}/Data`).ids; } catch { return new Set(); }
};

/** Tracked files that .gitignore says must not be tracked. */
export function trackedButIgnored(cwd = ".") {
  return lines(git(["ls-files", "-ci", "--exclude-standard"], { cwd })).map(
    (p) => `${p}: tracked although .gitignore excludes it (git rm --cached)`,
  );
}

export function checkTracked(cwd = ".") {
  const paths = lines(git(["ls-files"], { cwd }));
  const problems = [...checkPaths(paths), ...trackedButIgnored(cwd)];
  const removedIds = removedIdsHere(cwd);
  for (const p of paths) {
    let buf;
    try {
      buf = fs.readFileSync(`${cwd}/${p}`);
    } catch (e) {
      if (e.code === "ENOENT") continue; // tracked but deleted in the working tree
      problems.push(`${p}: cannot be read for inspection (${e.code || e.message})`);
      continue;
    }
    problems.push(...inspect(p, buf, { removedIds }));
  }
  return problems;
}

export function checkStaged(cwd = ".") {
  const added = lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd }));
  const problems = checkPaths(added);
  const removedIds = removedIdsHere(cwd);
  for (const p of added) {
    let buf;
    try {
      buf = execFileSync("git", ["show", `:${p}`], { cwd, maxBuffer: 1024 * 1024 * 1024 });
    } catch (e) {
      problems.push(`${p}: staged content cannot be read for inspection (${e.message.split("\n")[0]})`);
      continue;
    }
    problems.push(...inspect(p, buf, { removedIds }));
  }
  return problems;
}

/** Every local and remote branch, in full: forbidden paths, credentials and sensitive fields in the committed content. */
export function checkRefs(cwd = ".") {
  const refs = lines(git(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"], { cwd })).filter((r) => !/\/HEAD$/.test(r));
  const problems = [];
  const seen = new Set();
  const removedIds = removedIdsHere(cwd);
  for (const ref of refs) {
    for (const l of lines(git(["ls-tree", "-r", ref], { cwd }))) {
      const m = l.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
      if (!m) continue;
      const [, sha, p] = m;
      const forbidden = checkPaths([p]).map((x) => `${x} (on ${ref.replace(/^refs\/(heads|remotes)\//, "")})`);
      problems.push(...forbidden);
      const key = `${sha}:${p}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const buf = execFileSync("git", ["cat-file", "blob", sha], { cwd, maxBuffer: 1024 * 1024 * 1024 });
        problems.push(...inspect(p, buf, { removedIds }).map((x) => `${x} (on ${ref.replace(/^refs\/(heads|remotes)\//, "")})`));
      } catch (e) {
        problems.push(`${p}: cannot be read on ${ref} (${e.message.split("\n")[0]})`);
      }
    }
  }
  return problems;
}

// ERE for `git log -G`: lets git pre-filter the history so only diffs that may hold a credential are read.
const SECRET_ERE = "gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}";
const secretLabels = SECRET_PATTERNS.filter(([, label]) => label !== "credential-like URL parameter");

/**
 * Problems in the commits selected by `revArgs` (a list of git revision arguments, empty = every branch):
 * forbidden paths, credentials in added lines, and credentials in commit messages.
 * Any failure to inspect is a problem: this check never fails open.
 */
export function checkCommits(revArgs, cwd = ".") {
  const args = Array.isArray(revArgs) ? revArgs : revArgs ? [revArgs] : ["--branches"];
  const problems = [];
  const paths = [...new Set(lines(git(["log", "--diff-filter=ACMR", "--name-only", "--pretty=format:", ...args], { cwd })))];
  problems.push(...checkPaths(paths).map((p) => p + " (in commit history)"));
  const patch = git(["log", "-p", "-U0", "--no-color", "--no-ext-diff", "--pretty=format:commit %h", `-G${SECRET_ERE}`, ...args], { cwd });
  let commit = "?";
  let file = "?";
  for (const l of patch.split("\n")) {
    if (l.startsWith("commit ")) commit = l.slice(7);
    else if (l.startsWith("+++ ")) file = l.slice(4).replace(/^b\//, "");
    else if (l.startsWith("+")) for (const [re, label] of secretLabels) if (re.test(l)) problems.push(`${file}: possible ${label} added in commit ${commit} (in commit history)`);
  }
  const messages = git(["log", "--pretty=format:%h%x00%B%x01", ...args], { cwd });
  for (const entry of messages.split("\x01")) {
    const [h, ...body] = entry.trim().split("\0");
    for (const [re, label] of secretLabels) if (re.test(body.join(" "))) problems.push(`commit message ${h}: possible ${label} (in commit history)`);
  }
  return [...new Set(problems)];
}

/** One revision selection per pushed ref. A new branch is compared with everything already on remotes. */
function pushRanges(stdin) {
  const ranges = [];
  for (const l of lines(stdin)) {
    const [, localSha, , remoteSha] = l.split(" ");
    if (!localSha || /^0+$/.test(localSha)) continue; // deleting a branch
    ranges.push(/^0+$/.test(remoteSha || "") ? [localSha, "--not", "--remotes"] : [`${remoteSha}..${localSha}`]);
  }
  return ranges;
}

export function run(mode, { stdin = "", cwd = ".", rangeArgs = [] } = {}) {
  if (mode === "--all") return checkTracked(cwd);
  if (mode === "--staged") return checkStaged(cwd);
  if (mode === "--history") return checkCommits("", cwd);
  if (mode === "--refs") return checkRefs(cwd);
  if (mode === "--range") return checkCommits(rangeArgs.length ? rangeArgs : "", cwd);
  if (mode === "--full") return [...checkTracked(cwd), ...checkRefs(cwd), ...checkCommits("", cwd)];
  if (mode === "--push")
    return pushRanges(stdin).flatMap((r) => {
      try {
        return checkCommits(r, cwd);
      } catch (e) {
        return [`could not inspect the commits being pushed (${e.message.split("\n")[0]}); the push is blocked rather than assumed safe`];
      }
    });
  throw new Error("Usage: privacy-guard.mjs --all | --staged | --push | --history | --refs | --range <revs> | --full");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Always work from the repository root, wherever the guard is called from (App/, a hook, CI).
  process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const mode = process.argv[2] || "--all";
  const stdin = mode === "--push" ? fs.readFileSync(0, "utf8") : "";
  const problems = [...new Set(run(mode, { stdin, rangeArgs: process.argv.slice(3) }))];
  if (problems.length) {
    console.error(
      "Privacy guard blocked this:\n- " + problems.join("\n- ") +
        "\n\nInternal research evidence belongs in Data/ (git-ignored) or private/, never in the public repository." +
        "\nSee AGENTS.md > Privacy rules, and docs/PRIVACY_SAFEGUARDS.md. Do not bypass this check.",
    );
    process.exit(1);
  }
  console.log(`Privacy guard passed (${mode}).`);
}

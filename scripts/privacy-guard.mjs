#!/usr/bin/env node
// Repository privacy guard. Keeps internal research evidence out of the public repository.
//
//   node scripts/privacy-guard.mjs --all        every tracked file (CI, manual audit)
//   node scripts/privacy-guard.mjs --staged     files staged for commit (pre-commit hook)
//   node scripts/privacy-guard.mjs --push       commits about to be pushed (pre-push hook; stdin as git sends it)
//   node scripts/privacy-guard.mjs --history    every commit reachable from any branch (manual audit)
//
// To protect a new kind of internal file, add a pattern to FORBIDDEN_PATHS (and the
// matching line to .gitignore). To publish a new kind of legitimate file that the guard
// wrongly blocks, add it to ALLOWED_PATHS with a comment saying why it is public.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { SECRET_PATTERNS } from "./public-assets.mjs";

/** Directories and files that must never be tracked, anywhere in the repository. */
export const FORBIDDEN_PATHS = [
  [/(^|\/)private\//i, "private/ is local-only storage"],
  [/(^|\/)Ethics Approval\//i, "ethics application documents are private"],
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/i, "environment file with secrets (only .env.example may be committed)"],
  [/\.(pem|key|p12|pfx|bundle|sqlite3?|db)$/i, "key, bundle or database file"],
  [/^Data files\/(_research_reviews|_archive|_exports|User updates)\//i, "internal research folder"],
  [/(^|\/)(New updates|scholar_output)\//i, "scraper working output"],
  [/^Data files\/(APPLICATION_HANDOFF|MISSING_INSTITUTIONS_RESEARCH|PROFILE_COMPLETION_REPORT)\b/i, "internal collection report"],
  // Internal evidence data: reviews, investigations, logs, unresolved searches, rejected matches.
  [
    /^Data files\/.*(review|evidence|verification|change_log|observation|unresolved|followup|follow_up|worklist|rejected|overlapping|search_log|search_attempts|checkpoint|handoff|candidates)[^/]*\.(csv|tsv|json|jsonl|md|txt|xlsx|ipynb)$/i,
    "internal verification, review, log or evidence file",
  ],
  [/^reports\/enriched-merge[^/]*\//i, "internal merge audit"],
  [/^research\/.*\/data\/snapshot\.csv$/i, "record-level research snapshot (pseudonymised, not anonymous)"],
];

/** Exceptions: files whose names look internal but are public by design. */
export const ALLOWED_PATHS = [
  // (none yet) Example: /^Data files\/international\/openalex_matches\.csv$/
];

const MAX_SCAN_BYTES = 2_500_000;
const TEXT_EXT = /\.(csv|tsv|json|jsonl|md|txt|mjs|js|ts|tsx|css|html|yml|yaml|py|sh|toml|ipynb)$/i;

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

/** Problems with the text of one file (credentials; sensitive public-record fields). */
export function checkContent(rel, text) {
  const problems = [];
  if (!TEXT_EXT.test(rel) || text.length > MAX_SCAN_BYTES) return problems;
  for (const [re, label] of SECRET_PATTERNS) {
    // Source data and tests legitimately contain tracking-style URL parameters (the importer strips them from published data).
    if (label === "credential-like URL parameter" && !/^public\//.test(rel)) continue;
    if (re.test(text)) problems.push(`${rel}: possible ${label}`);
  }
  if (/^public\/data\/academics\.csv$/.test(rel) || /^public\/data\/international\/academics\.csv$/.test(rel)) {
    const [headerLine] = text.replace(/^﻿/, "").split(/\r?\n/, 1);
    const header = headerLine.split(",");
    if (header.length > 60) problems.push(`${rel}: unexpectedly many columns`);
  }
  return problems;
}

/** Tracked files that .gitignore says must not be tracked. */
export function trackedButIgnored(cwd = ".") {
  return lines(git(["ls-files", "-ci", "--exclude-standard"], { cwd })).map(
    (p) => `${p}: tracked although .gitignore excludes it (git rm --cached)`,
  );
}

export function checkTracked(cwd = ".") {
  const paths = lines(git(["ls-files"], { cwd }));
  const problems = [...checkPaths(paths), ...trackedButIgnored(cwd)];
  for (const p of paths) {
    if (!TEXT_EXT.test(p)) continue;
    let text;
    try {
      text = fs.readFileSync(`${cwd}/${p}`, "utf8");
    } catch {
      continue;
    }
    problems.push(...checkContent(p, text));
  }
  return problems;
}

export function checkStaged(cwd = ".") {
  const added = lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd }));
  const problems = checkPaths(added);
  for (const p of added) {
    if (!TEXT_EXT.test(p)) continue;
    let text = "";
    try {
      text = git(["show", `:${p}`], { cwd });
    } catch {
      continue;
    }
    problems.push(...checkContent(p, text));
  }
  return problems;
}

/** Paths added by the commits in `range` (or all history when range is empty). */
export function checkCommits(range, cwd = ".") {
  const args = ["log", "--diff-filter=ACMR", "--name-only", "--pretty=format:", ...(range ? [range] : ["--branches"])];
  const paths = [...new Set(lines(git(args, { cwd })))];
  return checkPaths(paths).map((p) => p + " (in commit history)");
}

function pushRanges(stdin) {
  const ranges = [];
  for (const l of lines(stdin)) {
    const [, localSha, , remoteSha] = l.split(" ");
    if (/^0+$/.test(localSha)) continue; // deleting a branch
    ranges.push(/^0+$/.test(remoteSha) ? localSha : `${remoteSha}..${localSha}`);
  }
  return ranges;
}

export function run(mode, { stdin = "", cwd = "." } = {}) {
  if (mode === "--all") return checkTracked(cwd);
  if (mode === "--staged") return checkStaged(cwd);
  if (mode === "--history") return checkCommits("", cwd);
  if (mode === "--push") return pushRanges(stdin).flatMap((r) => { try { return checkCommits(r, cwd); } catch { return []; } });
  throw new Error("Usage: privacy-guard.mjs --all | --staged | --push | --history");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "--all";
  const stdin = mode === "--push" ? fs.readFileSync(0, "utf8") : "";
  const problems = [...new Set(run(mode, { stdin }))];
  if (problems.length) {
    console.error(
      "Privacy guard blocked this:\n- " + problems.join("\n- ") +
        "\n\nInternal research evidence belongs in Data files/ (git-ignored) or private/, never in the public repository." +
        "\nSee AGENTS.md > Privacy rules, and docs/PRIVACY_SAFEGUARDS.md. Do not bypass this check.",
    );
    process.exit(1);
  }
  console.log(`Privacy guard passed (${mode}).`);
}

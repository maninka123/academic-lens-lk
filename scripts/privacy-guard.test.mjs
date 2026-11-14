import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { checkPaths, checkContent, checkTracked, checkStaged, checkCommits, run } from "./privacy-guard.mjs";
import { sensitiveFieldProblems, PUBLIC_ACADEMIC_COLUMNS } from "./public-assets.mjs";
import { publicNote, publicFieldProblems } from "./public-notes.mjs";

const GUARD = path.resolve("scripts/privacy-guard.mjs");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
const repo = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-guard-"));
  git(d, "init", "-q", "-b", "main");
  git(d, "config", "user.email", "t@example.org");
  git(d, "config", "user.name", "Test");
  fs.writeFileSync(path.join(d, ".gitignore"), "private/\nData files/**/*evidence*.csv\n");
  return d;
};
const put = (d, rel, text = "x\n") => {
  fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
  fs.writeFileSync(path.join(d, rel), text);
};

test("internal evidence files are recognised by name and folder", () => {
  const bad = [
    "Data files/identity_review.csv",
    "Data files/employment_review.csv",
    "Data files/field_evidence.csv",
    "Data files/change_log.csv",
    "Data files/universities/uwu/rejected_profile_links.csv",
    "Data files/universities/uwu/COLLECTION_REVIEW.md",
    "Data files/research_unresolved.csv",
    "Data files/research_search_log.csv",
    "Data files/User updates/new.csv",
    "private/notes.txt",
    "Ethics Approval/form.pdf",
    ".env",
    "scripts/scholar_scraper/.env",
    "backup.bundle",
    "research/scoring-validation/data/snapshot.csv",
  ];
  const problems = checkPaths(bad);
  assert.equal(problems.length, bad.length, problems.join("\n"));
});

test("legitimate public data and code are not blocked", () => {
  const ok = [
    "Data files/universities/colombo/faculties/faculty-of-arts/departments/department-of-history/academics.csv",
    "Data files/qs_rankings_phd_institutions_2027.csv",
    "Data files/international/openalex_matches.csv",
    "public/data/academics.csv",
    "scripts/evidence.mjs",
    "scripts/privacy-guard.mjs",
    "src/pages/Academics.tsx",
    "docs/PRIVACY_SAFEGUARDS.md",
    ".env.example",
    "scripts/scholar_scraper/.env.example",
  ];
  assert.deepEqual(checkPaths(ok), []);
});

test("credentials are found in tracked text", () => {
  assert.match(checkContent("scripts/x.mjs", 'const t = "ghp_' + "a".repeat(36) + '"').join(), /GitHub token/);
  assert.match(checkContent("public/data/m.json", '{"u":"https://x.org/?api_key=abc"}').join(), /credential-like URL/);
  assert.deepEqual(checkContent("Data files/a.csv", "https://scholar.google.com/x?user=1&gmla=abc"), []);
});

test("a staged internal file is rejected and a public file is accepted", () => {
  const d = repo();
  put(d, "Data files/identity_review.csv", "academic_id,notes\n");
  git(d, "add", "-f", "Data files/identity_review.csv");
  assert.match(checkStaged(d).join(), /identity_review\.csv/);
  git(d, "rm", "-q", "--cached", "Data files/identity_review.csv");
  put(d, "src/app.ts", "export {}\n");
  git(d, "add", "src/app.ts");
  assert.deepEqual(checkStaged(d), []);
});

test("the pre-commit hook blocks a commit with an internal file and a secret", () => {
  const d = repo();
  fs.mkdirSync(path.join(d, ".githooks"));
  fs.writeFileSync(path.join(d, ".githooks/pre-commit"), `#!/bin/sh\nexec node "${GUARD}" --staged\n`, { mode: 0o755 });
  git(d, "config", "core.hooksPath", ".githooks");
  put(d, "Data files/change_log.csv", "timestamp\n");
  git(d, "add", "-f", "Data files/change_log.csv");
  const blocked = spawnSync("git", ["commit", "-m", "x"], { cwd: d, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Privacy guard blocked/);
  git(d, "rm", "-q", "--cached", "Data files/change_log.csv");
  put(d, "src/leak.ts", 'const k = "ghp_' + "b".repeat(36) + '";\n');
  git(d, "add", "src/leak.ts");
  const secret = spawnSync("git", ["commit", "-m", "x"], { cwd: d, encoding: "utf8" });
  assert.notEqual(secret.status, 0);
  assert.match(secret.stderr, /GitHub token/);
});

test("tracked files that .gitignore excludes are reported", () => {
  const d = repo();
  put(d, "Data files/a_evidence.csv", "a\n");
  git(d, "add", "-f", "Data files/a_evidence.csv");
  git(d, "commit", "-q", "--no-verify", "-m", "x");
  assert.match(checkTracked(d).join(), /a_evidence\.csv/);
});

test("the pre-push check finds an internal file inside the pushed commits and in history", () => {
  const d = repo();
  put(d, "README.md", "hi\n");
  git(d, "add", "."), git(d, "commit", "-q", "-m", "base");
  const base = git(d, "rev-parse", "HEAD").trim();
  put(d, "Data files/employment_review.csv", "a\n");
  git(d, "add", "-f", "."), git(d, "commit", "-q", "--no-verify", "-m", "leak");
  const head = git(d, "rev-parse", "HEAD").trim();
  assert.match(run("--push", { stdin: `refs/heads/main ${head} refs/heads/main ${base}\n`, cwd: d }).join(), /employment_review\.csv/);
  assert.match(checkCommits("", d).join(), /employment_review\.csv/);
  assert.deepEqual(run("--push", { stdin: `refs/heads/main ${base} refs/heads/main ${"0".repeat(40)}\n`, cwd: d }), []);
});

test("sensitive free text in published records is detected", () => {
  const head = PUBLIC_ACADEMIC_COLUMNS.join(",");
  const row = (notes) => PUBLIC_ACADEMIC_COLUMNS.map((c) => (c === "notes" ? `"${notes}"` : c === "id" ? "SL-1" : "")).join(",");
  for (const [notes, expect] of [
    ["Other listed profiles — LinkedIn: https://www.linkedin.com/in/someone/", /social or personal profile link/],
    ["Contact a.person@uni.ac.lk", /email address/],
    ["Call +94 71 234 5678", /phone number/],
    ["Listed as on study leave.", /internal wording/],
    ["Name discrepancy requires review.", /internal wording/],
  ])
    assert.match(sensitiveFieldProblems(head + "\n" + row(notes)).join(), expect, notes);
  assert.deepEqual(sensitiveFieldProblems(head + "\n" + row("Added from the official staff page (2026-10-18).")), []);
});

test("internal collection notes are reduced to provenance before publication", () => {
  assert.equal(
    publicNote("Listed on the official department staff page; research identities and employment require review. Listed as on study leave."),
    "Listed on the official department staff page.",
  );
  assert.equal(
    publicNote("Added from the official staff page (2026-10-18). Other listed profiles — LinkedIn: https://www.linkedin.com/in/x/; ORCID: https://orcid.org/0000-0001-0000-0000"),
    "Added from the official staff page (2026-10-18). Other listed profiles — ORCID: https://orcid.org/0000-0001-0000-0000",
  );
  assert.equal(publicNote("Directory links a profile with conflicting degree institution; individual identity link requires review."), "");
  assert.deepEqual(publicFieldProblems(publicNote("Added from the official staff page (2026-10-18). Other listed profiles — Facebook: https://facebook.com/x/")), []);
});

test("this repository passes its own whole-tree check", { skip: !fs.existsSync(".git") }, () => {
  assert.deepEqual(checkTracked("."), []);
});

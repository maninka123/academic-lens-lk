import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { checkTracked, checkRefs, checkCommits, checkContent, run } from "./privacy-guard.mjs";
import { sensitiveFieldProblems } from "./public-assets.mjs";
import {
  stripContactDetails, stripLeaveRemark, publicEvidenceNote, publicLinkStatus, publicOpenAlexStatus, publicRecordStatus, publicMethod, publicNote,
} from "./public-notes.mjs";
import { publicMatch, publicResearch } from "./research-data.mjs";
import { loadRemovals, isRemoved, normaliseName } from "./removals-lib.mjs";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
const repo = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-hard-"));
  git(d, "init", "-q", "-b", "main");
  git(d, "config", "user.email", "t@example.org");
  git(d, "config", "user.name", "Test");
  return d;
};
const put = (d, rel, text = "x\n") => {
  fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
  fs.writeFileSync(path.join(d, rel), text);
};
const commit = (d, msg = "c") => {
  git(d, "add", "-A");
  git(d, "commit", "-q", "-m", msg);
};

test("contact details and website footers are removed from free text, other text is untouched", () => {
  assert.equal(stripContactDetails("Psychiatry. Email : a.b@med.ruh.ac.lk Intercom Extension: 375/377"), "Psychiatry.");
  assert.equal(stripContactDetails("BSc (Rajarata) Mail: someone@yahoo.com"), "BSc (Rajarata)");
  assert.equal(stripContactDetails("Sensors; Contact; x@sliit.lk; Connect with us to explore new possibilities for your future.; Apply Now"), "Sensors");
  const plain = "Mobile computing; Telecommunications  and  Phone-based surveys";
  assert.equal(stripContactDetails(plain), plain);
});

test("remarks about leave are dropped from names and positions", () => {
  assert.equal(stripLeaveRemark("Lecturer (On study leave)"), "Lecturer");
  assert.equal(stripLeaveRemark("Dr. A. B. Perera (on Sabbatical Leave)"), "Dr. A. B. Perera");
  assert.equal(stripLeaveRemark("Senior Lecturer Grade I"), "Senior Lecturer Grade I");
});

test("published evidence notes and statuses use neutral wording", () => {
  assert.doesNotMatch(publicEvidenceNote("Public profile metric table User-provided snapshot; not independently re-fetched in this merge."), /user|merge/i);
  assert.equal(publicLinkStatus("rejected_different_person"), "not_recorded");
  assert.equal(publicLinkStatus("directory_link_not_person_scoped_requires_review"), "directory_link_pending_review");
  assert.equal(publicOpenAlexStatus("openalex_multiple_candidates_requires_review"), "openalex_multiple_candidates_pending_review");
  assert.equal(publicOpenAlexStatus("openalex_matched_confirmed"), "openalex_matched_confirmed");
  assert.equal(publicRecordStatus("legacy_directory_current_membership_requires_review"), "legacy_directory_current_membership_pending_review");
  assert.equal(publicMethod("manual_curator_decision"), "manual_review");
  assert.equal(publicMethod("preserved_legacy_identity_conflict_requires_review"), "recorded_unverified");
  assert.doesNotMatch(publicNote("Listed in the user-supplied department directory snapshot; retrieved 2026-10-18."), /user/i);
});

test("a profile rejected as a different person is never published; a conflicted match is not published as an identity", () => {
  const url = "https://scholar.google.com/citations?user=ABCDEFGHIJKL";
  const row = { academic_id: "SL-aaaaaaaaaaaa", google_scholar_url: url, researchgate_url: "" };
  const inputs = {
    byId: new Map(),
    observations: [{ academic_id: row.academic_id, platform: "Google Scholar", source_url: url, metric: "total_citations", value: "55", retrieved_at: "2026-10-18" }],
    snapshots: [],
    identities: [{ academic_id: row.academic_id, profile_url: url, identity_verification_status: "rejected_different_person", checked_at: "2026-10-18" }],
  };
  const out = publicResearch(row, null, inputs, {}, []);
  assert.deepEqual(JSON.parse(out.researchIdentities), []);
  assert.deepEqual(JSON.parse(out.researchObservations), []);
  const conflicted = {
    byId: new Map([[row.academic_id, { academic_id: row.academic_id, match_status: "corroborated", publication_status: "approved", match_method: "preserved_legacy_identity_conflict_requires_review", candidate_author_id: "https://openalex.org/A1", matched_at: "2026-10-13" }]]),
  };
  const m = publicMatch(row, null, conflicted);
  assert.equal(m.approved, false);
  assert.equal(m.url, "");
});

test("guard scans large files in full instead of skipping them", () => {
  const d = repo();
  const token = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8";
  put(d, "data/big.csv", "id,v\n" + "1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n".repeat(80000) + token + "\n");
  assert.ok(fs.statSync(path.join(d, "data/big.csv")).size > 2_500_000);
  commit(d);
  assert.match(checkTracked(d).join("\n"), /GitHub token/);
});

test("guard blocks contact details in tracked source CSVs and removed people reappearing", () => {
  const rel = "Data/universities/x/faculties/f/departments/d/academics.csv";
  assert.match(checkContent(rel, "academic_id,full_name,academic_position,qualifications,research_interests\nSL-aaaaaaaaaaaa,A B,Lecturer,BSc Email: a@b.lk,\n").join("\n"), /email/);
  assert.match(checkContent(rel, "academic_id,full_name,academic_position,qualifications,research_interests\nSL-aaaaaaaaaaaa,A B,Lecturer (On study leave),BSc,\n").join("\n"), /leave/);
  const removed = new Set(["SL-aaaaaaaaaaaa"]);
  assert.match(checkContent("public/data/academics.csv", "id,name\nSL-aaaaaaaaaaaa,A B\n", { removedIds: removed }).join("\n"), /removal request/);
  assert.match(sensitiveFieldProblems("id,scholarStatus\nSL-1,rejected_different_person\n").join("\n"), /internal workflow/);
});

test("history check reads added lines and commit messages, and never fails open", () => {
  const d = repo();
  put(d, "a.txt", "ok\n");
  commit(d, "first");
  put(d, "b.txt", "key = ghp_" + "Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo\n");
  commit(d, "add config");
  fs.rmSync(path.join(d, "b.txt"));
  commit(d, "remove config");
  assert.match(checkCommits("", d).join("\n"), /GitHub token added in commit/);
  assert.throws(() => checkCommits(["deadbeef..cafebabe"], d));
  const head = git(d, "rev-parse", "HEAD").trim();
  const out = run("--push", { stdin: `refs/heads/main ${head} refs/heads/main ${"1".repeat(40)}\n`, cwd: d });
  assert.match(out.join("\n"), /could not inspect|GitHub token/);
});

test("a new branch push is checked against what the remotes already have", () => {
  const d = repo();
  put(d, "a.txt", "ok\n");
  commit(d, "first");
  git(d, "checkout", "-q", "-b", "feature");
  put(d, "Data/identity_review.csv", "x\n");
  commit(d, "oops");
  const sha = git(d, "rev-parse", "HEAD").trim();
  const out = run("--push", { stdin: `refs/heads/feature ${sha} refs/heads/feature ${"0".repeat(40)}\n`, cwd: d });
  assert.match(out.join("\n"), /identity_review\.csv/);
});

test("branch audit checks every branch, not only the one checked out", () => {
  const d = repo();
  put(d, "a.txt", "ok\n");
  commit(d, "first");
  git(d, "checkout", "-q", "-b", "old");
  put(d, "private/notes.txt", "x\n");
  commit(d, "oops");
  git(d, "checkout", "-q", "main");
  assert.deepEqual(checkTracked(d), []);
  assert.match(checkRefs(d).join("\n"), /private\/notes\.txt.*on old/);
});

test("accepted removals match by ID or by normalised name and university", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-rem-"));
  fs.writeFileSync(path.join(d, "removal_requests.csv"), "academic_id,full_name,university,requested_at,applied_at,reason,reference\nSL-111111111111,Prof. A.B. Perera,University of X,2026-11-01,2026-11-02,request,ref\n");
  const r = loadRemovals(d);
  assert.ok(isRemoved({ academic_id: "SL-111111111111" }, r));
  assert.ok(isRemoved({ academic_id: "SL-999999999999", full_name: "Dr. a b perera", university: "University of X" }, r));
  assert.ok(!isRemoved({ academic_id: "SL-999999999999", full_name: "A.B. Perera", university: "University of Y" }, r));
  assert.equal(normaliseName("Prof. A.B. Perera"), normaliseName("a b perera"));
});

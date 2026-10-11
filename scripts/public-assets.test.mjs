import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkPublicData, PUBLIC_ACADEMIC_COLUMNS } from "./public-assets.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "atlas-public-"));
const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

test("allowlisted public data passes", () => {
  const d = tmp();
  write(d, "academics.csv", PUBLIC_ACADEMIC_COLUMNS.join(",") + "\n");
  write(d, "metadata.json", "{}");
  assert.deepEqual(checkPublicData(d), []);
});
test("internal files and columns are rejected", () => {
  const d = tmp();
  write(d, "identity_review.csv", "academic_id,notes\n");
  write(d, "coverage_summary.csv", "university,unfinished_tasks\n");
  write(d, "academics.csv", "id,name,internal_note\n");
  const problems = checkPublicData(d).join("\n");
  assert.match(problems, /identity_review\.csv: not on the public allowlist/);
  assert.match(problems, /internal evidence columns published \(unfinished_tasks\)/);
  assert.match(problems, /columns outside the public schema \(internal_note\)/);
});
test("credentials are detected in data and bundles", () => {
  const d = tmp();
  write(d, "metadata.json", '{"url":"https://x.org/a?api_key=SECRET"}');
  write(d, "../assets/app.js", 'const t="ghp_' + "a".repeat(36) + '"');
  const problems = checkPublicData(d, { scanOnly: [path.join(d, "../assets")] }).join("\n");
  assert.match(problems, /credential-like URL parameter/);
  assert.match(problems, /GitHub token/);
});
test("the generated public/data passes the allowlist", { skip: !fs.existsSync("public/data/academics.csv") }, () => {
  assert.deepEqual(checkPublicData("public/data"), []);
});

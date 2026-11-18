/* Removes rules from src/styles/legacy.css whose class selectors never appear in the source.
   A class counts as used when it appears as a whole word anywhere in every .ts or .tsx file under src (outside tests), or shares a prefix with a
   string that ends in "-" (dynamic class names such as "cols-" + n). Run after pruning by name. */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk("src").filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
const words = new Set(), prefixes = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)) { words.add(m[0]); if (m[0].endsWith("-")) prefixes.add(m[0]); }
  for (const m of src.matchAll(/["'`]([a-z][a-z0-9-]*-)["'`$]/g)) prefixes.add(m[1]);
}
const used = (c) => words.has(c) || [...prefixes].some((p) => c.startsWith(p));
const file = "src/styles/legacy.css";
const root = postcss.parse(fs.readFileSync(file, "utf8"));
let removed = 0; const gone = new Set();
root.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
  const keep = rule.selectors.filter((s) => {
    const classes = [...s.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
    const bad = classes.find((c) => !used(c));
    if (bad) gone.add(bad);
    return !bad;
  });
  if (keep.length === rule.selectors.length) return;
  removed++;
  if (!keep.length) rule.remove(); else rule.selectors = keep;
});
root.walkAtRules((at) => { if (at.nodes && at.nodes.length === 0 && !/layer/.test(at.name)) at.remove(); });
fs.writeFileSync(file, root.toString());
console.log(`removed ${removed} selector groups for ${gone.size} unused classes; legacy.css now ${root.toString().split("\n").length} lines`);
console.log([...gone].slice(0, 60).join(" "));

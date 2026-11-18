/* Removes rules from src/styles/legacy.css whose selectors mention any of the given class names, ids or element selectors.
   Usage: node scripts/prune-legacy-css.mjs .brand .sidebar ...   (a pattern matches a whole token: ".card" does not match ".card-grid"; "=h1" matches only the bare selector h1)
   Declarations are never edited: a rule is removed whole, or kept whole. Empty at-rules are dropped. */
import fs from "node:fs";
import postcss from "postcss";
const file = "src/styles/legacy.css";
const patterns = process.argv.slice(2);
if (!patterns.length) { console.error("give selectors"); process.exit(1); }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const res = patterns.map((p) => p.startsWith("=") ? { test: (s) => s.trim() === p.slice(1) } : new RegExp("(^|[^\\w-])" + esc(p) + "(?![\\w-])"));
const src = fs.readFileSync(file, "utf8");
const root = postcss.parse(src);
let removed = 0;
root.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
  const sels = rule.selectors;
  const keep = sels.filter((s) => !res.some((r) => r.test(s)));
  if (keep.length === sels.length) return;
  removed++;
  if (keep.length === 0) rule.remove(); else rule.selectors = keep;
});
root.walkAtRules((at) => { if (at.nodes && at.nodes.length === 0 && !/layer/.test(at.name)) at.remove(); });
fs.writeFileSync(file, root.toString());
const lines = root.toString().split("\n").length;
console.log(`removed ${removed} selector groups; legacy.css now ${lines} lines`);

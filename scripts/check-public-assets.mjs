// Fails when files or columns outside the public allowlist, internal evidence
// headers or credential-like strings are present in published output.
// Usage: node scripts/check-public-assets.mjs            (checks public/data)
//        node scripts/check-public-assets.mjs dist       (checks dist/data + bundle)
import path from "node:path";
import { checkPublicData } from "./public-assets.mjs";

const root = process.argv[2] || "public";
const problems = checkPublicData(path.join(root, "data"), {
  scanOnly:
    root === "public"
      ? []
      : [path.join(root, "assets"), path.join(root, "index.html")],
});
if (problems.length) {
  console.error("Public asset check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Public asset check passed for ${root}/data.`);

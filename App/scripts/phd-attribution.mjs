// Checks that a recorded PhD institution/country is supported by the doctoral entry in the qualification text.
//
// A doctorate's institution must come from the doctoral entry itself. It must never be taken from an adjacent degree
// ("PhD, MA (Nagoya); BA (Peradeniya)": Nagoya and Peradeniya belong to the MA and BA) and must not be assumed to be the
// employing university when the doctorate is bare ("PhD") or joint ("PhD (USJ-Uppsala)", "Split PhD ...").
//
// Statuses returned by phdAttribution(row):
//   unverifiable        no doctoral entry in the text (the value may come from another source): nothing is withheld
//   supported           the doctoral entry names the recorded institution or country
//   adjacent            the doctoral entry names a different place and the recorded institution matches another degree: withheld
//   bare_inferred       the doctoral entry names no place, yet an institution is recorded: withheld
//   joint               the entry is joint, split, sandwich, collaborative or lists two institutions: withheld, origin unresolved
//   unsupported         a place is named but does not match the recorded institution or country: withheld
// "Withheld" means the importer does not publish the institution or country for that record; the source CSV is not changed.

const PHD = /\b(?:Ph\.?\s?D\.?|D\.?\s?Phil\.?|Doctor(?:ate)? of Philosophy)\b/i;
const OTHER_DEGREE = /\b(?:M\.?\s?A\.?|M\.?\s?Sc\.?|B\.?\s?Sc\.?|B\.?\s?A\.?|MPhil|M\.\s?Phil|MBA|MS|MEng|M\.Eng|Bachelor|Master|Diploma|PGD|Postgraduate|Certificate|LLB|LLM|BAMS|MBBS|MD|B\.?Eng|B\.?Com|BBA|BVSc|MVM|MPH|Hons?)\b/;
const JOINT_WORDS = /\b(?:joint|split|sandwich|collaborative|twinning|dual|co-?tutelle)\b/i;
const PAIR = /\(\s*([A-Za-z.]{2,12})\s*[-\/–]\s*([A-Za-z.]{2,15})\s*[,)]/;
const PLACE = /(Univ|Institut|College|School of|Academy|Polytechnic|\(\s*[A-Za-z][A-Za-z.&' ,\-]{1,60}\))/i;
const COUNTRY_CODES = new Set(["lk", "sl", "jp", "jpn", "uk", "usa", "us", "aus", "au", "nz", "hk", "irl", "sg", "my", "cn", "in", "de", "fr", "nl", "se", "no", "dk", "fi", "it", "ca"]);
const COUNTRIES = ["Czech Republic", "Czechia", "Brunei", "Ireland", "Sri Lanka", "SL", "Japan", "UK", "U.K", "United Kingdom", "England", "Scotland", "USA", "U.S.A", "United States", "Australia", "New Zealand", "Canada", "India", "China", "P.R.C", "Malaysia", "Singapore", "Sweden", "Norway", "Germany", "France", "Netherlands", "Thailand", "Korea", "Hong Kong", "HongKong", "Italy", "Denmark", "Finland", "Belgium", "Austria", "Switzerland", "Russia", "Ireland", "Hungary", "Taiwan", "Vietnam", "Pakistan", "Bangladesh"];
const COUNTRY_ALIAS = { UK: "United Kingdom", "U.K": "United Kingdom", England: "United Kingdom", Scotland: "United Kingdom", USA: "United States", "U.S.A": "United States", SL: "Sri Lanka", "P.R.C": "China", HongKong: "Hong Kong", Korea: "South Korea" };
// Short forms used in Sri Lankan staff listings for the national universities.
const SL_FORMS = {
  colombo: ["colombo", "cmb", "uoc", "col", "univ of colombo", "uc"], peradeniya: ["peradeniya", "perad", "pdn", "updn", "uop", "pera", "p'niya", "pgis", "pgia", "pgiar", "pdn"],
  kelaniya: ["kelaniya", "kln", "kel", "uok", "kalaniya"], jayewardenepura: ["jayewardenepura", "jayawardenepura", "sjp", "usj", "usjp", "j'pura", "jpura", "jaya", "pim"],
  moratuwa: ["moratuwa", "mora", "uom", "mrt"], jaffna: ["jaffna", "jfn", "uoj"], ruhuna: ["ruhuna", "ruh", "uor"], kdu: ["kotelawala", "kdu"],
  sliit: ["sliit"], nsbm: ["nsbm"], uwu: ["uva wellassa", "uwu"], sabaragamuwa: ["sabaragamuwa", "sab", "susl"], wayamba: ["wayamba", "wusl"], rajarata: ["rajarata", "rusl", "rjt"],
  eastern: ["eastern", "eusl"], seusl: ["south eastern", "seusl"], ousl: ["open university", "ousl"], uvpa: ["visual and performing", "uvpa", "vpa", "vapa"],
};

/** True when a "(A-B)" or "(A/B)" pair combines a Sri Lankan university with a foreign institution (not a country, code or part of the same university). */
function jointPair(text) {
  const m = PAIR.exec(text); if (!m) return false;
  const [a, b] = [m[1].toLowerCase().replace(/\./g, ""), m[2].toLowerCase().replace(/\./g, "")];
  const slForms = Object.values(SL_FORMS).flat().map((f) => f.replace(/[.']/g, ""));
  const isSl = (t) => slForms.includes(t) || /^pgi[a-z]*$/.test(t) || t === "pim";
  const isCountry = (t) => COUNTRY_CODES.has(t) || COUNTRIES.some((c) => c.toLowerCase().replace(/[. ]/g, "") === t) || Object.keys(PLACE_COUNTRY).includes(t);
  if (isCountry(a) || isCountry(b)) return false;
  return (isSl(a) && !isSl(b)) || (isSl(b) && !isSl(a));
}

const words = (s) => (String(s).toLowerCase().match(/[a-z']{3,}/g) || []).filter((w) => !["university", "institute", "college", "the", "and", "technology", "sri", "lanka", "school", "national"].includes(w));

/** Doctoral entries of a qualification text: { text, segment, ongoing, kind } with kind named | bare | joint. */
export function doctoralEntries(qualifications = "") {
  const out = [];
  for (const entry of String(qualifications).split(/[;\n]/)) {
    const e = entry.trim();
    if (!e || !PHD.test(e)) continue;
    for (const m of e.matchAll(new RegExp(PHD.source, "gi"))) {
      const after = e.slice(m.index + m[0].length);
      const next = after.search(OTHER_DEGREE);
      const segment = (next >= 0 ? after.slice(0, next) : after).slice(0, 170);
      const before = e.slice(Math.max(0, m.index - 30), m.index);
      const ongoing = /reading|pursuing|registered|ongoing|candidate|\(R\)/i.test(e);
      const joint = JOINT_WORDS.test(before + m[0] + segment) || jointPair(m[0] + segment);
      const named = PLACE.test(segment) || COUNTRIES.some((c) => new RegExp("(?<![A-Za-z])" + c.replace(/\./g, "\\.") + "(?![A-Za-z])").test(segment));
      out.push({ text: e, segment: segment.trim(), ongoing, kind: joint ? "joint" : named ? "named" : "bare" });
    }
  }
  return out;
}

function countriesIn(s) {
  const found = new Set();
  for (const c of COUNTRIES) if (new RegExp("(?<![A-Za-z])" + c.replace(/\./g, "\\.") + "(?![A-Za-z])").test(s)) found.add(COUNTRY_ALIAS[c] || c);
  return found;
}

// Cities and regions that stand for a country in short qualification entries.
const PLACE_COUNTRY = { kolkata: "India", calcutta: "India", banaras: "India", benares: "India", benaris: "India", dublin: "Ireland", osaka: "Japan", oxon: "United Kingdom", edin: "United Kingdom", aus: "Australia", hk: "Hong Kong", jp: "Japan", jpn: "Japan", irl: "Ireland", muni: "Czech Republic", brunei: "Brunei",  moscow: "Russia", rome: "Italy", wales: "United Kingdom", puducherry: "India", pondicherry: "India", barcelona: "Spain", louisiana: "United States", tokyo: "Japan", london: "United Kingdom", sydney: "Australia", melbourne: "Australia", brisbane: "Australia", perth: "Australia", auckland: "New Zealand", delhi: "India", kerala: "India", madras: "India", chennai: "India" };
const STOP = new Set(["of", "the", "and", "de", "for", "in", "at", "universitat", "universiteit"]);
/** True when a parenthesised short form in the segment is an acronym or abbreviated prefix of the recorded institution. */
function abbreviationMatches(segment, university) {
  const toks = (String(segment).match(/[A-Za-z][A-Za-z.]{1,8}/g) || []).map((t) => t.replace(/\./g, "").toLowerCase());
  const ws = String(university).toLowerCase().match(/[a-z']+/g) || [];
  if (!ws.length) return false;
  const acro1 = ws.map((w) => w[0]).join(""), acro2 = ws.filter((w) => !STOP.has(w)).map((w) => w[0]).join("");
  return toks.some((t) => t.length >= 3 && (t === acro1 || (t[0] === "u" && ws.some((w) => w.length > 3 && w.startsWith(t.slice(1)))) || t === acro2 || ws.some((w) => w.length > t.length && w.startsWith(t)) || ws.filter((w) => !STOP.has(w)).map((w) => w[0]).join("").includes(t)));
}

function matchesRecorded(segment, university, country, employerId) {
  const seg = segment.toLowerCase();
  if (university && abbreviationMatches(segment, university)) return true;
  const uw = words(university);
  if (uw.length && uw.every((w) => seg.includes(w))) return true;
  if (uw.length && uw.some((w) => w.length >= 4 && seg.includes(w))) return true;
  for (const [id, forms] of Object.entries(SL_FORMS)) {
    if (words(university).some((w) => forms.includes(w)) || (university && forms.some((f) => f.length >= 6 && university.toLowerCase().includes(f)))) {
      if (forms.some((f) => new RegExp("(?<![a-z])" + f.replace(/[.']/g, "\\$&") + "(?![a-z])").test(seg))) return true;
    }
  }
  const cs = countriesIn(segment);
  for (const [place, c] of Object.entries(PLACE_COUNTRY)) if (new RegExp("(?<![a-z])" + place + "(?![a-z])", "i").test(segment)) cs.add(c);
  return Boolean(country && cs.has(country));
}

/** Check a source row (phd_university, phd_country, qualifications, university). */
export function phdAttribution(row) {
  const university = (row.phd_university || "").trim(), country = (row.phd_country || "").trim();
  const entries = doctoralEntries(row.qualifications).filter((e) => !e.ongoing);
  if (!entries.length || (!university && !country)) return { status: "unverifiable", entry: "" };
  // A value set from a verified official source (a person's own profile, CV or repository record) is trusted over listing text.
  if (/Verified (official_|thesis_|graduation_)/i.test(row.qualification_evidence || "") && (row.phd_country_basis || "")) return { status: "supported", entry: "verified official source" };
  if (entries.some((e) => e.kind === "joint")) return { status: "joint", entry: entries.find((e) => e.kind === "joint").text };
  const named = entries.filter((e) => e.kind === "named");
  if (!named.length) return { status: "bare_inferred", entry: entries[0].text };
  if (named.some((e) => matchesRecorded(e.segment, university, country))) return { status: "supported", entry: named[0].text };
  // The recorded institution matches some other degree in the text: it was taken from an adjacent qualification.
  const others = String(row.qualifications).split(/[;\n]/).filter((e) => !PHD.test(e) || OTHER_DEGREE.test(e.replace(/^[^,(]*/, "")));
  const adjacent = others.some((e) => matchesRecorded(e, university, ""));
  return { status: adjacent ? "adjacent" : "unsupported", entry: named[0].text };
}

/** Statuses for which the institution and country are not published. */
export const WITHHELD = new Set(["adjacent", "bare_inferred", "joint", "unsupported"]);

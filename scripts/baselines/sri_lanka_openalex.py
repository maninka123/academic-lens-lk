"""OpenAlex metrics for Sri Lankan academics, for like-for-like comparison with
the international baselines. Writes Data files/international/sri_lanka_openalex_metrics.csv.
The authoritative Sri Lankan academic CSVs are NOT modified.

Sri Lankan directory names are often initials + surname ("H.L. De Silva"). A
candidate must share the full surname and agree with every published initial;
ambiguous matches are left blank, as in the baseline build.
"""
import csv, glob, re, sys, shutil
from collections import defaultdict
from pathlib import Path

import openalex as oa
from build_international import metrics

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Data files"
TITLES = r"^(prof(essor)?|dr|mr|mrs|ms|miss|eng|rev|ven|snr|senior|emeritus|ch\.?eng|capt|cdr|lt|col|brig)\.?\s+"
SL_INST = {
    "colombo": ["I90678064", "I4405259008"], "peradeniya": ["I111199411"], "jayewardenepura": ["I172828483"],
    "kelaniya": ["I142651801"], "moratuwa": ["I195740183"], "jaffna": ["I198412587"], "ruhuna": ["I128559575"],
    "kdu": ["I197250369"], "sliit": ["I192365124"], "nsbm": ["I4405256374"], "cinec": ["I4400064418"],
    "kiu": ["I4405268052"],
}


def parse_name(full):
    s = full.strip()
    while re.match(TITLES, s, re.I):
        s = re.sub(TITLES, "", s, flags=re.I)
    s = re.sub(r"\(.*?\)", " ", s)
    parts = re.split(r"[\s.]+", s.replace(",", " "))
    parts = [p for p in parts if p]
    if len(parts) < 2:
        return None
    # Surname = trailing full words (handles "De Silva", "Wijesinghe"); given = the rest.
    sur = [parts[-1]]
    i = len(parts) - 2
    while i >= 0 and parts[i].lower() in ("de", "da", "di", "van", "von", "la", "le"):
        sur.insert(0, parts[i]); i -= 1
    given = parts[: i + 1]
    initials = []
    for g in given:
        if len(g) <= 3 and g.isupper():
            initials += list(g.lower())  # "HL" or "H"
        else:
            initials.append(g.lower())   # full given name
    return {"surname": oa.norm(" ".join(sur)), "given": initials, "query": oa.norm(" ".join(sur))}


def compatible(person, display):
    t = oa.norm(display).split()
    st = person["surname"].split()
    if len(t) <= len(st) or t[-len(st):] != st:
        return False
    cand = t[: -len(st)]
    for i, g in enumerate(person["given"]):
        if i >= len(cand):
            break  # candidate omits a later initial: still compatible
        c = cand[i]
        if len(g) == 1 or len(c) == 1:
            if g[0] != c[0]:
                return False
        elif g != c:
            return False
    return True


def main():
    unis = {r["name"]: r["id"] for r in csv.DictReader(open(DATA / "universities.csv", encoding="utf-8-sig"))}
    people = []
    for f in glob.glob(str(DATA / "universities/**/academics.csv"), recursive=True):
        for r in csv.DictReader(open(f, encoding="utf-8-sig")):
            uid = unis.get(r["university"]) or unis.get(r["university"].replace(" (SLIIT)", ""))
            p = parse_name(r["full_name"])
            if uid in SL_INST and p:
                people.append((uid, r, p))
    by_uni = defaultdict(list)
    for uid, r, p in people:
        by_uni[uid].append((r, p))

    path = DATA / "international" / "sri_lanka_openalex_metrics.csv"
    existing = list(csv.DictReader(path.open(encoding="utf-8-sig"))) if path.exists() else []
    out = {r["academic_id"]: r for r in existing}
    cache_only = "--cache-only" in sys.argv
    if path.exists():
        archive = DATA / "_archive" / "openalex-before-resume-2026-10-12.csv"
        archive.parent.mkdir(parents=True, exist_ok=True)
        if not archive.exists(): shutil.copy2(path, archive)
    original_get = oa._get
    if cache_only:
        import hashlib, json
        def cached_get(endpoint, params):
            key = hashlib.sha1((endpoint + json.dumps(params, sort_keys=True)).encode()).hexdigest()
            f = oa.CACHE / f"{key}.json"
            if not f.exists(): raise oa.BudgetExhausted("Uncached request; offline mode")
            return json.loads(f.read_text())
        oa._get = cached_get

    def checkpoint():
        if not out: return
        with path.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(next(iter(out.values())).keys()))
            w.writeheader(); w.writerows(out.values())

    for uid, items in by_uni.items():
        surnames = sorted({p["query"] for _, p in items})
        cands = []
        completed_queries = set()
        for i in range(0, len(surnames), 25):
            batch = surnames[i:i + 25]
            try:
                cands += oa.authors(SL_INST[uid], batch)
                completed_queries.update(batch)
            except oa.BudgetExhausted:
                if cache_only: continue
                print("OpenAlex budget exhausted at", uid, "- completed work is preserved. Rerun later.")
                break
        for r, p in items:
            if p["query"] not in completed_queries or r["academic_id"] in out:
                continue
            hits = [a for a in cands if any(compatible(p, n) for n in [a["display_name"]] + (a.get("display_name_alternatives") or []))]
            hits = list({a["id"]: a for a in hits}.values())
            hits.sort(key=lambda a: a["works_count"], reverse=True)
            status, a = "openalex_no_name_match_at_institution", None
            if hits:
                top = hits[0]
                sec = hits[1]["works_count"] if len(hits) > 1 else 0
                if len(hits) > 1:
                    status = "openalex_multiple_candidates_requires_review"
                elif top["works_count"] > 1500:
                    status = "openalex_implausible_merged_profile_requires_review"
                else:
                    status, a = "openalex_matched_surname_initials_and_institution", top
            row = {"academic_id": r["academic_id"], "university_id": uid, "full_name": r["full_name"],
                   "openalex_id": a["id"] if a else "", "openalex_display_name": a["display_name"] if a else "",
                   "status": status, "candidates": len(hits)}
            row.update({k: (v if a else "") for k, v in (metrics(a) if a else {
                "total_publications": "", "total_citations": "", "h_index": "", "citations_2021_2025": ""}).items()})
            out[row["academic_id"]] = row
        checkpoint()
        print(f"{uid:<16} {len(completed_queries)} surnames covered; "
              f"{sum(1 for o in out.values() if o['university_id'] == uid and o['openalex_id'])} matched")
    checkpoint()
    print("wrote", path, len(out), "rows; prior matches preserved")


if __name__ == "__main__":
    main()

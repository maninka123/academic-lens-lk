"""Verified OpenAlex coverage for the Global Benchmarks fields, per university (aggregate counts only).

    python scripts/research/coverage_report.py [lookup.csv]

Uses the published records and the OpenAlex lookup file (default: public/data/international/sri_lanka_openalex.csv,
columns id,status,hIndex,...) with the app's rules: a like-for-like value needs a matched status and a recorded h-index.
A university-by-field group reports a median only with at least MIN valid profiles.
"""
import csv, re, sys, collections
MIN = 10


def field(a):
    unit = f"{a['department']} {a['faculty']}"
    if re.search(r"allied health|nursing|health sciences|dental|indigenous|siddha|ayurved", a["faculty"], re.I):
        return ""
    if re.search(r"english|language|linguist|services? cent(re|er)|centre for information technology|computer unit", a["department"], re.I):
        return ""
    if re.search(r"faculty of medicine|medical sciences", a["faculty"], re.I):
        return "Medicine"
    if re.search("physics", a["department"], re.I):
        return "Physics"
    if re.search(r"comput|information technology|software|data science|\bIT\b|informatics", unit, re.I):
        return "Computer Science"
    if re.search(r"medicine|medical|clinical|surgery|paediatric|pediatric|pathology|anatomy|physiology|pharmacology|public health", unit, re.I):
        return "Medicine"
    if re.search(r"engineering", unit, re.I):
        return "Engineering"
    return ""


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "App/public/data/international/sri_lanka_openalex.csv"
    academics = list(csv.DictReader(open("App/public/data/academics.csv", encoding="utf-8-sig")))
    look = {r["id"]: r for r in csv.DictReader(open(path, encoding="utf-8-sig"))}
    ok = lambda s: bool(re.search(r"(^|_)matched(_|$)", s or "")) and not re.search(r"(^|_)(not|no|un)_?matched", s or "")
    t = collections.defaultdict(lambda: [0, 0])
    for a in academics:
        f = field(a)
        if not f:
            continue
        l = look.get(a["id"])
        t[(f, a["universityId"])][0] += 1
        if l and ok(l.get("status")) and l.get("hIndex") not in ("", None):
            t[(f, a["universityId"])][1] += 1
    print("field | university | profiles | valid matched h-index | reports a median (>=%d)" % MIN)
    reporting = collections.Counter()
    for (f, u), (n, v) in sorted(t.items()):
        print(f"{f} | {u} | {n} | {v} | {'yes' if v >= MIN else 'no'}")
        reporting[f] += v >= MIN
    print("universities reporting a median:", dict(reporting))
    print("valid matched profiles:", {f: sum(v for (ff, _), (_, v) in t.items() if ff == f) for f in {k[0] for k in t}})


if __name__ == "__main__":
    main()

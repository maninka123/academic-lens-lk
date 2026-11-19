#!/usr/bin/env python3
"""Build authoritative dataset rows for newly collected universities from the raw entries made by collect_staff.py.

Reads private/collect/<id>_entries.csv (git-ignored). Writes the standard layout under Data/Lanka-Academia/:
  universities/<id>/faculties/<faculty>/[departments/<department>/]academics.csv   (32 columns, BOM, LF)
  universities/<id>/faculties.csv, institution_details.csv, universities.csv rows
Rules (existing data standards):
  - academic_id is SL- + 12 hex of sha256(university | normalised name), checked against every existing ID; stable on re-runs.
  - Current-listing rows get employment_status not_explicitly_verified, record_status listed_academic_employment_unverified,
    research_lookup_status not_yet_searched. Emeritus posts get emeritus_officially_listed. Temporary, visiting, honorary and
    ancillary posts (instructors, demonstrators) do NOT enter the academics files; they go to the private
    private/collect/<id>_not_added.csv for review (employment unresolved is never recorded as current).
  - A doctorate is recorded only when the listed qualification text states a completed PhD (no 'reading', 'pursuing', etc.);
    institution, country and year are left blank for the evidence-based enrichment step. No contact details and no leave remarks.
  - A unit is taken from the listing page; when missing it is inferred only from the same site section's own faculty title.
Re-running is safe: existing rows are kept and only new names are added.
Usage: python3 App/scripts/build_new_university_data.py <id> [<id> ...]
"""
import csv, glob, hashlib, io, re, sys, time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Data/Lanka-Academia"; RAW = ROOT / "private/collect"
UNI = {
    "sabaragamuwa": ("Sabaragamuwa University of Sri Lanka", "Sabaragamuwa", "https://www.sab.ac.lk/", "Ratnapura"),
    "wayamba": ("Wayamba University of Sri Lanka", "Wayamba", "https://www.wyb.ac.lk/", "Kuliyapitiya"),
    "rajarata": ("Rajarata University of Sri Lanka", "Rajarata", "https://www.rjt.ac.lk/", "Mihintale"),
    "eastern": ("Eastern University, Sri Lanka", "Eastern", "https://www.esn.ac.lk/", "Vantharumoolai, Batticaloa"),
    "seusl": ("South Eastern University of Sri Lanka", "South Eastern", "https://www.seu.ac.lk/", "Oluvil"),
    "ousl": ("The Open University of Sri Lanka", "Open University", "https://www.ou.ac.lk/", "Nawala, Nugegoda"),
    "uvpa": ("University of the Visual and Performing Arts", "Visual & Performing Arts", "https://vpa.ac.lk/", "Colombo"),
}
TODAY = time.strftime("%Y-%m-%d")
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
norm = lambda s: re.sub(r"[^a-z]", "", re.sub(r"\b(prof(essor)?|dr|mr|mrs|ms|miss|ven|rev|eng|snr|senior|emeritus|emer)\b\.?", "", s.lower()))
EMAIL = re.compile(r"\S+@\S+|\+?\d[\d\s\-()]{7,}\d")
ONGOING = re.compile(r"reading|pursuing|registered|ongoing|on-going|candidate|enrol|expected|\(R\)|read(ing)? for|studying|following", re.I)
PHD = re.compile(r"\b(?:Ph\.?\s?D\.?|D\.?\s?Phil\.?|Doctor of Philosophy)\b", re.I)
LEAVE = re.compile(r"[–-]?\s*\(?\s*on\s+(?:study\s+)?leave[^)]*\)?|\(?\s*study\s+leave[^)]*\)?|\(?\s*sabbatical[^)]*\)?|\(?\s*on\s+lien[^)]*\)?", re.I)
EXCLUDE_POS = re.compile(r"visiting|temporary|contract|demonstrator|instructor|honorary|part[- ]?time|casual", re.I)


def existing_header():
    f = next(iter(glob.glob(str(DATA / "universities/colombo/**/academics.csv"), recursive=True)))
    raw = open(f, "rb").read().decode("utf-8-sig"); return next(csv.reader(io.StringIO(raw)))


def all_ids():
    ids = set()
    for f in glob.glob(str(DATA / "universities/**/academics.csv"), recursive=True):
        for r in csv.DictReader(open(f, encoding="utf-8-sig")): ids.add(r["academic_id"])
    return ids


def make_id(uni, name, taken):
    n = 0
    while True:
        h = "SL-" + hashlib.sha256(f"{uni}|{norm(name)}|{n}".encode()).hexdigest()[:12]
        if h not in taken: return h
        n += 1


def clean_name(n):
    n = re.sub(r"\s+", " ", LEAVE.sub("", n)).strip(" ,-"); n = re.sub(r"\s+([.,])", r"\1", n); return EMAIL.sub("", n).strip()


def tidy_unit(s, kind):
    s = re.sub(r"\s+", " ", s).strip(" -|,"); s = re.sub(r"^(Dept\.?)( of)", r"Department\2", s, flags=re.I)
    return s


# Faculty names taken from each official site's own section/subdomain titles (checked against the cached site pages).
SECTION_FACULTY = {("www.seu.ac.lk", "fac"): "Faculty of Arts and Culture", ("www.seu.ac.lk", "fas"): "Faculty of Applied Sciences", ("www.seu.ac.lk", "fia"): "Faculty of Islamic Studies and Arabic Language",
                   ("www.seu.ac.lk", "fmc"): "Faculty of Management and Commerce", ("www.seu.ac.lk", "ft"): "Faculty of Technology", ("www.seu.ac.lk", "pgufac"): "Faculty of Arts and Culture", ("www.seu.ac.lk", "pgufmc"): "Faculty of Management and Commerce", ("www.seu.ac.lk", "pguft"): "Faculty of Technology"}
HOST_FACULTY = {"fms.rjt.ac.lk": "Faculty of Management Studies", "foa.rjt.ac.lk": "Faculty of Agriculture", "fssh.rjt.ac.lk": "Faculty of Social Sciences and Humanities", "fot.wyb.ac.lk": "Faculty of Technology", "fbsf.wyb.ac.lk": "Faculty of Business Studies and Finance"}
OUSL_FACULTY = [(r"english language|language studies|legal studies|social stud", "Faculty of Humanities and Social Sciences"), (r"chemistry|computer science|mathematics|plant sciences|physics|zoology|natural sci", "Faculty of Natural Sciences"),
                (r"accounting|human resource|marketing|organi[sz]ational|management studies|business", "Faculty of Management Studies"),
                (r"engineering|textile|apparel|technology", "Faculty of Engineering Technology"), (r"secondary|tertiary|primary|pre-?school|education", "Faculty of Education"), (r"nursing|medical|health", "Faculty of Health Sciences")]
UVPA_FACULTY = [(r"music", "Faculty of Music"), (r"dance|drama|theat|ballet", "Faculty of Dance and Drama"), (r"paint|sculpt|design|textile|visual|photograph|ceramic|craft|graphic|art history", "Faculty of Visual Arts")]


def canon_faculty(fac, counts):
    k = re.sub(r"[^a-z]", "", re.sub(r"\b(archives?|staff|home)\b", "", fac.lower()).replace("&", "and"))
    return counts.get(k, fac)


def infer_faculty(rows):
    """Fill a missing faculty from the same site section (host + first path segment) when that section's rows name one faculty."""
    sect = defaultdict(Counter)
    key = lambda u: (u.split("/")[2] if u.count("/") >= 2 else "", (u.split("/")[3].split("?")[0] if u.count("/") >= 3 else ""))
    for r in rows:
        if r["faculty"]: sect[key(r["page_url"])][r["faculty"]] += 1
    for r in rows:
        if not r["faculty"]:
            h, seg = key(r["page_url"])
            c = sect.get((h, seg))
            if (h, seg) in SECTION_FACULTY: r["faculty"] = SECTION_FACULTY[(h, seg)]
            elif h in HOST_FACULTY: r["faculty"] = HOST_FACULTY[h]
            elif c and len(c) == 1: r["faculty"] = next(iter(c))
            elif h.endswith("ou.ac.lk") and r["department"]:
                r["faculty"] = next((f for rx, f in OUSL_FACULTY if re.search(rx, r["department"], re.I)), "")
            elif h.endswith("vpa.ac.lk") and r["department"]:
                r["faculty"] = next((f for rx, f in UVPA_FACULTY if re.search(rx, r["department"], re.I)), "")
    spell = defaultdict(Counter)
    for r in rows:
        if r["faculty"]:
            r["faculty"] = re.sub(r"\s+(Archives?|Staff)$", "", r["faculty"]).strip(); spell[re.sub(r"[^a-z]", "", r["faculty"].lower().replace("&", "and"))][r["faculty"]] += 1
    best = {k: v.most_common(1)[0][0] for k, v in spell.items()}
    for r in rows:
        if r["faculty"]: r["faculty"] = best[re.sub(r"[^a-z]", "", r["faculty"].lower().replace("&", "and"))]
    return rows


def main():
    header = existing_header(); taken = all_ids()
    for uid in sys.argv[1:]:
        name, short, home, city = UNI[uid]
        raw = list(csv.DictReader(open(RAW / f"{uid}_entries.csv", encoding="utf-8"))); raw = infer_faculty(raw)
        base = DATA / "universities" / uid
        have = {}
        for f in glob.glob(str(base / "**/academics.csv"), recursive=True):
            for r in csv.DictReader(open(f, encoding="utf-8-sig")): have[norm(r["full_name"])] = r["academic_id"]
        leaves, not_added = defaultdict(list), []
        for e in raw:
            nm = clean_name(e["name"]); pos = e["position"].strip()
            if not norm(nm) or len(norm(nm)) < 5 or norm(nm) in have: continue
            if EXCLUDE_POS.search(pos) or EXCLUDE_POS.search(e.get("page_title", "") + " " + e["name"]):
                not_added.append([nm, pos, e["faculty"], e["department"], e["page_url"], "visiting/temporary/ancillary or part-time: employment unresolved"]); continue
            fac = tidy_unit(e["faculty"], "f") or "Unassigned faculty"; dep = tidy_unit(e["department"], "d")
            q = EMAIL.sub("", LEAVE.sub("", e["qualifications"])).strip(" ;"); has_phd = bool(PHD.search(q)); ongoing = has_phd and bool(ONGOING.search(q))
            status = ("in_progress" if ongoing else "listed_completed") if has_phd else ("not_listed_on_profile" if q else "not_published_or_not_extracted")
            emer = bool(re.search(r"emerit", pos + " " + e["name"], re.I))
            rid = make_id(uid, nm, taken); taken.add(rid); have[norm(nm)] = rid
            row = dict.fromkeys(header, "")
            row.update(academic_id=rid, full_name=nm, university=name, faculty=fac, department=dep, academic_position=("Emeritus Professor" if emer else pos),
                       qualifications=q, staff_profile_url=e["page_url"], collected_at=TODAY, employment_status=("emeritus_officially_listed" if emer else "not_explicitly_verified"),
                       record_status=("listed_emeritus_official" if emer else "listed_academic_employment_unverified"), research_lookup_status="not_yet_searched", phd_status=status,
                       qualification_evidence=(("Listed qualifications on the official staff page: " + q[:160]) if q else ""), notes=f"Listed on the official staff page; collected {TODAY}.")
            leaves[(fac, dep)].append(row)
        n_new = 0
        for (fac, dep), rows in leaves.items():
            d = base / "faculties" / slug(fac) / ("departments/" + slug(dep) if dep else ""); d.mkdir(parents=True, exist_ok=True); fn = d / "academics.csv"
            old = []
            if fn.exists(): old = list(csv.DictReader(open(fn, encoding="utf-8-sig")))
            out = io.StringIO(); w = csv.DictWriter(out, fieldnames=header, lineterminator="\n"); w.writeheader(); w.writerows(old + rows)
            open(fn, "w", encoding="utf-8-sig", newline="").write(out.getvalue()); n_new += len(rows)
        # per-university tables from what is on disk now
        facs = defaultdict(lambda: [set(), 0])
        for f in glob.glob(str(base / "faculties/**/academics.csv"), recursive=True):
            for r in csv.DictReader(open(f, encoding="utf-8-sig")): facs[r["faculty"]][0].add(r["department"]); facs[r["faculty"]][1] += 1
        out = io.StringIO(); w = csv.writer(out, lineterminator="\n"); w.writerow(["faculty_id", "faculty_name", "department_count", "academic_records"])
        for fn_, (deps, n) in sorted(facs.items()): w.writerow([slug(fn_), fn_, len({d for d in deps if d}), n])
        open(base / "faculties.csv", "w", encoding="utf-8-sig", newline="").write(out.getvalue())
        out = io.StringIO(); w = csv.writer(out, lineterminator="\n"); w.writerow(["university_id", "name", "type", "homepage_url", "address", "telephone", "faculty_inventory_url", "checked_at", "coverage_note"])
        w.writerow([uid, name, "Public", home, city + ", Sri Lanka", "", home, TODAY, "Collected from official staff pages; coverage is partial and listed per faculty. Visiting, temporary and ancillary posts are not included. Qualifications are as listed on the pages."])
        open(base / "institution_details.csv", "w", encoding="utf-8-sig", newline="").write(out.getvalue())
        up = DATA / "universities.csv"; rows = list(csv.DictReader(open(up, encoding="utf-8-sig")))
        if uid not in {r["id"] for r in rows}:
            rows.append({"id": uid, "name": name, "short": short, "type": "Public", "academic_records": "0"}); out = io.StringIO()
            w = csv.DictWriter(out, fieldnames=["id", "name", "short", "type", "academic_records"], lineterminator="\n"); w.writeheader(); w.writerows(rows); open(up, "w", encoding="utf-8-sig", newline="").write(out.getvalue())
        with open(RAW / f"{uid}_not_added.csv", "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh); w.writerow(["name", "position", "faculty", "department", "page_url", "reason"]); w.writerows(not_added)
        print(f"{uid}: {n_new} new records in {len(leaves)} units; {len(not_added)} not added (visiting/temporary/ancillary); {sum(v[1] for v in facs.values())} total on disk")


if __name__ == "__main__":
    main()

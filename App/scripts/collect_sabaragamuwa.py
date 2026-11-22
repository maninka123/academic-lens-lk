#!/usr/bin/env python3
"""Read Sabaragamuwa University department staff lists and each person's own staff-directory profile.

The faculty sites load each department's academic staff from the university's own public endpoint (/api.php?d=<code>), and every
person links to /staff-directory/<id>. This reads those lists (name, position, profile id) and the profiles (dated degree lines,
research interests, research links). Polite: 1.2 s delay, cached in private/collect_cache/sabaragamuwa. The site publishes no
robots.txt (404). E-mail addresses and telephone numbers are never stored.

Writes (git-ignored): private/collect/sabaragamuwa_api_entries.csv (department entries) and private/collect/sabaragamuwa_profiles.csv
(academic person profile facts). A year is kept only when the person's own degree line gives exactly one year.
Usage: python3 App/scripts/collect_sabaragamuwa.py
"""
import csv, hashlib, html, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "private/collect_cache/sabaragamuwa"; CACHE.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "LankaAcademiaResearch/1.0"}
BASE = "https://www.sab.ac.lk"
# (faculty, department, api code, department staff page)
DEPTS = [
    ("Faculty of Computing", "Department of Data Science", "dds", "https://www.sab.ac.lk/computing/departments/dds-staff"),
    ("Faculty of Computing", "Department of Software Engineering", "dse", "https://www.sab.ac.lk/computing/departments/dse-staff"),
    ("Faculty of Agricultural Sciences", "Department of Agribusiness Management", "agbm", "https://www.sab.ac.lk/agri/abm-staff"),
    ("Faculty of Agricultural Sciences", "Department of Export Agriculture", "exag", "https://www.sab.ac.lk/agri/ea-staff"),
    ("Faculty of Agricultural Sciences", "Department of Livestock Production", "livestock", "https://www.sab.ac.lk/agri/lp-staff"),
    ("Faculty of Applied Sciences", "Department of Food Science and Technology", "fst", "https://www.sab.ac.lk/app/index.php/fst-academic-staff"),
    ("Faculty of Applied Sciences", "Department of Natural Resources", "nr", "https://www.sab.ac.lk/app/index.php/nr-academic-staff"),
    ("Faculty of Applied Sciences", "Department of Physical Sciences and Technologies", "pst", "https://www.sab.ac.lk/app/index.php/pst-academic-staff"),
    ("Faculty of Applied Sciences", "Department of Sports Sciences and Physical Education", "spe", "https://www.sab.ac.lk/app/sport-academic-staff"),
    ("Faculty of Geomatics", "Department of Remote Sensing and GIS", "rsgis", "https://www.sab.ac.lk/geo/academic-staff-gis"),
    ("Faculty of Geomatics", "Department of Surveying and Geodesy", "sg", "https://www.sab.ac.lk/geo/academic-staff-survey"),
    ("Faculty of Management Studies", "Department of Accountancy and Finance", "af", "https://www.sab.ac.lk/mgmt/af_Staff"),
    ("Faculty of Management Studies", "Department of Business Management", "bm", "https://www.sab.ac.lk/mgmt/bm_Staff"),
    ("Faculty of Management Studies", "Department of Marketing Management", "mm", "https://www.sab.ac.lk/mgmt/mm_staff"),
    ("Faculty of Management Studies", "Department of Tourism Management", "tm", "https://www.sab.ac.lk/mgmt/tmStaff"),
    ("Faculty of Social Sciences and Languages", "Department of Economics and Statistics", "econ", "https://www.sab.ac.lk/fssl/department-economics-statistics-staff"),
    ("Faculty of Social Sciences and Languages", "Department of English Language Teaching", "eldt-ssl", "https://www.sab.ac.lk/fssl/department-English-language-teaching-Staff"),
    ("Faculty of Social Sciences and Languages", "Department of Geography and Environmental Management", "geography-ssl", "https://www.sab.ac.lk/fssl/department-geography-staff"),
    ("Faculty of Technology", "Department of Biosystems Technology", "Biosystems", "https://www.sab.ac.lk/tech/department-of-biosystems-technology-academic-staff"),
    ("Faculty of Technology", "Department of Engineering Technology", "Engineering", "https://www.sab.ac.lk/tech/department-of-engineering-technology-academic-staff"),
]
OUT_E = ROOT / "private/collect/sabaragamuwa_api_entries.csv"
OUT_P = ROOT / "private/collect/sabaragamuwa_profiles.csv"
DOCTORAL = re.compile(r"^(?:Ph\.?\s?D\.?|D\.\s?Phil|Doctor of Philosophy|D\.?\s?Eng)\b", re.I)
SKIP = re.compile(r"reading|pursuing|candidate|registered|following|scholarship|enrolled|ongoing|currently|submitted", re.I)
COUNTRY = {"sri lanka": "Sri Lanka", "japan": "Japan", "australia": "Australia", "china": "China", "india": "India", "thailand": "Thailand", "malaysia": "Malaysia",
           "united kingdom": "United Kingdom", "uk": "United Kingdom", "u.k": "United Kingdom", "usa": "United States", "u.s.a": "United States", "united states": "United States",
           "canada": "Canada", "germany": "Germany", "new zealand": "New Zealand", "singapore": "Singapore", "south korea": "South Korea", "korea": "South Korea", "france": "France",
           "sweden": "Sweden", "norway": "Norway", "netherlands": "Netherlands", "belgium": "Belgium", "italy": "Italy", "taiwan": "Taiwan", "hong kong": "Hong Kong", "denmark": "Denmark",
           "finland": "Finland", "switzerland": "Switzerland", "austria": "Austria", "russia": "Russia", "pakistan": "Pakistan", "bangladesh": "Bangladesh", "ireland": "Ireland"}
SL_UNIS = re.compile(r"university of (?:colombo|peradeniya|kelaniya|moratuwa|jaffna|ruhuna|sri jayewardenepura)|sabaragamuwa|wayamba|rajarata|uva wellassa|eastern university|open university of sri lanka|south eastern", re.I)


def fetch(url, delay=1.2):
    cf = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if cf.exists(): return cf.read_text(encoding="utf-8")
    time.sleep(delay)
    try: raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf-8", "ignore")
    except Exception as e:
        print("fetch failed", url, str(e)[:60]); return ""
    cf.write_text(raw, encoding="utf-8"); return raw


def lines_of(raw):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    return [re.sub(r"\s+", " ", l).strip() for l in t.split("\n") if l.strip()]


def staff(code):
    raw = fetch(f"{BASE}/api.php?d={code}")
    ids = re.findall(r'href="/staff-directory/(\d+)"', raw)
    ls = lines_of(raw); out = []; i = 0; head = False
    while i < len(ls):
        if ls[i] == "Head of the Department": head = True; i += 1; continue
        if i + 1 < len(ls) and re.match(r"^(?:Dr|Prof|Professor|Mr|Mrs|Ms|Miss|Eng|Rev|Ven)\b", ls[i]):
            name, pos, j = ls[i], ls[i + 1], i + 2
            while j < len(ls) and ls[j] != "View Profile" and not ls[j].startswith("Email"): j += 1  # study leave and other notes
            while j < len(ls) and ls[j] != "View Profile": j += 1
            out.append({"name": name, "position": pos, "head": head}); head = False; i = j + 1; continue
        i += 1
    for k, p in enumerate(out): p["id"] = ids[k] if k < len(ids) else ""
    return out


def profile(pid):
    raw = fetch(f"{BASE}/staff-directory/{pid}")
    if not raw: return {}
    ls = lines_of(raw); links = [html.unescape(h) for h in re.findall(r'href="([^"]+)"', raw)]
    g = lambda pat: next((h for h in links if re.search(pat, h)), "")
    quals, interests, mode = [], [], ""
    for l in ls:
        if l in ("Profile", "Membership of Professional Bodies/Associations", "Research Interests", "Recent Publications"):
            mode = l; continue
        if mode == "Profile" and (re.search(r"\b(?:B\.?\s?Sc|B\.?\s?A\b|BSc|MSc|M\.?\s?Sc|M\.?\s?Phil|PhD|Ph\.D|Diploma|Bachelor|Master|Doctor|Postgraduate|MBA|LL\.?B|B\.?Tech|M\.?Eng|B\.?Eng)", l, re.I) and len(l) < 260): quals.append(l)
        if mode == "Research Interests" and len(l) < 400: interests.append(l)
    phd = next((q for q in quals if DOCTORAL.match(q) and not SKIP.search(q)), "")
    return {"google_scholar_url": g(r"scholar\.google\.[a-z.]+/citations"), "researchgate_url": g(r"researchgate\.net/profile"), "orcid_url": g(r"orcid\.org/\d{4}-"),
            "qualifications": "; ".join(quals)[:600], "interests": "; ".join(interests)[:400], "phd_line": phd}


def phd_parts(line):
    if not line: return "", "", ""
    yrs = re.findall(r"\b(19[6-9]\d|20[0-2]\d)\b", line)
    year = yrs[0] if len(yrs) == 1 else ""
    low = line.lower()
    country = ""
    for k, v in COUNTRY.items():
        if re.search(r"\b" + re.escape(k) + r"\b", low): country = v; break
    parts = [p.strip(" .") for p in re.split(r",|\s[–—-]\s", re.sub(r"^(?:Ph\.?\s?D\.?|D\.\s?Phil|Doctor of Philosophy)\s*(?:\([^)]*\))?\s*(?:in|of)?", "", line, flags=re.I)) if p.strip(" .")]
    uni = next((p for p in parts if re.search(r"universit|institute|college|centre|center", p, re.I)), "")
    if not country and SL_UNIS.search(line): country = "Sri Lanka"
    return uni, country, year


def main():
    ent, prof = [], []
    for fac, dept, code, page in DEPTS:
        people = staff(code)
        print(dept, len(people), "people")
        for p in people:
            ent.append({"faculty": fac, "department": dept, "name": p["name"], "position": p["position"], "section": "Head of the Department" if p["head"] else "Academic Staff", "qualifications": "", "temporary": "0", "profile_url": f"{BASE}/staff-directory/{p['id']}" if p["id"] else "", "page_url": page})
            if p["id"]:
                d = profile(p["id"]); uni, country, year = phd_parts(d.get("phd_line", ""))
                prof.append({"faculty": fac, "department": dept, "name": p["name"], "profile_url": f"{BASE}/staff-directory/{p['id']}", **{k: d.get(k, "") for k in ("google_scholar_url", "researchgate_url", "orcid_url", "qualifications", "interests", "phd_line")}, "phd_university": uni, "phd_country": country, "phd_year": year})
    with open(OUT_E, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(ent[0].keys())); w.writeheader(); w.writerows(ent)
    with open(OUT_P, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(prof[0].keys())); w.writeheader(); w.writerows(prof)
    print(len(ent), "entries |", len(prof), "profiles | PhD lines", sum(1 for r in prof if r["phd_line"]), "| Scholar", sum(1 for r in prof if r["google_scholar_url"]), "| ResearchGate", sum(1 for r in prof if r["researchgate_url"]), "| ORCID", sum(1 for r in prof if r["orcid_url"]))


if __name__ == "__main__":
    main()

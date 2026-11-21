#!/usr/bin/env python3
"""Collect per-department academic staff, positions and full qualification lines from the official Wayamba University faculty sites.

Each department has a staff page (fapm/fas/fot/fom/flfn .wyb.ac.lk) with a card per person: title and name, position line(s) such as
"Head of the Department" and "Senior Lecturer", then the person's degree lines, each with its awarding institution and country, for
example "Ph.D. (Animal Science) (Iowa State University, USA)". This reads those pages and writes private/collect/wayamba_dept_entries.csv
(git-ignored): faculty, department, name, position, qualifications, page_url.

Skipped: academic supportive staff, demonstrators and non-academic staff (everything from those headings to the next academic list).
The department name is the page's own "Department of ..." heading. Contact details are never stored. Polite: robots.txt, 1.2 s delay,
host dropped on 401/403/429/503, pages cached in private/collect_cache/wayamba_dept.
Usage: python3 App/scripts/collect_wayamba_departments.py
"""
import csv, hashlib, html, re, time, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "private/collect/wayamba_dept_entries.csv"
CACHE = ROOT / "private/collect_cache/wayamba_dept"; CACHE.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
PAGES = [  # (faculty, default department name, url)
    ("Faculty of Agriculture and Plantation Management", "Department of Agribusiness Management", "https://fapm.wyb.ac.lk/?page_id=552"),
    ("Faculty of Agriculture and Plantation Management", "Department of Biosystems Engineering", "https://fapm.wyb.ac.lk/?page_id=654"),
    ("Faculty of Agriculture and Plantation Management", "Department of Biotechnology", "https://fapm.wyb.ac.lk/?page_id=667"),
    ("Faculty of Agriculture and Plantation Management", "Department of Horticulture and Landscape Gardening", "https://fapm.wyb.ac.lk/?page_id=673"),
    ("Faculty of Agriculture and Plantation Management", "Department of Plantation Management", "https://fapm.wyb.ac.lk/?page_id=683"),
    ("Faculty of Applied Sciences", "Department of Mathematical Sciences", "https://fas.wyb.ac.lk/math-home/staff/"),
    ("Faculty of Applied Sciences", "Department of Electronics", "https://fas.wyb.ac.lk/eltn-home/staff/"),
    ("Faculty of Applied Sciences", "Department of Industrial Management", "https://fas.wyb.ac.lk/imgt-home/staff/"),
    ("Faculty of Applied Sciences", "Department of Computing and Information Systems", "https://fas.wyb.ac.lk/cmis-home/staff/"),
    ("Faculty of Technology", "Department of Nano Science Technology", "https://fot.wyb.ac.lk/people-nano/"),
    ("Faculty of Technology", "Department of Electrotechnology", "https://fot.wyb.ac.lk/people-et/"),
    ("Faculty of Technology", "Department of Construction Technology", "https://fot.wyb.ac.lk/people-ct/"),
    ("Faculty of Technology", "Department of Mechanical and Manufacturing Technology", "https://fot.wyb.ac.lk/people-mmt/"),
    ("Faculty of Medicine", "Department of Anatomy", "https://fom.wyb.ac.lk/depanatomy/staff/"),
    ("Faculty of Medicine", "Department of Biochemistry", "https://fom.wyb.ac.lk/depbiochemistry/staff/"),
    ("Faculty of Medicine", "Department of Community Medicine and Family Medicine", "https://fom.wyb.ac.lk/depcommed/staff/"),
    ("Faculty of Medicine", "Department of Forensic Medicine", "https://fom.wyb.ac.lk/depforensic/staff/"),
    ("Faculty of Medicine", "Department of Medicine", "https://fom.wyb.ac.lk/depmedicine/staff/"),
    ("Faculty of Medicine", "Department of Microbiology", "https://fom.wyb.ac.lk/depmicro/staff/"),
    ("Faculty of Medicine", "Department of Parasitology", "https://fom.wyb.ac.lk/depparasit/staff/"),
    ("Faculty of Medicine", "Department of Pathology", "https://fom.wyb.ac.lk/deppathology/staff/"),
    ("Faculty of Medicine", "Department of Pharmacology", "https://fom.wyb.ac.lk/deppharm/satff/"),
    ("Faculty of Medicine", "Department of Obstetrics and Gynaecology", "https://fom.wyb.ac.lk/depgynandobs/staff/"),
    ("Faculty of Medicine", "Department of Paediatrics", "https://fom.wyb.ac.lk/deppeadiatrics/staff/"),
    ("Faculty of Medicine", "Department of Physiology", "https://fom.wyb.ac.lk/depphysiology/staff/"),
    ("Faculty of Medicine", "Department of Psychiatry", "https://fom.wyb.ac.lk/dep-psychiatry/staff/"),
    ("Faculty of Medicine", "Department of Surgery", "https://fom.wyb.ac.lk/depsurgery/staff/"),
    ("Faculty of Livestock Fisheries and Nutrition", "", "https://flfn.wyb.ac.lk/?page_id=552"),
]
TITLE = re.compile(r"^(?:Chair\s+Prof(?:essor)?|Snr\.?\s*Prof(?:essor)?|Senior\s+Prof(?:essor)?|Prof(?:essor)?|Dr|Mr|Mrs|Ms|Miss|Eng|Rev|Ven)\b(?:\.|\s)\s*(?:\([A-Za-z.\s]+\)\.?\s*)*(?:\.\s*)?[A-Za-z]", re.I)
DEGREE = re.compile(r"\b(?:B\.?\s?Sc|M\.?\s?Sc|Ph\.?\s?D|M\.?\s?Phil|M\.?\s?Phill|PhD|MBA|MBS|BBST|B\.?\s?A|M\.?\s?A|M\.?\s?S|M\.?\s?Eng|B\.?\s?Eng|B\.?\s?Tech|M\.?\s?Tech|Diploma|PG\.?\s?Dip|Dip|Bachelor|Master|LLB|LLM|BVSc|MVSc|MBBS|MD|MPH|B\.?\s?Com|M\.?\s?Ed|B\.?\s?Ed|Reading for)\b", re.I)
POSITION = re.compile(r"profe?ss?or|proffessor|lecturer|head of|chair|dean|ass\.?\s*lecturer", re.I)
STOP_SKIP = re.compile(r"^(?:academic supportive staff|academic support staff|supportive staff|junior academic staff|non[- ]?academic staff|temporary|visit\w*|demonstrators?|technical staff|instructors?|other staff)", re.I)
END = re.compile(r"^(?:Design (?:&|and) Maintained|Copyright|Quick Links|Contact Us$)", re.I)
last = {}; robots = {}; blocked = set()


def allowed(url):
    host = urllib.parse.urlparse(url).netloc
    if host not in robots:
        rp = urllib.robotparser.RobotFileParser(f"https://{host}/robots.txt")
        try: rp.read()
        except Exception: rp = None
        robots[host] = rp
    return robots[host] is None or robots[host].can_fetch(UA, url)


def fetch(url, delay=1.2):
    cf = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if cf.exists(): return cf.read_text(encoding="utf-8") or None
    host = urllib.parse.urlparse(url).netloc
    if host in blocked or not allowed(url): return None
    wait = delay - (time.time() - last.get(host, 0))
    if wait > 0: time.sleep(wait)
    last[host] = time.time()
    try: raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 429, 503): blocked.add(host)
        return None
    except Exception: return None
    cf.write_text(raw, encoding="utf-8"); return raw


def lines_of(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<\s*(?:br|/p|/div|/h\d|/li|/tr|/td|/span|/figcaption)[^>]*>", "\n", raw, flags=re.I)
    return [re.sub(r"[ \t\xa0]+", " ", l).strip() for l in html.unescape(re.sub(r"<[^>]+>", " ", raw)).split("\n") if l.strip()]


def rank_of(pos_lines):
    """Academic rank from the position lines (drops 'Head of the Department', 'Chair of ...' duties)."""
    text = " ".join(pos_lines)
    if re.search(r"emeritus", text, re.I): return "Emeritus Professor"
    m = re.search(r"(Senior\s+Professor|Proffessor|Professor|Senior\s+Lecturer(?:\s*\((?:Gr|Grade)[^)]*\))?|Lecturer\s*\((?:Probationary|Prob\.?|Unconfirmed|Temporary)\)|Lecturer|Ass(?:istant|\.)\s*Lecturer)", text, re.I)
    if not m: return " ".join(pos_lines)
    r = re.sub(r"\s+", " ", m.group(1)).strip().replace("Proffessor", "Professor")
    return re.sub(r"(?i)^lecturer\s*\(prob\.?\)$", "Lecturer (Probationary)", re.sub(r"(?i)^ass\.\s*lecturer$", "Assistant Lecturer", r))


def parse(lines, default_dept):
    people, dept, cur, skipping, started = [], default_dept, None, False, False
    def close():
        nonlocal cur
        if cur: people.append(cur); cur = None
    for l in lines:
        if END.match(l) and started and (people or cur): close(); break
        m = re.match(r"^(Department of [A-Z][A-Za-z&\- ]{3,70})$", l)
        if m and l.startswith("Department of"):
            close(); skipping = False
            if not default_dept: dept = re.sub(r"\s*&\s*", " and ", l).strip()
            continue
        if re.match(r"^Academic Staff\s*$", l, re.I): close(); skipping = False; started = True; continue
        if not started: continue
        if STOP_SKIP.match(l): close(); skipping = True; continue
        if skipping: continue
        if re.match(r"^(?:Department Home|Home|Read More)$", l, re.I): continue
        if re.match(r"^(?:senior\s+)?prof+essor(?:\s+(?:and|&|in|of)\b|\s*$|\s*/)", l, re.I): (cur["pos"].append(l) if cur else None); continue
        if TITLE.match(l) and not re.match(r"^(?:B\.?\s?Sc|M\.?\s?Sc|Ph\.?\s?D|M\.?\s?Phil|MBA|D\.?\s?Sc)\b", l, re.I) and not POSITION.match(l.split(".")[0].strip()):
            close(); cur = {"name": l, "pos": [], "q": [], "dept": dept}; continue
        if not cur: continue
        if re.match(r"^\(?\s*(?:Ass\.?|Assistant)\s*Lecturer\s*\)?$", l, re.I): cur["pos"].append("Assistant Lecturer"); continue
        if POSITION.search(l) and not DEGREE.search(l.split("(")[0]) and len(l) < 140: cur["pos"].append(l); continue
        if DEGREE.search(l) or (cur["q"] and re.match(r"^[A-Za-z(].*[),]$", l)): cur["q"].append(l)
    close()
    return people


def main():
    rows = []
    for faculty, dept0, url in PAGES:
        raw = fetch(url)
        if not raw: print(faculty, "|", dept0 or url, ": unavailable", flush=True); continue
        ps = parse(lines_of(raw), dept0)
        seen = set()
        for p in ps:
            key = (p["dept"], re.sub(r"[^a-z]", "", p["name"].lower()))
            if key in seen or not p["dept"]: continue
            seen.add(key)
            rows.append({"faculty": faculty, "department": p["dept"], "name": p["name"], "position": rank_of(p["pos"]), "qualifications": "; ".join(q.strip(" ,;") for q in p["q"]), "page_url": url})
        print(f"{faculty} | {dept0 or '(named on page)'}: {len(ps)}", flush=True)
    # A person listed twice in one faculty (a header card plus the department list) is kept once, in the department listed last.
    last_idx = {}
    for i, r in enumerate(rows): last_idx[(r["faculty"], re.sub(r"[^a-z]", "", r["name"].lower()))] = i
    rows = [r for i, r in enumerate(rows) if last_idx[(r["faculty"], re.sub(r"[^a-z]", "", r["name"].lower()))] == i]
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["faculty", "department", "name", "position", "qualifications", "page_url"]); w.writeheader(); w.writerows(rows)
    print(len(rows), "people ->", OUT)


if __name__ == "__main__":
    main()

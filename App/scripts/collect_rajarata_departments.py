#!/usr/bin/env python3
"""Collect per-department academic staff from the official Rajarata University of Sri Lanka faculty sites.

Each faculty site (foa/aps/fms/fot/fssh/fmas .rjt.ac.lk) lists its departments in a menu; each department has a staff page with
sections (Head of the Department, Senior Professors, Professors, Senior Lecturers, Lecturers, ... Non-Academic Staff) and a card per
person (title and name, then position, often a link to the person's own page). This reads those pages and writes
private/collect/rajarata_dept_entries.csv (git-ignored): faculty, department, name, position, section_rank, profile_url, page_url.

Only academic posts are kept: sections for non-academic, temporary, visiting and demonstrator staff are skipped. The rank comes from the
person's own position text; when that names a duty (for example "Student Counselor") the section heading supplies the rank.
Contact details are never stored. Polite: robots.txt, one request at a time per host, 1.2 s delay, host dropped on 401/403/429/503,
pages cached in private/collect_cache/rajarata_dept.
Usage: python3 App/scripts/collect_rajarata_departments.py
"""
import csv, hashlib, html, re, time, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "private/collect/rajarata_dept_entries.csv"
CACHE = ROOT / "private/collect_cache/rajarata_dept"; CACHE.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
FACULTIES = {"foa": "Faculty of Agriculture", "aps": "Faculty of Applied Sciences", "fms": "Faculty of Management Studies", "fot": "Faculty of Technology",
             "fssh": "Faculty of Social Sciences and Humanities", "fmas": "Faculty of Medicine & Allied Sciences"}
# Department pages named in each faculty site's menu (checked against the sites' own menus).
DEPTS = {
    "foa": [("Department of Agricultural Engineering and Soil Science", "/agricultural-engineering-soil-science/"), ("Department of Agricultural Systems", "/department-of-agricultural-systems/"),
            ("Department of Animal and Food Sciences", "/department-of-animal-and-food-sciences/"), ("Department of Plant Sciences", "/department-of-plant-sciences/")],
    "aps": [("Department of Biological Sciences", "/biological-sciences/"), ("Department of Chemical Sciences", "/chem/"), ("Department of Computing", "/cs/"),
            ("Department of Health Promotion", "/department-of-health-promotion/"), ("Department of Physical Sciences", "/physical-sciences/")],
    "fms": [("Department of Accountancy and Finance", "/acf/"), ("Department of Business Management", "/bm-home/"), ("Department of Human Resource Management", "/hr-home/"),
            ("Department of Information Systems", "/is-home/"), ("Department of Marketing Management", "/mm-home/"), ("Department of Tourism and Hospitality Management", "/thm-home/")],
    "fot": [("Department of Bioprocess Technology", "/bpt-home/"), ("Department of Electrical and Electronic Technology", "/ent-home/"), ("Department of Food Technology", "/fdt-home/"),
            ("Department of Information and Communication Technology", "/ict-home/"), ("Department of Materials Technology", "/mtt-home/")],
    "fssh": [("Department of Archaeology and Heritage Management", "/index.php/dar-home/"), ("Department of Economics", "/index.php/dec-home/"), ("Department of English Language Teaching", "/index.php/del-home/"),
             ("Department of Environmental Management", "/index.php/dem-home/"), ("Department of Humanities", "/index.php/dhu-home/"), ("Department of Information Technology", "/index.php/dit-home/"),
             ("Department of Languages", "/index.php/dla-home/"), ("Department of Social Sciences", "/index.php/dss-home/"), ("Education Science Unit", "/index.php/edu-home/")],
    "fmas": [(f"Department of {n}", f"/{s}/") for n, s in [("Anatomy", "anatomy"), ("Biochemistry", "biochemistry"), ("Community Medicine", "community-medicine-2"), ("Family Medicine", "family-medicine"),
             ("Forensic Medicine", "forensic-medicine"), ("Gynaecology and Obstetrics", "gynaecology-and-obstetrics"), ("Medical Education", "medical-education"), ("Medicine", "medicine"),
             ("Microbiology", "microbiology"), ("Pathology", "pathology"), ("Paediatrics", "paediatrics"), ("Parasitology", "parasitology"), ("Pharmacology", "pharmacology"),
             ("Physiology", "physiology"), ("Psychiatry", "psychiatry"), ("Surgery", "surgery")]] + [("Radiology and Anaesthesiology Unit", "/radiology-anesthesiology-staff/")],
}
TITLE = re.compile(r"^(?:Chair\s+Prof(?:essor)?|Snr\.?\s*Prof(?:essor)?|Senior\s+Prof(?:essor)?|Prof(?:essor)?|Dr|Mr|Mrs|Ms|Miss|Eng|Rev|Ven)\b(?:\.|\s)\s*(?:\([A-Za-z.\s]+\)\.?\s*)?[A-Za-z]", re.I)
POSITION = re.compile(r"professor|lecturer|head|dean|student counsel|coordinator|director|consultant|instructor|demonstrator|registrar|technical|officer|assistant|attendant|nurseryman|mechanic", re.I)
SKIP_SECTION = re.compile(r"non[- ]?academic|former|temporary assistant|volunteer|honorary|visiting|demonstrator|tutor|technical|support staff|instructor", re.I)
SECTION = re.compile(r"^(?:head of (?:the )?department|senior professors|professors|associate professors|senior lecturers(?: \(?grade i+\)?)?|lecturers|probationary lecturers|temporary.*|visiting.*|honorary.*|volunteer.*|former.*|non[- ]?academic staff|academic staff|consultants?.*|instructors?|emeritus professors?|contract.*|demonstrators?.*)$", re.I)
RANK_OF = [(re.compile(r"senior professor", re.I), "Senior Professor"), (re.compile(r"professor", re.I), "Professor"), (re.compile(r"senior lecturer", re.I), "Senior Lecturer"), (re.compile(r"lecturer", re.I), "Lecturer")]
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


def profile_links(raw):
    """name-text -> profile URL for anchors that wrap a person's name or sit in a card."""
    out = {}
    for m in re.finditer(r'<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>', raw, flags=re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(2)))).strip()
        if TITLE.match(t): out[re.sub(r"[^a-z]", "", t.lower())] = m.group(1)
    return out


def is_position_only(l):
    """'Professor', 'Professor in Botany', 'Professor/Head', 'Professor (Chair)' are positions, not names."""
    return bool(re.match(r"^(?:chair\s+)?(?:senior\s+)?professor(?:\s+in\b|\s*/|\s*$|\s*\()", l, re.I))


def is_name(l):
    if not TITLE.match(l) or is_position_only(l): return False
    if re.match(r"^(?:senior\s+)?professor\s+[A-Z]", l, re.I) and not re.match(r"^(?:senior\s+)?professor\s+(?:in|of|and)\b", l, re.I): return True
    return not POSITION.match(l.split(".")[0].split("(")[0].strip())


def parse(lines, links):
    people, section, cur, skipping = [], "", None, False
    def close():
        nonlocal cur
        if cur: people.append(cur); cur = None
    for idx, l in enumerate(lines):
        nxt = lines[idx + 1] if idx + 1 < len(lines) else ""
        if re.match(r"(?:Quick Links|Contact Us|rajarata university$|All rights reserved|Faculty of .*\bRajarata University)", l, re.I) and (people or cur): close(); break
        if SECTION.match(l) or re.match(r"^(?:senior )?lecturers? ?\(.*\)$|^temporary .*|^(?:temporary )?(?:demonstrators?|tutors?)\b.*", l, re.I):
            if skipping and re.match(r"^(?:senior )?lecturer(?: ?\(.*\))?$|^professor$", l, re.I): continue   # a position line inside a skipped section
            if cur and not cur["position"] and re.search(r"professor|lecturer", l, re.I) and not re.match(r"^(?:senior professors?|professors?|senior lecturers?|lecturers?)$", l, re.I):
                cur["position"] = l; continue   # a position line that looks like a heading
            close(); section = l; skipping = bool(SKIP_SECTION.search(l)); continue
        if skipping: continue
        if re.match(r"(?:Read More|-->|\[|\])", l): continue
        untitled = (not TITLE.match(l) and not SECTION.match(l) and not POSITION.search(l) and re.fullmatch(r"[A-Z][A-Za-z.\s'-]{2,45}", l)
                    and re.match(r"^(?:Temporary\s+|Senior\s+)?Lecturer\b|^Professor\b|^Temporary\s+Assistant", nxt, re.I))
        if is_name(l) or untitled:
            close(); cur = {"name": l, "position": "", "section": section}; continue
        if cur and not cur["position"] and re.search(r"\b(?:MBBS|MD|MSc|PhD|MPH|MPhil|BSc|MA|MS|FRCP|FRCS|MRCP|MRCOG|DCH|DFM|LLB|BDS|MVSc|BVSc)\b", l) and not re.search(r"professor|lecturer", l, re.I):
            cur["quals"] = (cur.get("quals", "") + "; " + l).strip("; "); continue
        if cur and not cur["position"] and (POSITION.search(l) or len(l) < 70) and not is_name(l): cur["position"] = l
    close()
    for p in people: p["profile_url"] = links.get(re.sub(r"[^a-z]", "", p["name"].lower()), "")
    return people


def tidy_rank(pos):
    """Keep the academic rank from a long position text (drops clinical titles and duties)."""
    m = re.match(r"\s*((?:Chair\s+)?(?:Senior\s+)?Professor|Senior Lecturer(?:\s*\((?:Grade|Gr\.?)\s*I+\))?|(?:Assistant\s+)?Lecturer(?:\s*\((?:Probationary|Unconfirmed|Temporary)\))?)", pos, re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m and re.search(r"consultant|board certified|head dept|chair|&|/", pos, re.I) else pos


def rank_for(p):
    pos, sec = tidy_rank(p["position"]), p["section"]
    if re.search(r"temporary", sec, re.I) and not re.search(r"temporary", pos, re.I): pos = "Temporary " + (pos or "Assistant Lecturer")
    if not pos and re.match(r"(?:Snr\.?\s*)?Prof", p["name"], re.I): return "Professor"
    for rx, r in RANK_OF:
        if rx.search(pos) and not re.search(r"student counsel|coordinator|head", pos, re.I) or (rx.search(pos) and re.search(r"professor|lecturer", pos, re.I)): return pos
    for rx, r in RANK_OF:
        if rx.search(sec): return r
    return pos


def main():
    rows, seen = [], set()
    for host, faculty in FACULTIES.items():
        base = f"https://{host}.rjt.ac.lk"
        for dept, path in DEPTS[host]:
            raw = fetch(base + path)
            if not raw: print(faculty, "|", dept, ": page unavailable", flush=True); continue
            cands = [base + path]
            for h in sorted(set(re.findall(r'href="(https?://%s\.rjt\.ac\.lk/[^"#]*)"' % host, raw))):
                tail = h.lower()
                if re.search(r"staff", tail) and not re.search(r"non[-_]?academic|non-academic|nonacademic|temporary|visiting", tail) and h.replace("http://", "https://") not in cands: cands.append(h.replace("http://", "https://"))
            n = 0
            if len(cands) > 1 and "staff" not in cands[0].lower(): cands = cands[1:]   # the department home page only repeats the head; read the staff pages
            for u in cands:
                rr = fetch(u) if u != base + path else raw
                if not rr: continue
                links = profile_links(rr)
                for p in parse(lines_of(rr), links):
                    key = (faculty, dept, re.sub(r"[^a-z]", "", p["name"].lower()))
                    if key in seen or not p["position"] and not p["section"]: continue
                    if re.search(r"demonstrator|tutor|visiting|honorary professor|volunteer|contract|instructor", p["position"], re.I) or re.search(r"temporary\s+assistant\s+lecturer", p["position"] + " " + p["section"], re.I): continue
                    seen.add(key); n += 1
                    rows.append({"faculty": faculty, "department": dept, "name": p["name"], "position": rank_for(p), "section": p["section"], "qualifications": p.get("quals", ""), "temporary": int(bool(re.search(r"temporary", p["position"] + " " + p["section"], re.I))), "profile_url": p["profile_url"], "page_url": u})
            print(f"{faculty} | {dept}: {n}", flush=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["faculty", "department", "name", "position", "section", "qualifications", "temporary", "profile_url", "page_url"]); w.writeheader(); w.writerows(rows)
    print(len(rows), "people ->", OUT)


if __name__ == "__main__":
    main()

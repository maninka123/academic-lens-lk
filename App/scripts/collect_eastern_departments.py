#!/usr/bin/env python3
"""Collect per-department academic staff from the official Eastern University (Sri Lanka) faculty sites.

Each faculty site (fag/fac/fcm/fhcs/fsc/fot .esn.ac.lk) has one page per department at /<department>/academic-staff with a block per
person: name with title, qualifications, position and "Research Interest". This reads those pages and writes
private/collect/eastern_dept_entries.csv (git-ignored): faculty, department, name, position, qualifications, research_interests,
study_leave_pursuing_phd (internal flag only), page_url. Email addresses and phone numbers are never stored.

Polite: honours robots.txt, one request at a time per host with a delay, never bypasses 401/403/429/503 (the host is dropped).
Usage: python3 App/scripts/collect_eastern_departments.py [--delay 1.2]
"""
import argparse, csv, html, re, time, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "private/collect/eastern_dept_entries.csv"
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
FACULTIES = {"fag.esn.ac.lk": "Faculty of Agriculture", "fac.esn.ac.lk": "Faculty of Arts and Culture", "fcm.esn.ac.lk": "Faculty of Commerce and Management",
             "fhcs.esn.ac.lk": "Faculty of Health Care Sciences", "fsc.esn.ac.lk": "Faculty of Science", "fot.esn.ac.lk": "Faculty of Technology"}
TITLE = re.compile(r"^(?:Senior\s+Prof(?:essor)?|Prof(?:essor)?|Dr|Mr|Mrs|Ms|Miss|Eng|Rev|Ven)\b(?:\.|\s)\s*(?:\([A-Za-z.\s]+\)\.?\s*)?[A-Za-z]", re.I)
POSITION = re.compile(r"^(?:of\s+)?(?:Senior\s+|Associate\s+|Assistant\s+|Emeritus\s+)?(?:Professor|Professer|Prof\.|Lecturer|Instructor|Demonstrator|Head|Dean|Director|Coordinator)\b", re.I)
DEGREE = re.compile(r"\b(?:B\.?\s?Sc|M\.?\s?Sc|Ph\.?\s?D|M\.?\s?Phil|Mphil|PG\s?(?:Dip|Cert|D)|D\.?\s?Agric|M\.?\s?Agric|MBBS|MD|B\.?\s?A|M\.?\s?A|MBA|LLB|LLM|B\.?\s?Com|B\.?\s?Tech|M\.?\s?Tech|B\.?\s?Eng|M\.?\s?Eng|Dip(?:loma)?|Bachelor|Master|PQHRM|CCHRM|M\.?\s?Ed|B\.?\s?Ed|D\.?\s?Phil|DSc|Dr\.?\s?Eng|M\.?\s?Stat|M\.?\s?Pharm|B\.?\s?Pharm|M\.?\s?Th|M\.?\s?Litt)\b", re.I)
STOP = re.compile(r"^(?:Share This Page|Last Updated|Department of\b|Faculty of\b|Eastern University|Home$|Undergraduate Programme|Contact Us|©)", re.I)
last = {}
robots = {}


def allowed(url):
    host = urllib.parse.urlparse(url).netloc
    if host not in robots:
        rp = urllib.robotparser.RobotFileParser(f"http://{host}/robots.txt")
        try: rp.read()
        except Exception: rp = None
        robots[host] = rp
    rp = robots[host]
    return True if rp is None else rp.can_fetch(UA, url)


CACHE = ROOT / "private/collect_cache/eastern_dept"; CACHE.mkdir(parents=True, exist_ok=True)


def fetch(url, delay):
    import hashlib
    cf = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if cf.exists(): return cf.read_text(encoding="utf-8") or None
    r = _fetch(url, delay)
    if r is not None: cf.write_text(r, encoding="utf-8")
    return r


def _fetch(url, delay):
    host = urllib.parse.urlparse(url).netloc
    if host in blocked or not allowed(url): return None
    wait = delay - (time.time() - last.get(host, 0))
    if wait > 0: time.sleep(wait)
    last[host] = time.time()
    try: return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 429, 503): blocked.add(host)
        return None
    except Exception: return None


blocked = set()


def lines_of(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<\s*(?:br|/p|/div|/h\d|/li|/tr|/td|/span)[^>]*>", "\n", raw, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return [re.sub(r"[ \t\xa0]+", " ", l).strip() for l in t.split("\n") if l.strip()]


def parse(lines):
    # start after the page heading "Academic Staff" so menu items are skipped
    start = next((i for i, l in enumerate(lines) if HEAD.fullmatch(l)), 0)
    people, cur = [], None
    for l in lines[start + 1:]:
        if STOP.match(l) and not TITLE.match(l):
            if cur: people.append(cur); cur = None
            if re.match(r"(?:Share This Page|Last Updated|Contact Us|©)", l, re.I): break
            continue
        if TITLE.match(l) and not re.match(r"(?:Research Interest|E-?mail)", l, re.I) and not DEGREE.search(l.split("(")[0] if l.count("(") else l) and not POSITION.match(l):
            if cur: people.append(cur)
            cur = {"name": l.strip(), "pos": "", "q": [], "ri": "", "leave": False, "_ri": False}
            continue
        if not cur: continue
        if re.match(r"E-?mail\b", l, re.I): cur["_ri"] = False; continue
        m = re.match(r"Research Interests?\s*:?\s*(.*)", l, re.I)
        if m: cur["ri"] = m.group(1).strip(); cur["_ri"] = True; continue
        if cur["_ri"]: cur["ri"] += " " + l; continue
        if re.search(r"study leave|pursuing", l, re.I): cur["leave"] = True; cur["q"].append("") if False else None; cur["leaveline"] = l; continue
        if POSITION.match(l) and not DEGREE.search(l.split(" in ")[0]) and not cur["pos"]: cur["pos"] = l; continue
        if DEGREE.search(l) or (cur["q"] and re.match(r"^[A-Za-z].*\)\s*,?$", l) and not POSITION.match(l)): cur["q"].append(l)
    if cur: people.append(cur)
    return people


HEAD = re.compile(r"Academic Staff(?: - .*)?|Staff", re.I)
EXTRA = {"fac.esn.ac.lk": ["dsa", "social-sciences", "languages", "dit", "dpvs"], "fsc.esn.ac.lk": ["computing"], "fcm.esn.ac.lk": ["acf", "commerce", "economics", "management"], "fot.esn.ac.lk": ["dict", "dbst", "dmds"]}


def tidy(name):
    n = re.sub(r"\s*\(.*?\)\s*$", "", name).strip(" .")
    n = re.sub(r"\s+side\s+menu$", "", n, flags=re.I)
    n = re.sub(r"^dept\.?\s+of", "Department of", n, flags=re.I)
    if n.isupper(): n = n.title()
    n = re.sub(r"^(Department|Discipline) Of\b", r"\1 of", n)
    return re.sub(r"\s*&\s*", " and ", re.sub(r"\s+", " ", n)).replace("Value Studies", "Value Studies").strip()


def dept_of(ls, start, slug):
    k = next((i for i, l in enumerate(ls) if re.match(r"Share This Page", l, re.I)), None)
    if k is not None and k + 1 < len(ls):
        m = re.match(r"((?:Department|Dept\.?|Centre|Center|Unit|Discipline) of [^|]{3,80})", ls[k + 1], re.I)
        if m: return tidy(m.group(1))
    for j in list(range(start - 1, max(start - 5, -1), -1)) + list(range(start + 1, min(start + 4, len(ls)))):
        m = re.match(r"(?:Welcome to\s+)?((?:Department|Dept\.?|Centre|Center|Unit|Discipline) of [^|]{3,80})", ls[j], re.I)
        if m and not re.search(r"Academic Staff", ls[j], re.I): return tidy(m.group(1))
    return slug


def read_page(url, faculty, slug, delay, rows, seen):
    raw = fetch(url, delay)
    if not raw or not re.search(r"Academic Staff|>\s*Staff\s*<", raw): return 0
    ls = lines_of(raw)
    start = next((i for i, l in enumerate(ls) if HEAD.fullmatch(l)), 0)
    dept = dept_of(ls, start, slug)
    people = parse(ls)
    n = 0
    for p in people:
        key = (faculty, dept, re.sub(r"[^a-z]", "", p["name"].lower()))
        if key in seen: continue
        seen.add(key); n += 1
        rows.append({"faculty": faculty, "department": dept, "name": p["name"], "position": p["pos"], "qualifications": "; ".join(q.strip(" ,") for q in p["q"] if q),
                     "research_interests": re.sub(r"\s+", " ", p["ri"]).strip(" ,;"), "pursuing_phd_flag": int(p["leave"]), "page_url": url})
    print(f"{faculty} | {dept}: {n}", flush=True)
    # discipline sub-pages: /slug/academic-staff/<discipline> whose heading reads "Academic Staff - ..."
    for sub in sorted(set(re.findall(r'href="(?:https?://[^"/]*)?/' + re.escape(slug) + r'/academic-staff/([a-z0-9\-]+)"', raw))):
        u2 = url.rstrip("/") + "/" + sub
        r2 = fetch(u2, delay)
        if r2 and re.search(r"Academic Staff - ", html.unescape(re.sub(r"<[^>]+>", " ", r2))):
            read_page(u2, faculty, slug, delay, rows, seen)
    return n


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--delay", type=float, default=1.2); a = ap.parse_args()
    rows, seen = [], set()
    for host, faculty in FACULTIES.items():
        home = fetch(f"http://{host}/", a.delay)
        if not home: print(host, "unavailable"); continue
        cands = set(m for m in re.findall(r'href="(?:https?://[^"/]*)?/([a-z][a-z0-9\-]+)/?"', home) if m not in ("about", "people", "programs", "notice", "publications", "departments", "home", "farm", "censarm", "index", "announcements", "downloads"))
        cands |= set(EXTRA.get(host, []))
        for slug in sorted(cands):
            # nested pages such as /languages/academic-staff/english or /social-sciences/political-science/academic-staff
            dh = fetch(f"http://{host}/{slug}", a.delay) or ""
            for h in sorted(set(re.findall(r'href="(?:https?://[^"/]*)?(/' + re.escape(slug) + r'/[a-z0-9\-/]*academic-staff[a-z0-9\-/]*)"', dh))):
                if h.rstrip("/") != f"/{slug}/academic-staff": read_page(f"http://{host}{h}", faculty, slug, a.delay, rows, seen)
            read_page(f"http://{host}/{slug}/academic-staff", faculty, slug, a.delay, rows, seen)
            if slug in ("delt", "dit", "dict"): read_page(f"http://{host}/{slug}/staff", faculty, slug, a.delay, rows, seen)
            if slug == "computing": read_page(f"http://{host}/{slug}/as", faculty, slug, a.delay, rows, seen)
    # Department of Information and Communication Technology (Faculty of Technology) has only a Head of the Department page:
    # a person already listed on another Technology department page and named as its head moves to that department.
    raw = fetch("http://fot.esn.ac.lk/dict/head", a.delay)
    if raw:
        text = " ".join(lines_of(raw))
        for r in rows:
            if r["faculty"] == "Faculty of Technology":
                given = [t for t in re.sub(r"\(.*?\)|\b(?:Dr|Mrs|Mr|Ms|Prof)\b\.?", " ", r["name"]).split() if len(t) > 3]
                if given and all(t in text for t in given) and "Head of the Department" in text:
                    r["department"] = "Department of Information and Communication Technology"; r["page_url"] = "http://fot.esn.ac.lk/dict/head"
                    print("Faculty of Technology | Department of Information and Communication Technology: head", r["name"], flush=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["faculty", "department", "name", "position", "qualifications", "research_interests", "pursuing_phd_flag", "page_url"]); w.writeheader(); w.writerows(rows)
    print(len(rows), "people ->", OUT)


if __name__ == "__main__":
    main()

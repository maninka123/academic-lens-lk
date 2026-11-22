#!/usr/bin/env python3
"""Read the academic-staff pages of the South Eastern University of Sri Lanka faculties (https://www.seu.ac.lk/<fac>/academic_staff.php).

Each page lists every academic with a name, position, department and a profile link. Politeness: the site's robots.txt only blocks admin
areas; 1.2 s delay, cached in private/collect_cache/seusl. E-mail addresses and telephone numbers are never stored.
Writes (git-ignored) private/collect/seusl_dept_entries.csv in the shared department-entries layout. Instructors, demonstrators and
other non-academic posts are left to the merge step (it skips them); "On study leave" remarks are stripped there as well.
Usage: python3 App/scripts/collect_seusl.py
"""
import csv, hashlib, html, re, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "private/collect_cache/seusl"; CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "private/collect/seusl_dept_entries.csv"
UA = {"User-Agent": "LankaAcademiaResearch/1.0"}
FACS = [("fac", "Faculty of Arts and Culture"), ("fmc", "Faculty of Management and Commerce"), ("fas", "Faculty of Applied Sciences"),
        ("fia", "Faculty of Islamic Studies and Arabic Language"), ("ft", "Faculty of Technology"), ("fe", "Faculty of Engineering")]
DEPT_FIX = {"Department of Economic and Statistics": "Department of Economics and Statistics", "Department of Economic and Statistics ": "Department of Economics and Statistics"}


def fetch(url, delay=1.2):
    cf = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if cf.exists(): return cf.read_text(encoding="utf-8")
    time.sleep(delay)
    try: raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf-8", "ignore")
    except Exception as e:
        print("fetch failed", url, str(e)[:60]); return ""
    cf.write_text(raw, encoding="utf-8"); return raw


def clean(t): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()


def dept_name(i, header):
    x = re.sub(r"^Dept\.? of ", "Department of ", i.strip(), flags=re.I) if i else header
    x = re.sub(r"\s+", " ", x).strip()
    x = re.sub(r"^Department of (?:Dept\.? of )+", "Department of ", x, flags=re.I)
    return DEPT_FIX.get(x, x)


def main():
    rows, seen = [], set()
    for code, fac in FACS:
        url = f"https://www.seu.ac.lk/{code}/academic_staff.php"
        raw = fetch(url)
        if not raw: continue
        title = re.search(r"<title>(.*?)</title>", raw, re.S)
        print(code, fac, len(raw), clean(title.group(1))[:70] if title else "")
        header = ""
        for m in re.finditer(r"<h3 class=\"dept_header\">(.*?)</h3>|<h4 class=\"dept_header_2\">(.*?)</h4>|<p class='prof-name'>(.*?)</p>\s*<p class='prof-desig'>(.*?)</p>.*?href='([^']*)'", raw, re.S):
            if m.group(1) is not None: header = clean(m.group(1)); section = ""; continue
            if m.group(2) is not None: section = clean(m.group(2)); continue
            name = clean(m.group(3)); desig = m.group(4)
            pos = clean(re.search(r"<strong>(.*?)</strong>", desig, re.S).group(1)) if re.search(r"<strong>", desig) else ""
            pos = re.sub(r"\bProcessor\b", "Professor", pos)  # typo on the page
            d_i = re.search(r"<i>(.*?)</i>", desig, re.S); d_i = clean(d_i.group(1)) if d_i else ""
            tail = clean(desig)
            leave = " (On study leave)" if re.search(r"study leave", tail + header, re.I) else ""
            dep = dept_name(d_i, header) if not header.startswith("Dean") else dept_name(d_i, "")
            if re.search(r"universit|school of|no-pay|visiting", dep, re.I): continue  # staff of other institutions or on no-pay leave
            key = (code, name.lower(), dep)
            if key in seen: continue
            seen.add(key)
            prof = m.group(5); purl = "https://www.seu.ac.lk/" + code + "/" + prof if not prof.startswith("http") else prof
            rows.append({"faculty": fac, "department": dep, "name": name + leave, "position": pos, "section": section or header, "qualifications": "", "temporary": "0", "profile_url": purl, "page_url": url})
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["faculty", "department", "name", "position", "section", "qualifications", "temporary", "profile_url", "page_url"]); w.writeheader(); w.writerows(rows)
    import collections
    c = collections.Counter((r["faculty"], r["department"]) for r in rows)
    for k, v in sorted(c.items()): print(v, k)
    print(len(rows), "entries ->", OUT)


if __name__ == "__main__":
    main()

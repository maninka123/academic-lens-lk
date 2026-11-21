#!/usr/bin/env python3
"""Read the individual staff pages of Wayamba University (Faculty of Applied Sciences) for research links, interests and dated qualifications.

Each Faculty of Applied Sciences person has a page (/<dept>-home/staff/<name>/) with a "Google Scholar | LinkedIn | ORCID" link line,
research interests and, for many, dated qualification lines such as "2018 - PhD in Bioinformatics, Central China Normal University,
P.R.China". Writes private/collect/wayamba_profiles.csv (git-ignored): name, profile_url, google_scholar_url, researchgate_url, orcid_url,
interests, phd_year, phd_line. A PhD year is recorded only when the person's own dated line states it. Contact details are never stored.
Polite: robots.txt, 1.2 s delay, cached in private/collect_cache/wayamba_dept.
Usage: python3 App/scripts/collect_wayamba_profiles.py
"""
import csv, html, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import collect_wayamba_departments as W

ROOT = W.ROOT
OUT = ROOT / "private/collect/wayamba_profiles.csv"
DOCTORAL = re.compile(r"\b(?:Ph\.?\s?D|D\.?\s?Sc|D\.?\s?Eng|Doctor of Philosophy|D\.\s?Phil)\b", re.I)


def person_links(raw, host):
    out = {}
    for h, t in re.findall(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', raw, flags=re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", t))).strip()
        if host in h and re.search(r"/staff/[A-Za-z0-9_\-]+/?$", h) and W.TITLE.match(t): out[re.sub(r"[^a-z]", "", t.lower())] = h
    return out


def profile(url):
    raw = W.fetch(url)
    if not raw: return None
    ls = W.lines_of(raw)
    links = [html.unescape(h) for h in re.findall(r'href="([^"]+)"', raw)]
    sc = next((h for h in links if re.search(r"scholar\.google\.[a-z.]+/citations", h)), "")
    rg = next((h for h in links if "researchgate.net/profile" in h), "")
    oc = next((h for h in links if re.search(r"orcid\.org/\d{4}-", h)), "")
    interests = []
    for i, l in enumerate(ls):
        if re.match(r"^(?:Teaching Areas and )?Research Interests?\b", l, re.I):
            for x in ls[i + 1: i + 12]:
                if re.match(r"^(?:Professional|Qualifications|Profile|Publications|Awards|Teaching|Contact|Address|Quick Links|Selected|Research Projects|Memberships)", x, re.I) or len(x) > 120: break
                interests.append(x)
            break
    year, line = "", ""
    for l in ls:
        m = re.match(r"^((?:19|20)\d{2})\s*[–\-—:.]+\s*(.+)$", l)
        if m and DOCTORAL.search(m.group(2)) and not re.search(r"reading|pursuing|candidate|registered", l, re.I):
            year, line = m.group(1), m.group(2).strip(); break
    return {"google_scholar_url": sc, "researchgate_url": rg, "orcid_url": oc, "interests": "; ".join(interests)[:400], "phd_year": year, "phd_line": line}


def main():
    rows = []
    for faculty, dept, url in W.PAGES:
        if "fas.wyb.ac.lk" not in url: continue
        raw = W.fetch(url)
        if not raw: continue
        host = "fas.wyb.ac.lk"
        for key, purl in person_links(raw, host).items():
            p = profile(purl)
            if not p: continue
            nm = next((t for h, t in re.findall(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', raw, flags=re.S) if h == purl and W.TITLE.match(re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", t))).strip())), "")
            nm = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", nm))).strip()
            rows.append({"faculty": faculty, "department": dept, "name": nm, "profile_url": purl, **p})
        print(f"{dept}: {sum(1 for r in rows if r['department'] == dept)} profile pages read", flush=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["faculty", "department", "name", "profile_url", "google_scholar_url", "researchgate_url", "orcid_url", "interests", "phd_year", "phd_line"]); w.writeheader(); w.writerows(rows)
    print(len(rows), "profiles ->", OUT, "| Scholar", sum(1 for r in rows if r["google_scholar_url"]), "| ORCID", sum(1 for r in rows if r["orcid_url"]), "| PhD year", sum(1 for r in rows if r["phd_year"]))


if __name__ == "__main__":
    main()

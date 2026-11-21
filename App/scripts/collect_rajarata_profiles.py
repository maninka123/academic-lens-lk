#!/usr/bin/env python3
"""Read the individual staff pages of Rajarata University for doctoral lines and research links.

Department staff pages (collected by collect_rajarata_departments.py) link to each person's own page. This reads those pages
(polite: robots.txt, 1.2 s delay, cached in private/collect_cache/rajarata_dept) and writes private/collect/rajarata_profiles.csv
(git-ignored): academic_id, name, profile_url, google_scholar_url, researchgate_url, orcid_url, phd_line, phd_university,
phd_country, phd_year. A doctoral line is taken only from a line that starts with the degree (Ph.D./PhD/D.Phil/Doctor of
Philosophy) on the person's own page; a year is kept only when that line states it; reading/pursuing/registered lines are skipped.
A page is matched to a person only when the page name and the staff name share a surname and identical initials, uniquely.
Usage: python3 App/scripts/collect_rajarata_profiles.py
"""
import csv, glob, html, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import collect_rajarata_departments as R

ROOT = R.ROOT
OUT = ROOT / "private/collect/rajarata_profiles.csv"
DOC = re.compile(r"^(?:Ph\.?\s?D\.?|D\.\s?Phil|Doctor of Philosophy|Doctorate)\b", re.I)
SKIP = re.compile(r"reading|pursuing|candidate|registered|following|scholarship|enrolled|ongoing|currently", re.I)
COUNTRIES = {"sri lanka": "Sri Lanka", "japan": "Japan", "australia": "Australia", "china": "China", "p.r. china": "China", "india": "India", "thailand": "Thailand",
             "malaysia": "Malaysia", "united kingdom": "United Kingdom", "uk": "United Kingdom", "usa": "United States", "united states": "United States", "u.s.a.": "United States",
             "canada": "Canada", "germany": "Germany", "new zealand": "New Zealand", "singapore": "Singapore", "south korea": "South Korea", "korea": "South Korea",
             "france": "France", "sweden": "Sweden", "norway": "Norway", "netherlands": "Netherlands", "belgium": "Belgium", "italy": "Italy", "taiwan": "Taiwan",
             "hong kong": "Hong Kong", "denmark": "Denmark", "finland": "Finland", "switzerland": "Switzerland", "austria": "Austria", "russia": "Russia", "pakistan": "Pakistan", "bangladesh": "Bangladesh"}


def key(n):
    toks = [t for t in re.sub(r"[^a-z. ]", " ", re.sub(r"\(.*?\)", "", n.lower())).replace(".", " ").split() if t not in ("dr", "prof", "professor", "mr", "mrs", "ms", "miss", "eng", "chartered", "senior", "snr")]
    return toks


def compat(a, b):
    ta, tb = key(a), key(b)
    if not ta or not tb or ta[-1] != tb[-1]: return False
    ia, ib = [t[0] for t in ta[:-1]], [t[0] for t in tb[:-1]]
    if ia == ib: return True
    # one side may spell out given names the other abbreviates
    return "".join(ia) == "".join(ib)


def parse(raw):
    ls = R.lines_of(raw)
    links = [html.unescape(h) for h in re.findall(r'href="([^"]+)"', raw)]
    sc = next((h for h in links if re.search(r"scholar\.google\.[a-z.]+/citations", h)), "")
    rg = next((h for h in links if "researchgate.net/profile" in h), "")
    oc = next((h for h in links if re.search(r"orcid\.org/\d{4}-", h)), "")
    line = ""
    for l in ls:
        if DOC.match(l) and not SKIP.search(l) and (" – " in l or "," in l or " - " in l): line = l.strip(); break
    t = re.search(r"<title>(.*?)</title>", raw, re.S)
    title = re.sub(r"\s+", " ", html.unescape(t.group(1))).split("|")[0].split(" – ")[0].strip() if t else ""
    return title, sc, rg, oc, line


def split_phd(line):
    year = (re.findall(r"\b(19[6-9]\d|20[0-2]\d)\b", line) or [""])[-1]
    parts = [p.strip(" .") for p in re.split(r"\s[–—-]\s|,", re.sub(r"^(?:Ph\.?\s?D\.?|D\.\s?Phil|Doctor of Philosophy|Doctorate)\s*(?:\([^)]*\))?\s*(?:in|of)?", "", line, flags=re.I)) if p.strip(" .")]
    country = ""
    for p in reversed(parts):
        if p.lower() in COUNTRIES: country = COUNTRIES[p.lower()]; break
    uni = next((p for p in parts if re.search(r"universit|institute|college|school of|academy", p, re.I)), "")
    return uni, country, year


def main():
    staff = {}
    for f in glob.glob(str(ROOT / "Data/Lanka-Academia/universities/rajarata/faculties/**/academics.csv"), recursive=True):
        for r in csv.DictReader(open(f, encoding="utf-8-sig")): staff[r["academic_id"]] = r
    pages = sorted({r["page_url"] for r in csv.DictReader(open(ROOT / "private/collect/rajarata_dept_entries.csv", encoding="utf-8"))})
    rows, seen = [], set()
    for page in pages:
        raw = R.fetch(page)
        if not raw: continue
        host = page.split("/")[2]
        cands = sorted({re.sub(r"[?#].*$", "", h) for h in re.findall(r'href="(https?://' + re.escape(host) + r'/[^"]+)"', raw)})
        cands = [c for c in cands if c.rstrip("/") != page.rstrip("/") and not re.search(r"(staff|academic|contact|downloads|wp-|feed|category|tag|news|events|about|home)", c.split("/", 3)[-1], re.I)]
        for url in cands:
            if url in seen: continue
            seen.add(url)
            raw2 = R.fetch(url)
            if not raw2: continue
            title, sc, rg, oc, line = parse(raw2)
            if not title: continue
            who = [i for i, s in staff.items() if compat(title, s["full_name"])]
            if len(who) != 1: continue
            uni, country, year = split_phd(line) if line else ("", "", "")
            rows.append({"academic_id": who[0], "name": staff[who[0]]["full_name"], "profile_url": url, "google_scholar_url": sc, "researchgate_url": rg, "orcid_url": oc,
                         "phd_line": line, "phd_university": uni, "phd_country": country, "phd_year": year})
        print(page, len(rows), flush=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["academic_id", "name", "profile_url", "google_scholar_url", "researchgate_url", "orcid_url", "phd_line", "phd_university", "phd_country", "phd_year"])
        w.writeheader(); w.writerows(rows)
    print(len(rows), "profiles | PhD lines", sum(1 for r in rows if r["phd_line"]), "| Scholar", sum(1 for r in rows if r["google_scholar_url"]), "| ResearchGate", sum(1 for r in rows if r["researchgate_url"]), "| ORCID", sum(1 for r in rows if r["orcid_url"]))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Collect profile details for University of the Visual and Performing Arts staff from the official vpa.ac.lk member pages.

Staff list pages link each person to https://vpa.ac.lk/Members/<name>/ with labelled sections (Qualifications, Profile,
Research Interests, Publications). This reads those pages and writes private/collect/uvpa_profiles.csv (git-ignored):
academic_id, name, qualifications, research_interests, google_scholar_url, researchgate_url, phd_year_stated, phd_year_sentence, page_url.

A PhD year is recorded only when the person's own text states it next to the doctorate ("Ph.D. from X University (2024)"), never
inferred, and never for in-progress doctorates. Contact details are not stored. Polite: robots.txt, one request at a time, 1.2 s delay,
host dropped on 401/403/429/503, pages cached in private/collect_cache/uvpa.
Usage: python3 App/scripts/collect_uvpa_profiles.py
"""
import csv, glob, hashlib, html, re, time, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Data/Lanka-Academia/universities/uvpa"
CACHE = ROOT / "private/collect_cache/uvpa"; CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "private/collect/uvpa_profiles.csv"
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
last = [0.0]; blocked = [False]
rp = urllib.robotparser.RobotFileParser("https://vpa.ac.lk/robots.txt")
try: rp.read()
except Exception: rp = None


def fetch(url, delay=1.2):
    cf = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if cf.exists(): return cf.read_text(encoding="utf-8") or None
    if blocked[0] or (rp and not rp.can_fetch(UA, url)): return None
    wait = delay - (time.time() - last[0])
    if wait > 0: time.sleep(wait)
    last[0] = time.time()
    try: raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 429, 503): blocked[0] = True
        return None
    except Exception: return None
    cf.write_text(raw, encoding="utf-8"); return raw


def lines_of(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<\s*(?:br|/p|/div|/h\d|/li|/tr)[^>]*>", "\n", raw, flags=re.I)
    return [re.sub(r"\s+", " ", l).strip() for l in html.unescape(re.sub(r"<[^>]+>", " ", raw)).split("\n") if l.strip()]


def norm(s):
    return re.sub(r"[^a-z]", "", re.sub(r"\b(?:mr|mrs|ms|dr|prof|professor|assoc|eng)\b\.?", "", re.sub(r"\(.*?\)", "", s.lower())))


LABELS = ("Qualifications:", "Profile:", "Research Interests:", "Publications:", "Awards:", "Experience:")
IN_PROGRESS = re.compile(r"reading|pursuing|registered|candidate|ongoing|currently|following", re.I)
OTHER_DEGREE = re.compile(r"\b(?:B\.?\s?A|B\.?\s?Sc|M\.?\s?A|M\.?\s?Sc|MPhil|M\.?\s?Phil|BPA|MPA|B\.?\s?Ed|M\.?\s?Ed|Bachelor|Master|Diploma|PGD)\b", re.I)


def section(lines, label):
    for i, l in enumerate(lines):
        if l.startswith(label):
            body = [l[len(label):].strip()]
            for x in lines[i + 1:]:
                if x.endswith(":") and x in LABELS or any(x.startswith(L) for L in LABELS): break
                body.append(x)
            return " ".join(b for b in body if b).strip()
    return ""


def phd_year(text, quals):
    """(year, sentence) when the person's own text states the doctoral year directly beside the doctorate."""
    if IN_PROGRESS.search(quals) and re.search(r"ph\.?\s?d", quals, re.I) and re.search(r"reading|pursuing|registered", quals, re.I): return "", ""
    for sent in re.split(r"(?<=[.])\s+(?=[A-Z])", text):
        for m in re.finditer(r"\bPh\.?\s?D\.?|\bDoctor of Philosophy|\bD\.\s?Phil", sent):
            after = sent[m.end(): m.end() + 140]
            nxt = OTHER_DEGREE.search(after); seg = after[: nxt.start()] if nxt else after
            ym = re.search(r"\((19[5-9]\d|20[0-3]\d)\)|\bin\s+(19[5-9]\d|20[0-3]\d)\b|,\s*(19[5-9]\d|20[0-3]\d)\b", seg)
            if ym and not IN_PROGRESS.search(sent[max(0, m.start() - 60): m.end() + 60]):
                return next(g for g in ym.groups() if g), sent.strip()[:300]
    return "", ""


def main():
    recs = {}
    for f in glob.glob(str(DATA / "faculties/**/academics.csv"), recursive=True):
        for r in csv.DictReader(open(f, encoding="utf-8-sig")): recs[r["academic_id"]] = r
    byname = {}
    for i, r in recs.items(): byname.setdefault(norm(r["full_name"]), []).append(i)
    pages = sorted({r["staff_profile_url"] for r in recs.values() if "vpa.ac.lk" in r["staff_profile_url"]})
    members = {}  # normalised title -> member url
    for pu in pages:
        raw = fetch(pu)
        if not raw: continue
        for m in re.finditer(r'<a[^>]+href="(https://vpa\.ac\.lk/Members/[a-z0-9\-]+/)"[^>]*title="([^"]+)"', raw):
            members.setdefault(norm(html.unescape(m.group(2))), m.group(1))
    print(len(pages), "staff pages;", len(members), "member links", flush=True)
    rows, missing = [], []
    for k, ids in byname.items():
        url = members.get(k)
        if not url: missing.append(recs[ids[0]]["full_name"]); continue
        raw = fetch(url)
        if not raw: continue
        ls = lines_of(raw)
        quals = section(ls, "Qualifications:"); prof = section(ls, "Profile:"); ri = section(ls, "Research Interests:")
        scholar = next(iter(re.findall(r'href="(https?://scholar\.google\.[a-z.]+/citations[^"]+)"', raw)), "")
        rg = next(iter(re.findall(r'href="(https?://www\.researchgate\.net/profile/[^"]+)"', raw)), "")
        yr, sent = phd_year(prof, quals)
        for i in ids:
            rows.append({"academic_id": i, "name": recs[i]["full_name"], "qualifications": quals, "research_interests": ri, "google_scholar_url": scholar, "researchgate_url": rg, "phd_year_stated": yr, "phd_year_sentence": sent, "page_url": url})
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["academic_id", "name", "qualifications", "research_interests", "google_scholar_url", "researchgate_url", "phd_year_stated", "phd_year_sentence", "page_url"]); w.writeheader(); w.writerows(rows)
    print(len(rows), "profiles read;", len(missing), "without a member page:", missing[:15])


if __name__ == "__main__":
    main()

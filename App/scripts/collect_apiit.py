#!/usr/bin/env python3
"""Collect academic staff of APIIT (Asia Pacific Institute of Information Technology, a non-state institution) from https://apiit.lk/staff.

For each school filter (faculty_id=...) the paged listing gives name, position and the start of the qualification line; each person's
/staff-detail/<id> page gives the full qualification text and any public LinkedIn link. Writes private/collect/apiit_entries.csv
(git-ignored); names, positions, qualification text, school and the page URL only, no contact details.
Only lecturing and professorial posts are kept (lecturers, senior lecturers, assistant lecturers, professors, heads of school); administrators,
technicians and support staff are logged in apiit_excluded_posts.csv. Part-time lecturers are not added (employment unresolved), as for other universities.
Polite: robots.txt, 1.2 s delay, host dropped on 401/403/429/503, pages cached in private/collect_cache/apiit.
Usage: python3 App/scripts/collect_apiit.py
"""
import csv, hashlib, html, re, time, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "private/collect_cache/apiit"; CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "private/collect"; OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
SCHOOLS = {"Biomedical+Science": "School of Biomedical Science", "Business": "School of Business", "Computing": "School of Computing", "Engineering": "School of Engineering",
           "Foundation": "Foundation Programmes", "Hospitality+and+Tourism": "School of Hospitality and Tourism", "Law": "School of Law", "Psychology": "School of Psychology",
           "Postgraduate+School": "Postgraduate School", "Kandy+Campus": "Kandy Campus", "Other": "", "Support+Staff": ""}
ACADEMIC = re.compile(r"lecturer|professor|\bhead of\b|\bhod\b|dean", re.I)
last = [0.0]; blocked = [False]
rp = urllib.robotparser.RobotFileParser("https://apiit.lk/robots.txt")
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


def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def items(raw):
    out = []
    for m in re.finditer(r'<h2 class="sub_main_heading[^>]*>(.*?)</h2>\s*<h2 class="sub_heading[^>]*>(.*?)</h2>(.*?)<a href="(https://apiit\.lk/staff-detail/\d+)"', raw, re.S):
        out.append({"name": text(m.group(1)), "position": text(m.group(2)), "snippet": text(m.group(3)), "url": m.group(4)})
    return out


def detail(url):
    raw = fetch(url)
    if not raw: return "", ""
    body = raw[raw.find("What are you looking for?"):] if "What are you looking for?" in raw else raw
    t = text(re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I))
    m = re.search(r"(?:Programmes News Events Contact)\s+(.*?)(?:LinkedIn Profile|email -->|$)", t)
    block = m.group(1) if m else ""
    # block = "<name> <positions...> --> <position> <qualification line>"
    q = block.split("-->")[-1] if "-->" in block else block
    li = next(iter(re.findall(r'href="(https?://(?:www\.)?linkedin\.com/in/[^"]+)"', raw)), "")
    return q.strip(), li


def main():
    rows, skipped, seen = [], [], set()
    for sid, school in SCHOOLS.items():
        page = 1
        while True:
            u = f"https://apiit.lk/staff?faculty_id={sid}" + (f"&page={page}" if page > 1 else "")
            raw = fetch(u)
            if not raw: break
            its = items(raw)
            new = [i for i in its if i["url"] not in seen]
            if not its or not new: break
            for i in new:
                seen.add(i["url"]); q, li = detail(i["url"])
                full = q or i["snippet"]
                # drop the leading position repeated at the start of the detail block, keep qualification text
                pos = i["position"]
                if full.lower().startswith(pos.lower()): full = full[len(pos):].strip()
                rec = {"name": i["name"], "position": pos, "qualifications": full if full else i["snippet"], "faculty": school, "department": "", "page_url": i["url"], "page_title": "APIIT staff"}
                (rows if ACADEMIC.search(pos) and school else skipped).append(rec if ACADEMIC.search(pos) and school else [i["name"], pos, school, i["url"], "not a lecturing or professorial post, or no school listed"])
            print(school or sid, "page", page, len(new), "people", flush=True); page += 1
            if page > 15: break
    with open(OUT / "apiit_entries.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "position", "qualifications", "faculty", "department", "page_url", "page_title"]); w.writeheader(); w.writerows(rows)
    with open(OUT / "apiit_excluded_posts.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["name", "position", "faculty", "page_url", "reason"]); w.writerows(skipped)
    print(len(rows), "kept;", len(skipped), "not added")


if __name__ == "__main__":
    main()

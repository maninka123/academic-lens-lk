"""Read researcher identifiers (ORCID, OpenAlex, Google Scholar) that a person's own official staff page links.

Polite and resumable: honours robots.txt, one request per second per run, identifies itself generically,
and caches results. Output goes to the private, git-ignored `Data/_research_reviews/`.
A page that links several different ORCID iDs is not used (it may list co-authors).

    python scripts/research/staff_page_links.py --fields "Computer Science,Physics" --limit 500
"""
import argparse, csv, datetime, glob, re, sys, time, urllib.robotparser, urllib.parse
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "Data"
OUT = DATA / "_research_reviews" / "staff_page_links.csv"
UA = "LankaAcademia-research-bot/1.0 (public-data academic research; reads one public staff page per person)"
ORCID = re.compile(r"orcid\.org/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])", re.I)
OPENALEX = re.compile(r"openalex\.org/(?:authors/)?(A\d{6,})", re.I)
SCHOLAR = re.compile(r"scholar\.google\.[a-z.]+/citations\?[^\"'\s<>]*?user=([\w-]{12})", re.I)
DOI = re.compile(r"(?:doi\.org/|doi:\s*)(10\.\d{4,9}/[^\s\"'<>,;)]+)", re.I)
FIELDS = ["academic_id", "university", "staff_page", "http_status", "orcid", "openalex", "scholar", "dois", "note", "checked_at"]


def field_of(r):
    unit = f"{r['department']} {r['faculty']}"
    if re.search("physics", r["department"], re.I):
        return "Physics"
    if re.search(r"comput|information technology|software|data science|\bIT\b|informatics", unit, re.I):
        return "Computer Science"
    return ""


def people():
    for f in glob.glob(str(DATA / "universities/*/faculties/**/academics.csv"), recursive=True):
        yield from csv.DictReader(open(f, encoding="utf-8-sig"))


def accepted_ids():
    p = DATA / "international/sri_lanka_openalex_metrics.csv"
    if not p.exists():
        return set()
    return {r["academic_id"] for r in csv.DictReader(open(p, encoding="utf-8-sig"))
            if re.search(r"(^|_)matched(_|$)", r["status"]) and r["openalex_id"]}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fields", default="Computer Science,Physics")
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--university", default="", help="only this university (substring), re-reading pages already done")
    a = ap.parse_args()
    wanted = {x.strip() for x in a.fields.split(",")}
    done = {}
    if OUT.exists():
        done = {r["academic_id"]: r for r in csv.DictReader(open(OUT, encoding="utf-8-sig"))}
    skip = accepted_ids()
    todo = [r for r in people() if field_of(r) in wanted and r["academic_id"] not in skip
            and r["staff_profile_url"]
            and (a.university.lower() in r["university"].lower() if a.university else r["academic_id"] not in done)][: a.limit]
    print(f"{len(todo)} staff pages to read", flush=True)
    robots = {}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out = OUT.with_name("staff_page_links_" + a.university.lower().replace(" ", "_") + ".csv") if a.university else OUT
    new = not out.exists()
    with open(out, "a", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new:
            w.writeheader()
        for i, r in enumerate(todo, 1):
            url = r["staff_profile_url"].strip()
            host = urllib.parse.urlparse(url)
            row = dict(academic_id=r["academic_id"], university=r["university"], staff_page=url, http_status="", orcid="", openalex="", scholar="", dois="", note="", checked_at=datetime.date.today().isoformat())
            try:
                base = f"{host.scheme}://{host.netloc}"
                if base not in robots:
                    rp = urllib.robotparser.RobotFileParser()
                    try:
                        rp.set_url(base + "/robots.txt"); rp.read()
                    except Exception:
                        rp = None
                    robots[base] = rp
                rp = robots[base]
                if rp and not rp.can_fetch(UA, url):
                    row["note"] = "disallowed_by_robots"
                else:
                    resp = requests.get(url, headers={"User-Agent": UA}, timeout=30)
                    row["http_status"] = resp.status_code
                    if resp.ok:
                        text = resp.text
                        orcids = sorted({m.upper() for m in ORCID.findall(text)})
                        oas = sorted({m.upper() for m in OPENALEX.findall(text)})
                        sch = sorted({m for m in SCHOLAR.findall(text)})
                        row["orcid"] = orcids[0] if len(orcids) == 1 else ""
                        row["openalex"] = oas[0] if len(oas) == 1 else ""
                        row["scholar"] = sch[0] if len(sch) == 1 else ""
                        row["dois"] = ";".join(sorted({d.rstrip(".").lower() for d in DOI.findall(text)})[:12])
                        if len(orcids) > 1 or len(oas) > 1:
                            row["note"] = "several_identifiers_not_used"
                    time.sleep(a.delay)
            except requests.exceptions.RequestException as e:
                row["note"] = "request_failed:" + type(e).__name__
            w.writerow(row); f.flush()
            if i % 25 == 0:
                print(f"{i}/{len(todo)}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()

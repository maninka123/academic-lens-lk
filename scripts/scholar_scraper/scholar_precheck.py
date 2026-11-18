#!/usr/bin/env python3
"""Free, polite pre-check of Google Scholar profile links (no API search is spent).

For each person with a Scholar profile link it makes ONE plain request to
https://scholar.google.com/citations?user=<id>&hl=en (a URL robots.txt allows) and records:
  ok       the profile exists; the name and affiliation shown on it are saved
  404      the profile id does not exist (dead or mistyped link)
  blocked  Google answered with a block or consent page (HTTP 429, "unusual traffic", captcha):
           the run stops at once and waits for the next run. Nothing tries to get past a block.
  error    network problem
It also compares the surname on the profile with the record name ("name_mismatch") and the affiliation with the record's
university ("other_institution" = the profile names a different institution, a review flag such as a profile that belongs to someone elsewhere).

Usage: python3 scholar_precheck.py [--uni peradeniya] [--limit 100] [--delay 4]
Writes scripts/New updates/scholar_precheck.csv (git-ignored). It never edits the dataset.
Use the result to (a) skip dead links, (b) send only live, name-matching profiles to the metrics reader,
so API searches are spent only on profiles that exist.
"""
import argparse, csv, glob, html, random, re, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "scripts/New updates/scholar_precheck.csv"
FIELDS = ["academic_id", "full_name", "university", "scholar_id", "result", "profile_name", "affiliation", "name_check", "affiliation_check", "checked_at"]
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
UNI_WORDS = {"peradeniya": ["peradeniya"], "colombo": ["colombo"], "jayewardenepura": ["jayewardenepura", "sjp"], "ruhuna": ["ruhuna"],
             "jaffna": ["jaffna"], "kelaniya": ["kelaniya"], "moratuwa": ["moratuwa"], "kdu": ["kotelawala", "kdu"], "sliit": ["sliit", "information technology"],
             "uwu": ["uva wellassa", "wellassa"], "nsbm": ["nsbm"], "cinec": ["cinec"], "horizon": ["horizon"], "icbt": ["icbt"], "kiu": ["kiu", "kaatsu"]}
TITLES = re.compile(r"^(prof|dr|mr|mrs|ms|miss|ven|rev|eng|snr)\.?\s+", re.I)


def surname_tokens(name):
    t = re.sub(r"[^A-Za-z .'-]", " ", TITLES.sub("", name.strip()))
    return [w.lower() for w in re.split(r"[\s.]+", t) if len(w) > 2]


def check(scholar_id):
    url = f"https://scholar.google.com/citations?user={scholar_id}&hl=en"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    try:
        body = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return ("404" if e.code == 404 else "blocked" if e.code in (429, 403, 503) else "error"), "", ""
    except Exception:
        return "error", "", ""
    if re.search(r"unusual traffic|/sorry/|captcha|consent\.google", body, re.I) and "gsc_prf_in" not in body:
        return "blocked", "", ""
    m = re.search(r'id="gsc_prf_in"[^>]*>([^<]*)', body)
    if not m:
        return "error", "", ""
    aff = re.search(r'class="gsc_prf_il"[^>]*>(.*?)</div>', body, re.S)
    aff_txt = html.unescape(re.sub(r"<[^>]+>", "", aff.group(1))).strip() if aff else ""
    return "ok", html.unescape(m.group(1)).strip(), aff_txt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uni", default="")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--delay", type=float, default=4.0)
    a = ap.parse_args()
    done = set()
    if OUT.exists():
        done = {r["scholar_id"] for r in csv.DictReader(open(OUT, encoding="utf-8-sig")) if r["result"] in ("ok", "404")}
    todo = []
    for f in sorted(glob.glob(str(ROOT / "Data files/universities/**/academics.csv"), recursive=True)):
        uni = f.split("universities/")[1].split("/")[0]
        if a.uni and uni != a.uni:
            continue
        for r in csv.DictReader(open(f, encoding="utf-8-sig")):
            m = re.search(r"user=([\w-]+)", r.get("google_scholar_url", ""))
            if m and m.group(1) not in done:
                todo.append((r, uni, m.group(1)))
    print(len(todo), "profile links to check", flush=True)
    new = not OUT.exists()
    out = OUT.open("a", encoding="utf-8-sig", newline="")
    w = csv.DictWriter(out, fieldnames=FIELDS)
    if new:
        w.writeheader()
    counts = {}
    for r, uni, sid in todo[: a.limit]:
        res, name, aff = check(sid)
        if res == "blocked":
            print("Google is blocking requests; stopping. Run again later.", flush=True)
            break
        check_txt = ""
        if res == "ok":
            toks = surname_tokens(r["full_name"])
            check_txt = "name_ok" if any(t in name.lower() for t in toks) else "name_mismatch"
        words = UNI_WORDS.get(uni, [uni])
        aff_check = "" if res != "ok" else ("uni_match" if any(x in aff.lower() for x in words) else ("other_institution" if re.search(r"univers|institut|college|hospital|school of", aff, re.I) else "uni_not_shown"))
        w.writerow({"academic_id": r["academic_id"], "full_name": r["full_name"], "university": uni, "scholar_id": sid,
                    "result": res, "profile_name": name, "affiliation": aff[:120], "name_check": check_txt, "affiliation_check": aff_check,
                    "checked_at": time.strftime("%Y-%m-%d")})
        out.flush()
        counts[(res, check_txt, aff_check)] = counts.get((res, check_txt, aff_check), 0) + 1
        time.sleep(a.delay + random.uniform(0, 2))
    print(counts)


if __name__ == "__main__":
    sys.exit(main())

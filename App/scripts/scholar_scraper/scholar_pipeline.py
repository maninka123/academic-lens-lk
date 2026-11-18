#!/usr/bin/env python3
"""Google Scholar metrics pipeline: API first, quota first, each profile verified once.

Decided workflow (keep it this way):
  1. API only. SerpApi reads the profile (the free plan allows 250 searches per month).
  2. Quota first. The very first thing the run does is ask SerpApi how many searches are left (a free call).
     If the key is missing or the quota is used up (left <= --reserve), the run stops at once:
     no scraping, no waiting, no retrying. Try again after the monthly reset.
  3. Verify once. Every profile id gets one final outcome in the ledger (scripts/New updates/scholar_ledger.csv)
     and is never checked again unless --recheck-days has passed:
        read_ok          metrics read and written to the results file
        read_zero        profile exists but is empty (all zeros): not stored, not re-read
        dead_404         the profile id does not exist: link is unusable
        name_mismatch    profile name does not match the record: needs a person to confirm, no API search spent
  4. Free checks before spending a search: one plain page request per profile (robots.txt allows /citations?user=)
     finds dead ids and wrong-name profiles. If Google answers with a block, that free check is skipped and the
     API read goes ahead. Nothing here tries to get past a block or a CAPTCHA.
  5. The results file has the same layout as the other metric tools, so
        python3 App/scripts/apply_metric_updates.py "App/scripts/New updates/<run file>.csv"
     applies it (or pass --apply).

Usage:
  python3 App/scripts/scholar_scraper/scholar_pipeline.py --dry-run          # quota and the size of the job
  python3 App/scripts/scholar_scraper/scholar_pipeline.py [--uni peradeniya] [--limit 40] [--reserve 5] [--apply]
The key lives only in the git-ignored scripts/scholar_scraper/.env as SERPAPI_API_KEY.
"""
import argparse, csv, glob, json, os, re, subprocess, sys, time, urllib.request
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.pop("SKIP_SCHOLAR", None)
import enrich_academics as ea  # noqa: E402  (loads .env)
import openalex_scraper as oa  # noqa: E402
import scholar_precheck as pre  # noqa: E402

ROOT = HERE.parents[2]
NEW = ROOT / "App/scripts/New updates"
LEDGER = NEW / "scholar_ledger.csv"
RESULTS = NEW / "scholar_fill_results.csv"
LEDGER_FIELDS = ["academic_id", "scholar_id", "full_name", "status", "checked_at", "note"]
FINAL = {"read_ok", "read_zero", "dead_404", "name_mismatch"}


def quota():
    """Searches left on the SerpApi plan, or None when no key is set. This call is free."""
    key = os.environ.get("SERPAPI_API_KEY", "").strip()
    if not key:
        return None
    d = json.load(urllib.request.urlopen(f"https://serpapi.com/account.json?api_key={key}", timeout=30))
    return int(d.get("plan_searches_left", 0))


def load_ledger():
    led = {}
    if LEDGER.exists():
        for r in csv.DictReader(open(LEDGER, encoding="utf-8-sig")):
            led[r["scholar_id"]] = r
    return led


def fresh(entry, days):
    try:
        return (date.today() - datetime.strptime(entry["checked_at"], "%Y-%m-%d").date()).days < days
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uni", default="")
    ap.add_argument("--limit", type=int, default=250)
    ap.add_argument("--reserve", type=int, default=5, help="searches to leave unused")
    ap.add_argument("--recheck-days", type=int, default=180)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    left = quota()
    if left is None:
        print("No SERPAPI_API_KEY in scripts/scholar_scraper/.env: nothing run. Add the key there to use the API.")
        return 0
    print(f"SerpApi searches left: {left}", flush=True)
    if left <= a.reserve:
        print(f"Quota used up (reserve {a.reserve}): nothing run. Try again after the monthly reset.")
        return 0

    ledger = load_ledger()
    todo = []
    for f in sorted(glob.glob(str(ROOT / "Data/universities/**/academics.csv"), recursive=True)):
        uni = f.split("universities/")[1].split("/")[0]
        if a.uni and uni != a.uni:
            continue
        for r in csv.DictReader(open(f, encoding="utf-8-sig")):
            m = re.search(r"user=([\w-]+)", r.get("google_scholar_url", ""))
            if not m or r["h_index"].strip() or r["total_citations"].strip():
                continue
            e = ledger.get(m.group(1))
            if e and e["status"] in FINAL and fresh(e, a.recheck_days):
                continue
            r["source_file_path"] = f
            r["_uni"], r["_sid"] = uni, m.group(1)
            todo.append(r)
    todo = todo[: min(a.limit, left - a.reserve)]
    print(f"{len(todo)} profiles to verify (never-checked, or older than {a.recheck_days} days).", flush=True)
    if a.dry_run or not todo:
        return 0

    NEW.mkdir(exist_ok=True)
    run_file = NEW / f"scholar_run_{date.today().isoformat()}.csv"
    new_res = not RESULTS.exists()
    res_f = RESULTS.open("a", encoding="utf-8-sig", newline="")
    run_f = run_file.open("a", encoding="utf-8-sig", newline="")
    wres = csv.DictWriter(res_f, fieldnames=ea.NEW_UPDATES_FIELDS, extrasaction="ignore")
    wrun = csv.DictWriter(run_f, fieldnames=ea.NEW_UPDATES_FIELDS, extrasaction="ignore")
    if new_res:
        wres.writeheader()
    if run_f.tell() == 0:
        wrun.writeheader()
    new_led = not LEDGER.exists()
    led_f = LEDGER.open("a", encoding="utf-8-sig", newline="")
    wled = csv.DictWriter(led_f, fieldnames=LEDGER_FIELDS)
    if new_led:
        wled.writeheader()

    def record(r, status, note=""):
        wled.writerow({"academic_id": r["academic_id"], "scholar_id": r["_sid"], "full_name": r["full_name"],
                       "status": status, "checked_at": date.today().isoformat(), "note": note})
        led_f.flush()

    client = oa.OpenAlexClient()
    stats = {}
    spent = 0
    for i, r in enumerate(todo):
        if i % 5 == 0:
            left = quota()
            if left is not None and left <= a.reserve:
                print(f"Quota reached (left {left}); stopping. Results so far are saved.", flush=True)
                break
        # free checks first
        res, name, aff = pre.check(r["_sid"])
        if res == "404":
            record(r, "dead_404", "profile id returns 404")
            stats["dead_404"] = stats.get("dead_404", 0) + 1
            print(f"{i+1}/{len(todo)} dead link: {r['full_name']}", flush=True)
            time.sleep(2)
            continue
        if res == "ok":
            toks = pre.surname_tokens(r["full_name"])
            if toks and not any(t in name.lower() for t in toks):
                record(r, "name_mismatch", f"profile name '{name}'")
                stats["name_mismatch"] = stats.get("name_mismatch", 0) + 1
                print(f"{i+1}/{len(todo)} NAME MISMATCH (needs review): {r['full_name']} vs {name}", flush=True)
                time.sleep(2)
                continue
        # API read: one search
        try:
            u = ea.enrich_record(r, client, use_scholar=True, use_openalex=False)
        except Exception as e:
            print(f"{i+1}/{len(todo)} API error for {r['full_name']}: {str(e)[:90]} (not recorded; will retry next run)", flush=True)
            continue
        spent += 1
        if u.get("platform") == "Google Scholar" and any(str(u.get(k) or "0") not in ("", "0") for k in ("total_citations", "h_index", "total_publications")):
            wres.writerow(u); wrun.writerow(u); res_f.flush(); run_f.flush()
            record(r, "read_ok")
            stats["read_ok"] = stats.get("read_ok", 0) + 1
            print(f"{i+1}/{len(todo)} read: {r['full_name']}", flush=True)
        else:
            record(r, "read_zero", "empty or all-zero profile")
            stats["read_zero"] = stats.get("read_zero", 0) + 1
            print(f"{i+1}/{len(todo)} empty profile: {r['full_name']}", flush=True)
        time.sleep(1)
    for fh in (res_f, run_f, led_f):
        fh.close()
    print("summary:", stats, "| API searches used about", spent, "| left", quota(), flush=True)
    if a.apply and stats.get("read_ok"):
        subprocess.run([sys.executable, str(ROOT / "App/scripts/apply_metric_updates.py"), str(run_file)], cwd=ROOT, check=False)
    else:
        print(f'Apply with: python3 App/scripts/apply_metric_updates.py "{run_file.relative_to(ROOT)}"')
    return 0


if __name__ == "__main__":
    sys.exit(main())

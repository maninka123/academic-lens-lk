"""Apply a metrics export (academic_id, platform, profile_url, total_citations, citations_2021_2025,
h_index, total_publications, y2021..y2025, retrieved_at, disambiguation_method) to the authoritative
academic leaves.

Rules (never invent, never zero-fill):
  * a blank leaf value is filled from the file;
  * a value from the same platform is updated to the newer figure (counts change over time);
  * a value from a different, older snapshot (for example ResearchGate) is replaced only by a non-zero
    figure from Google Scholar or OpenAlex; a new 0 against an old positive is left for review;
  * a Google Scholar value is never overwritten by OpenAlex (no mixing);
  * rows whose profile URL is shared by two different people, or test rows, are skipped and reported.
Every change is logged in change_log.csv and per-field provenance (and the yearly Scholar counts) goes to
research_metric_observations.csv.

Usage: python3 scripts/apply_metric_updates.py "Data files/User updates/newly_updated_academics.csv"
"""
import csv, glob, io, json, re, sys
from collections import Counter, defaultdict

ROOT = "Data files/"
FIELDS = ["total_citations", "citations_2021_2025", "h_index", "total_publications"]
YEARS = ["y2021", "y2022", "y2023", "y2024", "y2025"]


def read(path):
    raw = open(path, "rb").read()
    text = raw.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text))), raw[:3] == b"\xef\xbb\xbf", "\r\n" if "\r\n" in text else "\n"


def write(path, rows, bom, nl, header):
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=header, lineterminator=nl)
    w.writeheader()
    w.writerows(rows)
    open(path, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(out.getvalue())


def append(path, records):
    raw = open(path, "rb").read()
    bom = raw[:3] == b"\xef\xbb\xbf"
    text = raw.decode("utf-8-sig")
    nl = "\r\n" if "\r\n" in text else "\n"
    if not text.endswith("\n"):
        text += nl
    out = io.StringIO()
    csv.writer(out, lineterminator=nl).writerows(records)
    open(path, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(text + out.getvalue())


def main(src):
    updates, _, _ = read(src)
    leaves = {f: read(f) for f in glob.glob(ROOT + "universities/**/academics.csv", recursive=True)}
    index = {}
    for f, (rows, _, _) in leaves.items():
        for r in rows:
            index[r["academic_id"]] = (f, r)
    # A profile URL shared by records of the same person (duplicate listings, study-leave copies, name
    # variants) is fine. Reviewed by hand: these pairs point one profile at two *different* people.
    ambiguous = {"SL-db3c9f7982e9", "SL-faae309a3b85",   # Perera, Dr. M.P. / Perera, Prof. W.L.P. (one OpenAlex author)
                 "SL-b4a241985315", "SL-f6f35579b731"}   # Dr. HRWP Gunathilake (KDU) / Dr. Wijendra Gunathilake (SJP)
    stats = Counter()
    skipped, review = [], []
    log, obs = [], []
    touched = set()
    for u in updates:
        rid = u["academic_id"]
        if rid.startswith("TEST") or rid not in index:
            skipped.append((rid, u["full_name"], "not an academic record in the dataset (test or unknown id)"))
            continue
        if rid in ambiguous:
            skipped.append((rid, u["full_name"], "one profile URL is attached to two different people; not applied until resolved"))
            continue
        f, r = index[rid]
        platform, url, date = u["platform"], u["profile_url"], u["retrieved_at"]
        scholar_owned = "google scholar" in (r["research_metrics_source"] or "").lower() and platform == "OpenAlex"
        old_src = (r["research_metrics_source"] or "")
        for fld in FIELDS:
            new = u[fld].strip()
            if new == "":
                continue
            old = (r[fld] or "").strip()
            action = None
            if old == "":
                action = "fill"
            elif old == new:
                stats["unchanged"] += 1
                stats[f"unchanged:{fld}"] += 1
            elif scholar_owned:
                skipped.append((rid, u["full_name"], f"{fld}: kept Google Scholar value {old} (OpenAlex {new} not mixed in)"))
            elif platform in old_src or old_src == "":
                action = "correct"
            elif re.search(r"researchgate|snapshot|openalex", old_src, re.I) or old_src == "":
                if float(new) == 0 and float(old) > 0:
                    review.append((rid, u["full_name"], fld, old, new, platform))
                else:
                    action = "correct"
            else:
                review.append((rid, u["full_name"], fld, old, new, platform))
            if action:
                r[fld] = new
                touched.add(f)
                stats[action] += 1
                stats[f"{action}:{fld}"] += 1
                log.append([f"METRICS-{rid}-{fld}-{date}", date + "T00:00:00+11:00", "", "", rid, action, fld, old, new,
                            f"{platform} figure from the 2026-10-16 metrics update ({u['disambiguation_method']})", url])
                obs.append([rid, platform, fld, new, url, date, u["disambiguation_method"], "Metrics update 2026-10-16; all-time column, not the rolling 'Since' value."])
        for y in YEARS:
            if u[y].strip() != "":
                obs.append([rid, platform, "citations_" + y[1:], u[y], url, date, u["disambiguation_method"], "Calendar-year citations from the Scholar citation graph."])
                stats["yearly values"] += 1
        # link + provenance housekeeping
        if platform == "Google Scholar" and not r["google_scholar_url"]:
            r["google_scholar_url"] = url
            log.append([f"METRICS-{rid}-google_scholar_url-{date}", date + "T00:00:00+11:00", "", "", rid, "fill", "google_scholar_url", "", url, "Profile link from the metrics update", url])
            stats["scholar links filled"] += 1
            touched.add(f)
        if platform == "Google Scholar" and u["disambiguation_method"] == "official_profile_snapshot" and r["research_lookup_status"] in ("", "searched_no_verified_metrics", "official_scholar_identity_verified"):
            r["research_lookup_status"] = "official_scholar_identity_verified_metrics_retrieved"
        if not r["research_metrics_source"]:
            r["research_metrics_source"] = platform
            r["metrics_source_url"] = r["metrics_source_url"] or url
        elif platform in r["research_metrics_source"] and not r["metrics_source_url"]:
            r["metrics_source_url"] = url
    for f in touched:
        rows, bom, nl = leaves[f]
        write(f, rows, bom, nl, list(rows[0].keys()))
    append(ROOT + "change_log.csv", log)
    append(ROOT + "research_metric_observations.csv", obs)
    summary = dict(stats)
    summary["skipped"] = len(skipped)
    summary["needs review"] = len(review)
    json.dump({"summary": summary, "skipped": skipped, "review": review}, open("/tmp/metric_update_report.json", "w"), indent=1)
    print(json.dumps(summary, indent=1))
    for s in skipped[:12]:
        print("skipped:", s)
    for s in review:
        print("review:", s)


if __name__ == "__main__":
    main(sys.argv[1])

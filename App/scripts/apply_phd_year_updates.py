#!/usr/bin/env python3
"""Apply VERIFIED PhD completion years to the authoritative dataset (Data/Lanka-Academia), with provenance.

Input: a CSV with columns academic_id, phd_year_found, evidence_type, evidence_url, evidence_checked_on (extra columns ignored),
e.g. the filled worklist in the private study. Dry run by default: prints what would change. Use --apply to write.
Rules: the year must be 1950-2026; evidence_type must be official (official_profile, official_cv, thesis_repository, graduation_record,
other_official); evidence_url and a check date are required; an existing different year is never overwritten unless --overwrite.
Each change is logged (private) in Data/Lanka-Academia/change_log.csv. Nothing is inferred and no other field is touched.
Run from the repository root:  python3 App/scripts/apply_phd_year_updates.py <filled_worklist.csv> [--apply] [--overwrite]
"""
import csv, glob, io, re, sys, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parents[2] / "Data" / "Lanka-Academia"
TYPES = {"official_profile", "official_cv", "thesis_repository", "graduation_record", "other_official"}


def read(p):
    raw = open(p, "rb").read(); t = raw.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(t))), raw[:3] == b"\xef\xbb\xbf", "\r\n" if "\r\n" in t else "\n"


def write(p, rows, bom, nl, header):
    o = io.StringIO(); w = csv.DictWriter(o, fieldnames=header, lineterminator=nl); w.writeheader(); w.writerows(rows)
    open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(o.getvalue())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply, overwrite = "--apply" in sys.argv, "--overwrite" in sys.argv
    if not args: sys.exit(__doc__)
    updates = [r for r in csv.DictReader(open(args[0], encoding="utf-8-sig")) if (r.get("phd_year_found") or "").strip()]
    leaves = {f: read(f) for f in glob.glob(str(ROOT / "universities/**/academics.csv"), recursive=True)}
    where = {r["academic_id"]: (f, r) for f, (rows, _, _) in leaves.items() for r in rows}
    log, touched, report = [], set(), {"to_apply": 0, "rejected": 0}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for u in updates:
        rid, y = u["academic_id"].strip(), u["phd_year_found"].strip()
        why = None
        if rid not in where: why = "unknown academic_id"
        elif not re.fullmatch(r"(19[5-9]\d|20[0-2]\d)", y) or int(y) > 2026: why = "year not 1950-2026"
        elif (u.get("evidence_type") or "").strip() not in TYPES: why = "evidence_type is not an official source type"
        elif not re.match(r"https?://", (u.get("evidence_url") or "").strip()): why = "evidence_url missing"
        elif not (u.get("evidence_checked_on") or "").strip(): why = "evidence_checked_on missing"
        else:
            f, r = where[rid]; old = r["phd_completion_year"].strip()
            if old == y: why = "already recorded"
            elif old and not overwrite: why = f"existing year {old} differs (use --overwrite after review)"
            elif r["phd_status"] not in ("listed_completed", "completed") and "doctor" not in r["qualifications"].lower() and "phd" not in r["qualifications"].lower(): why = "no completed doctorate recorded for this person"
        if why:
            report["rejected"] += 1; print(f"rejected {rid}: {why}"); continue
        f, r = where[rid]; old = r["phd_completion_year"].strip(); report["to_apply"] += 1
        print(f"{'apply' if apply else 'would apply'} {rid}: phd_completion_year {old or '(blank)'} -> {y}  [{u['evidence_type']}]")
        r["phd_completion_year"] = y
        note = f"PhD year {y}: {u['evidence_type']} {u['evidence_url'].strip()} (checked {u['evidence_checked_on'].strip()})"
        r["qualification_evidence"] = (r["qualification_evidence"] + "; " if r["qualification_evidence"] else "") + note
        log.append([f"PHDYEAR-{rid}-{y}", now, "", "", rid, "correction" if old else "fill", "phd_completion_year", old, y, "Verified from an official source", u["evidence_url"].strip()])
        touched.add(f)
    if apply:
        for f in touched: rows, bom, nl = leaves[f]; write(f, rows, bom, nl, list(rows[0].keys()))
        p = ROOT / "change_log.csv"; raw = open(p, "rb").read(); bom = raw[:3] == b"\xef\xbb\xbf"; t = raw.decode("utf-8-sig"); nl = "\r\n" if "\r\n" in t else "\n"
        if not t.endswith("\n"): t += nl
        o = io.StringIO(); csv.writer(o, lineterminator=nl).writerows(log)
        open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(t + o.getvalue())
        print("written; now run: cd App && npm run data:import && npm test && npm run check:privacy")
    print(report, "(dry run)" if not apply else "")


main()

#!/usr/bin/env python3
"""Apply VERIFIED general qualification corrections to the authoritative dataset (Data/Lanka-Academia), with provenance.

Input CSV, one row per field change: academic_id, field, new_value, evidence_type, evidence_url, evidence_checked_on
(extra columns ignored). Use new_value __BLANK__ to clear a field. Dry run by default; --apply writes; --overwrite is required
to change a field that already holds a different value.
Allowed fields: phd_completion_year, phd_university, phd_country, phd_status, phd_country_basis, qualifications.
Rules: evidence_type must be an official source (official_profile, official_cv, thesis_repository, graduation_record, other_official);
evidence_url (http/https) and a check date are required; phd_completion_year must be 1950-2026; phd_status must be listed_completed
or in_progress. Nothing is inferred. Each change is logged (private) in Data/Lanka-Academia/change_log.csv, and one provenance note is
appended to qualification_evidence. Study-specific evidence (quotes, attempts) stays in the private study data, not here.
Run from the repository root:  python3 App/scripts/apply_verified_corrections.py <updates.csv> [--apply] [--overwrite]
Then: cd App && npm run data:import && npm test && npm run check:privacy
"""
import csv, glob, io, re, sys, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parents[2] / "Data" / "Lanka-Academia"
TYPES = {"official_profile", "official_cv", "thesis_repository", "graduation_record", "other_official"}
FIELDS = {"phd_completion_year", "phd_university", "phd_country", "phd_status", "phd_country_basis", "qualifications"}
CLEARABLE = {"phd_university", "phd_country", "phd_country_basis", "phd_completion_year"}


def read(p):
    raw = open(p, "rb").read(); t = raw.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(t))), raw[:3] == b"\xef\xbb\xbf", "\r\n" if "\r\n" in t else "\n"


def write(p, rows, bom, nl, header):
    o = io.StringIO(); w = csv.DictWriter(o, fieldnames=header, lineterminator=nl); w.writeheader(); w.writerows(rows)
    open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(o.getvalue())


def problem(u, where, overwrite):
    rid, field, val = u["academic_id"].strip(), (u.get("field") or "").strip(), (u.get("new_value") or "").strip()
    if rid not in where: return "unknown academic_id"
    if field not in FIELDS: return f"field {field!r} is not allowed"
    if (u.get("evidence_type") or "").strip() not in TYPES: return "evidence_type is not an official source type"
    if not re.match(r"https?://", (u.get("evidence_url") or "").strip()): return "evidence_url missing"
    if not (u.get("evidence_checked_on") or "").strip(): return "evidence_checked_on missing"
    if val == "__BLANK__":
        if field not in CLEARABLE: return f"{field} cannot be cleared"
        val = ""
    elif not val: return "new_value empty (use __BLANK__ to clear)"
    if field == "phd_completion_year" and val and (not re.fullmatch(r"(19[5-9]\d|20[0-2]\d)", val) or int(val) > 2026): return "year not 1950-2026"
    if field == "phd_status" and val not in ("listed_completed", "in_progress", "not_listed_on_profile"): return "phd_status must be listed_completed, in_progress or not_listed_on_profile"
    old = where[rid][1][field].strip()
    if old == val: return "already recorded"
    if old and not overwrite: return f"existing value {old!r} differs (use --overwrite after review)"
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply, overwrite = "--apply" in sys.argv, "--overwrite" in sys.argv
    if not args: sys.exit(__doc__)
    ups = list(csv.DictReader(open(args[0], encoding="utf-8-sig")))
    leaves = {f: read(f) for f in glob.glob(str(ROOT / "universities/**/academics.csv"), recursive=True)}
    where = {r["academic_id"]: (f, r) for f, (rows, _, _) in leaves.items() for r in rows}
    log, touched, noted, n_ok, n_bad = [], set(), set(), 0, 0
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for u in ups:
        why = problem(u, where, overwrite)
        if why: n_bad += 1; print(f"rejected {u['academic_id']} {u.get('field')}: {why}"); continue
        rid, field = u["academic_id"].strip(), u["field"].strip(); val = u["new_value"].strip(); val = "" if val == "__BLANK__" else val
        f, r = where[rid]; old = r[field]; n_ok += 1
        print(f"{'apply' if apply else 'would apply'} {rid} {field}: {old!r} -> {val!r}  [{u['evidence_type']}]")
        r[field] = val; touched.add(f)
        if rid not in noted:
            noted.add(rid)
            r["qualification_evidence"] = (r["qualification_evidence"] + "; " if r["qualification_evidence"] else "") + f"Verified {u['evidence_type']} {u['evidence_url'].strip()} (checked {u['evidence_checked_on'].strip()})"
        log.append([f"VERIFIED-{rid}-{field}-{u['evidence_checked_on'].strip()}", now, "", "", rid, "correction" if old else "fill", field, old, val, "Verified from an official source", u["evidence_url"].strip()])
    if apply:
        for f in touched: rows, bom, nl = leaves[f]; write(f, rows, bom, nl, list(rows[0].keys()))
        p = ROOT / "change_log.csv"; raw = open(p, "rb").read(); bom = raw[:3] == b"\xef\xbb\xbf"; t = raw.decode("utf-8-sig"); nl = "\r\n" if "\r\n" in t else "\n"
        if not t.endswith("\n"): t += nl
        o = io.StringIO(); csv.writer(o, lineterminator=nl).writerows(log)
        open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(t + o.getvalue())
        print("written. Next: cd App && npm run data:import && npm test && npm run check:privacy")
    print({"valid": n_ok, "rejected": n_bad}, "" if apply else "(dry run)")


main()

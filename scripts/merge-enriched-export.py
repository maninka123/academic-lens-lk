"""Review a dated editable export against its baseline and current source records.

Dry run by default. --apply writes only reviewed source fields and provenance.
App/reference columns never override source fields. Cached primary pages are
optional corroboration, not a claim that user-supplied platform snapshots were
independently fetched. Reports retain every held change for further review.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "Data files"
DATE = "2026-10-14"
METRICS = {"total_publications", "total_citations", "h_index", "citations_2021_2025",
           "total_q1_journal_publications", "q1_publications_2021_2025"}
DOCTORATE = re.compile(r"\b(?:ph\s*\.?\s*d|d\s*\.?\s*phil|dr\s*\.?\s*eng|doctor of (?:philosophy|engineering))\b", re.I)
ONGOING = re.compile(r"\b(?:reading|pursuing|candidate|ongoing|in progress|following|trainee|honorary)\b", re.I)
HEADINGS = re.compile(r"^(?:key research areas|education and professional affiliations|working experiences|research\s*&\s*publications|research interests?|publications?|education|qualifications?|contact|profile|experience)$", re.I)


def read(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        if any(None in r for r in rows):
            raise ValueError(f"Malformed CSV row: {path}")
        return rows, reader.fieldnames


def write(path, rows, header):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)


def append(path, rows):
    old, header = read(path)
    write(path, old + rows, header)


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()).strip()


def person_tokens(name):
    name = re.sub(r"\([^)]*(?:orcid|study leave)[^)]*\)", " ", name, flags=re.I)
    name = re.sub(r"\b(?:professor|prof|doctor|dr|mr|mrs|ms|miss|senior|snr|chair|capt|ing|phd|mbbs|frcog|frcse|franzcog|fslcog|on study leave)\b", " ", name, flags=re.I)
    name = re.sub(r"\b[A-Z]{2,6}\b", lambda m: " ".join(m[0]), name)
    return norm(name).split()


def compatible(a, b):
    aa, bb = person_tokens(a), person_tokens(b)
    if not aa or not bb:
        return False
    # Long tokens shared by exact spelling, with aligned given-name initials.
    if set(aa) == set(bb):
        return True  # Same full name in reversed order.
    if aa[-1] != bb[-1]:
        return False
    if len(aa) == 1 or len(bb) == 1:
        return aa == bb
    initial_only = all(len(t) == 1 for t in aa[:-1]) or all(len(t) == 1 for t in bb[:-1])
    if initial_only:
        short, full = (aa, bb) if all(len(t) == 1 for t in aa[:-1]) else (bb, aa)
        return all(t[0] in short[:-1] for t in full[:-1])
    # A published name may omit an earlier family name; retain exact spelled
    # given-name overlap rather than expanding initials into invented names.
    return bool(set(t for t in aa[:-1] if len(t) > 1) & set(t for t in bb[:-1] if len(t) > 1))


def profile_key(url):
    u = urlsplit(url)
    if (u.hostname or "").startswith("scholar.google."):
        return "scholar:" + parse_qs(u.query).get("user", [""])[0]
    return (u.hostname or "").removeprefix("www.") + u.path.rstrip("/")


def provider(url):
    host = urlsplit(url).hostname or ""
    return "Google Scholar" if host.startswith("scholar.google.") else "ResearchGate" if host.endswith("researchgate.net") else "OpenAlex" if host.endswith("openalex.org") else ""


def official(url):
    host = urlsplit(url).hostname or ""
    return host.endswith(".ac.lk") or host in {"www.cinec.edu", "www.horizoncampus.edu.lk", "horizoncampus.edu.lk", "www.sliit.lk", "uom.lk"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--sources", type=Path, default=Path("/private/tmp/enriched-source-results.json"))
    args = parser.parse_args()
    saved = ROOT / "reports/enriched-merge-2026-10-14/summary.json"
    if saved.exists():
        previous = json.loads(saved.read_text())
        digest = hashlib.sha256((DATA / "to_user/sri_lankan_academics_enriched.csv").read_bytes()).hexdigest()
        if previous.get("applied") and previous.get("input_sha256") == digest:
            if args.apply:
                raise ValueError("This exact export is already merged; no duplicate writes performed.")
            print(json.dumps({"already_applied": True, "profiles_changed": previous["profiles_changed"],
                              "accepted_field_changes": previous["accepted_field_changes"], "report": str(saved.relative_to(ROOT))}, indent=2))
            return
    enriched, _ = read(DATA / "to_user/sri_lankan_academics_enriched.csv")
    baseline, _ = read(DATA / "to_user/sri_lankan_academics.csv")
    base = {r["academic_id"]: r for r in baseline}
    assert len(base) == len(baseline)
    assert len({r["academic_id"] for r in enriched}) == len(enriched)
    files = {p: read(p) for p in sorted((DATA / "universities").rglob("academics.csv"))}
    current = {}
    paths = {}
    for p, (rows, _) in files.items():
        for r in rows:
            assert r["academic_id"] not in current
            current[r["academic_id"]] = r
            paths[r["academic_id"]] = p
    assert all(r["academic_id"] in current and r["academic_id"] in base for r in enriched)
    original = json.loads(json.dumps(current))
    sources = {r["url"]: r for r in json.loads(args.sources.read_text())} if args.sources.exists() else {}
    identities, _ = read(DATA / "research_identity_evidence.csv")
    approved, _ = read(DATA / "research_identity_matches.csv")
    matched = {r["academic_id"] for r in approved if r["publication_status"] == "approved"}
    lookups, _ = read(DATA / "international/sri_lanka_openalex_metrics.csv")
    oa = {r["academic_id"]: r for r in lookups}
    evidence = defaultdict(list)
    groups = defaultdict(list)
    for r in enriched:
        for key in ["enrichment_evidence", "continuation_evidence"]:
            evidence[r["academic_id"]].extend(json.loads(r.get(key) or "[]"))
        if r["google_scholar_url"]:
            groups[profile_key(r["google_scholar_url"])].append(r)
    decisions = []
    receipts, logs, observations, new_identities = [], [], [], []

    def decide(r, field, value, status, reason, ev=None):
        aid = r["academic_id"]
        old = current[aid][field]
        receipt = ev or {}
        decisions.append({"academic_id": aid, "name": current[aid]["full_name"], "field": field,
                          "old_value": old, "new_value": value, "decision": status, "reason": reason,
                          "source_url": receipt.get("source_url", ""), "observation_date": receipt.get("observed_on", "")})
        if status != "accepted":
            return
        current[aid][field] = value
        date = receipt.get("observed_on") or r.get("enrichment_checked_at") or "2026-10-13"
        receipts.append({"academic_id": aid, "field": field, "value": value, "source_url": receipt.get("source_url", ""),
                         "retrieval_date": date, "verification_basis": "reviewed_user_enriched_export",
                         "notes": "Merged 2026-10-14 by stable ID. User-supplied dated evidence: " + receipt.get("evidence", receipt.get("qualification_excerpt", ""))})
        uid = paths[aid].relative_to(DATA / "universities").parts[0]
        logs.append({"change_id": "ENR-" + hashlib.sha256((aid + field + value).encode()).hexdigest()[:16],
                     "timestamp": DATE + "T00:00:00+11:00", "university_id": uid, "unit_id": "", "academic_id": aid,
                     "action": "enriched_export_merge", "field": field, "old_value": old, "new_value": value,
                     "reason": reason, "source_url": receipt.get("source_url", "")})

    for r in enriched:
        aid = r["academic_id"]
        es = evidence[aid]
        proposed = {k: v.strip() for k, v in r.items() if k in current[aid] and v != base[aid].get(k, "")}
        if r.get("phd_status") in {"completed_documented", "completed", "doctorate_documented_on_official_profile"}:
            proposed["phd_status"] = "listed_completed"
        for field, value in proposed.items():
            old = current[aid][field]
            if old == value:
                continue
            specific = [e for e in es if e.get("field") == field and str(e.get("value", "")).strip() == r.get(field, "").strip()]
            ev = specific[-1] if specific else None
            qev = next((e for e in es if official(e.get("source_url", "")) and (e.get("qualification_excerpt") or e.get("degree_excerpt") or e.get("field") == "qualifications")), None)
            if old != base[aid].get(field, ""):
                decide(r, field, value, "held", "Current source changed after export; preserve newer value", ev)
                continue
            if not value:
                decide(r, field, value, "held", "Blank export value does not erase existing evidence", ev)
                continue
            if field in METRICS:
                if aid in matched and value == oa.get(aid, {}).get(field):
                    decide(r, field, value, "already_available", "Same approved OpenAlex value already supplied to app; avoid relabelling provider", ev)
                    continue
                if not ev or not provider(ev.get("source_url", "")) or not re.fullmatch(r"\d+", value):
                    decide(r, field, value, "held", "Metric lacks exact field/provider receipt or valid integer", ev)
                    continue
                if field in {"total_q1_journal_publications", "q1_publications_2021_2025"}:
                    decide(r, field, value, "held", "Publication-year quartile evidence required", ev)
                    continue
                platform = provider(ev["source_url"])
                expected = r["google_scholar_url"] if platform == "Google Scholar" else r["researchgate_url"] if platform == "ResearchGate" else oa.get(aid, {}).get("openalex_id", "")
                linked = any(e["academic_id"] == aid and profile_key(e["profile_url"]) == profile_key(expected) and e["identity_verification_status"] in {"verified_official_link", "matched_user_supplied_platform_evidence"} for e in identities)
                name_ok = compatible(r["full_name"], r.get("scholar_profile_name", "")) if platform == "Google Scholar" else linked
                if platform == "Google Scholar" and r.get("scholar_profile_name") and not name_ok and not linked:
                    decide(r, field, value, "held", "Displayed Scholar name needs identity review", ev)
                    continue
                if profile_key(ev["source_url"]) != profile_key(expected) or not (linked or name_ok):
                    decide(r, field, value, "held", "Metric profile not independently associated with this academic", ev)
                    continue
                if field == "citations_2021_2025":
                    m = re.search(r"Annual values:\s*(\{.*\})", ev.get("evidence", "").replace('\\"', '"'))
                    annual = json.loads(m[1]) if m else {}
                    if not all(str(y) in annual for y in range(2021, 2026)) or sum(annual[str(y)] for y in range(2021, 2026)) != int(value):
                        decide(r, field, value, "held", "Five explicit annual bars required; rolling Since values/omitted years excluded", ev)
                        continue
                decide(r, field, value, "accepted", "Dated field-specific platform observation supplied by user", ev)
                observations.append({"academic_id": aid, "platform": platform, "metric": field, "value": value,
                                     "source_url": ev["source_url"], "retrieved_at": ev.get("observed_on", "2026-10-13"),
                                     "verification_basis": "reviewed_user_supplied_platform_snapshot",
                                     "notes": ev.get("evidence", "") + " User-provided snapshot; not independently re-fetched in this merge."})
                continue
            if field in {"research_metrics_source", "metrics_source_url", "research_lookup_status", "collected_at", "employment_status", "record_status", "academic_id", "university"}:
                decide(r, field, value, "held", "Metadata derived separately from accepted observations; original dates/employment retained", ev)
                continue
            if field == "research_interests":
                terms = [t.strip() for t in value.split(";") if t.strip() and not HEADINGS.fullmatch(t.strip())]
                value = "; ".join(terms)
                if not value:
                    decide(r, field, r[field], "held", "Page headings are not research interests", ev)
                    continue
            if field.startswith("phd_") or field == "qualification_evidence":
                degree = r.get("qualification_evidence", "") + "; " + r.get("qualifications", "")
                if field != "qualification_evidence" and (not DOCTORATE.search(degree) or ONGOING.search(degree.replace("University of Reading", "University of R."))):
                    decide(r, field, value, "held", "Completed research doctorate not established by qualification text", ev or qev)
                    continue
                ev = ev or qev
                if field == "phd_university":
                    if re.search(r"\b(?:m\.?\s*sc|b\.?\s*sc|master|bachelor)\b", value, re.I):
                        decide(r, field, value, "held", "Proposed awarding institution contains a non-doctoral degree label", ev)
                        continue
                    if not specific and norm(value).replace(" and ", " ") not in norm(degree).replace(" and ", " "):
                        decide(r, field, value, "held", "Doctoral institution absent from supplied degree text; field-specific evidence required", ev)
                        continue
                if field == "phd_status" and value != "listed_completed":
                    decide(r, field, value, "held", "Unrecognised status; preserve existing classification", ev)
                    continue
                if field == "phd_country_basis" and value.startswith("inferred"):
                    value = "inferred_from_institution_name"
                if field == "phd_country" and not specific and not current[aid]["phd_university"]:
                    country_words = {"United States": "usa", "United Kingdom": "uk", "Australia": "aus"}
                    if norm(value) not in norm(degree) and country_words.get(value, "!absent!") not in norm(degree).split():
                        decide(r, field, value, "held", "Doctoral country needs attributable degree wording or a documented awarding institution", ev)
                        continue
                if field == "phd_completion_year" and (not re.fullmatch(r"(?:19|20)\d{2}", value) or int(value) > 2026 or not ev or value not in (ev.get("evidence", "") + degree)):
                    decide(r, field, value, "held", "Year not explicitly attributable to completed doctoral entry", ev)
                    continue
            elif field == "qualifications":
                ev = ev or qev
                if not re.search(r"\b(?:ph\.?d|doctor|b\.?\s*(?:sc|a|eng|com)|m\.?\s*(?:sc|a|phil|ba|d)|bachelor|master|diploma|certificate|degree|llb|llm|mbbs)\b", value, re.I):
                    decide(r, field, value, "held", "No documented qualification token", ev)
                    continue
            if field in {"google_scholar_url", "researchgate_url"}:
                key = profile_key(value)
                if field == "google_scholar_url" and (not key.startswith("scholar:") or not re.fullmatch(r"[A-Za-z0-9_-]{10,}", key.split(":", 1)[1])):
                    decide(r, field, value, "held", "Invalid Scholar profile identifier", ev)
                    continue
                source = sources.get((ev or {}).get("source_url", ""), {})
                linked_now = any(profile_key(link) == key for link in source.get("links", []))
                name_ok = compatible(r["full_name"], r.get("scholar_profile_name", ""))
                existing = any(e["academic_id"] == aid and profile_key(e["profile_url"]) == key and e["identity_verification_status"] in {"verified_official_link", "matched_user_supplied_platform_evidence"} for e in identities)
                if field == "google_scholar_url" and r.get("scholar_profile_name") and not name_ok and not (existing or linked_now):
                    decide(r, field, value, "held", "Scholar display name needs review; avoid misattribution", ev)
                    continue
                if not (existing or (ev and (linked_now or name_ok))):
                    decide(r, field, value, "held", "Link lacks person-specific association evidence", ev)
                    continue
                status = "verified_official_link" if linked_now else "matched_user_supplied_platform_evidence" if name_ok else "recorded_unverified"
                decide(r, field, value, "accepted", "Profile association supported by supplied receipt and official link/displayed name", ev)
                new_identities.append({"academic_id": aid, "platform": "Google Scholar" if field == "google_scholar_url" else "ResearchGate", "profile_url": value,
                                       "source_identifier": key, "official_source_url": (ev or {}).get("source_url", ""), "checked_at": (ev or {}).get("observed_on", "2026-10-13"),
                                       "identity_verification_status": status, "verification_basis": "reviewed_user_enriched_export",
                                       "notes": "User-supplied person-specific receipt; sharing a profile does not merge academic IDs or establish current employment."})
                continue
            if not ev or not official(ev.get("source_url", "")):
                decide(r, field, value, "held", "No field-specific official source receipt", ev)
                continue
            source = sources.get(ev["source_url"], {})
            if field in {"department", "faculty", "academic_position", "research_interests", "full_name"}:
                if field == "department" and (value.startswith("Faculty of ") or value == r["faculty"]):
                    decide(r, field, value, "held", "Faculty label is not a department", ev)
                    continue
                text = norm(source.get("text", ""))
                tokens = norm(value)
                corroborated = tokens in text if tokens else False
                if field == "research_interests":
                    corroborated = all(norm(t) in text for t in value.split(";"))
                if not corroborated:
                    decide(r, field, value, "held", "Official page unavailable or proposed value not corroborated in retrieved text", ev)
                    continue
            decide(r, field, value, "accepted", "Reviewed dated official field receipt" + ("; primary page retrieved" if source.get("status") == 200 else "; supplied snapshot retained, page unavailable"), ev)

    # Derive metric labels from accepted observations only. Preserve unrelated older
    # field observations rather than relabelling every metric as the latest provider.
    for aid in {o["academic_id"] for o in observations}:
        fields = [o for o in observations if o["academic_id"] == aid]
        platforms = sorted({o["platform"] for o in fields})
        unmodified_metrics = any(current[aid][k] and not any(o["metric"] == k for o in fields) for k in METRICS)
        value = "; ".join(platforms) + ("; other metrics retain field-specific provenance" if unmodified_metrics else "")
        ev = {"source_url": fields[0]["source_url"], "observed_on": fields[0]["retrieved_at"], "evidence": "Per-metric provider observations retained in research_metric_observations.csv."}
        for field, v in [("research_metrics_source", value), ("metrics_source_url", fields[0]["source_url"])]:
            if current[aid][field] != v:
                decide(next(r for r in enriched if r["academic_id"] == aid), field, v, "accepted", "Derived from accepted dated per-metric observations", ev)
    accepted = [d for d in decisions if d["decision"] == "accepted"]
    counts = Counter(d["field"] for d in accepted)
    coverage = {k: {"before": sum(bool(r[k]) for r in original.values()), "after": sum(bool(r[k]) for r in current.values())} for k in next(iter(current.values())) if k not in {"academic_id", "notes"}}
    report = {"date": DATE, "applied": args.apply, "input": "Data files/to_user/sri_lankan_academics_enriched.csv",
              "input_sha256": hashlib.sha256((DATA / "to_user/sri_lankan_academics_enriched.csv").read_bytes()).hexdigest(),
              "input_records": len(enriched), "source_records_before": len(original), "source_records_after": len(current),
              "profiles_changed": len({d["academic_id"] for d in accepted}), "accepted_field_changes": len(accepted),
              "filled_missing_fields": sum(not d["old_value"] for d in accepted), "updated_existing_fields": sum(bool(d["old_value"]) for d in accepted),
              "accepted_by_field": dict(counts), "decision_counts": dict(Counter(d["decision"] for d in decisions)),
              "held_by_reason": dict(Counter(d["reason"] for d in decisions if d["decision"] == "held")), "coverage": coverage,
              "official_pages_checked": len(sources), "official_pages_accessible": sum(s.get("status") == 200 for s in sources.values()),
              "metric_observations_added": len(observations), "profile_identity_receipts_added": len(new_identities),
              "shared_scholar_profiles": [{"profile": k, "academic_ids": [r["academic_id"] for r in v]} for k, v in groups.items() if len(v) > 1]}
    if args.apply:
        existing_log, _ = read(DATA / "change_log.csv")
        if any(r["action"] == "enriched_export_merge" for r in existing_log):
            raise ValueError("This enriched export has already been applied; retain the original before/after report.")
        before_summary = ROOT / "reports/enriched-merge-2026-10-14/before-app-summary.json"
        before_summary.write_text((ROOT / "public/data/dataset_summary.json").read_text())
        for p, (rows, header) in files.items():
            if any(current[r["academic_id"]] != original[r["academic_id"]] for r in rows):
                write(p, rows, header)
        append(DATA / "field_evidence.csv", receipts)
        append(DATA / "change_log.csv", logs)
        append(DATA / "research_metric_observations.csv", observations)
        append(DATA / "research_identity_evidence.csv", new_identities)
    out = ROOT / "reports/enriched-merge-2026-10-14"
    out.mkdir(exist_ok=True)
    (out / "summary.json").write_text(json.dumps(report, indent=2) + "\n")
    write(out / "field-decisions.csv", decisions, list(decisions[0]))
    print(json.dumps({k: report[k] for k in ["applied", "input_records", "profiles_changed", "accepted_field_changes", "filled_missing_fields", "accepted_by_field", "decision_counts", "held_by_reason"]}, indent=2))


if __name__ == "__main__":
    main()

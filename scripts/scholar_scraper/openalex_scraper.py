#!/usr/bin/env python3
"""OpenAlex API client and author disambiguation scraper.

Searches and retrieves verified bibliometric profiles from OpenAlex (https://openalex.org)
for Sri Lankan and international researchers. Extracts total works (publications),
total citations, h-index, i10-index, and annual citation counts for 2021-2025.

Install: python -m pip install -r requirements.txt
Run:     python openalex_scraper.py academics.csv --limit 10
Single:  python openalex_scraper.py --search-name "K.P. Hewagamage" --university "University of Colombo"
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.parse

# Try importing dotenv
try:
    from dotenv import load_dotenv
    for env_cand in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parents[1] / ".env"]:
        if env_cand.exists():
            load_dotenv(env_cand)
            break
except ImportError:
    for env_cand in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parents[1] / ".env"]:
        if env_cand.exists():
            try:
                with env_cand.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip())
            except Exception:
                pass

import requests

OPENALEX_API_URL = "https://api.openalex.org"
SELECT_AUTHOR_FIELDS = (
    "id,display_name,display_name_alternatives,works_count,cited_by_count,"
    "summary_stats,counts_by_year,last_known_institutions,affiliations,orcid,topics"
)

# Sri Lankan University OpenAlex Institution IDs
SL_INSTITUTIONS = {
    "colombo": ["I90678064", "I4405259008"],
    "peradeniya": ["I111199411"],
    "jayewardenepura": ["I172828483"],
    "kelaniya": ["I142651801"],
    "moratuwa": ["I195740183"],
    "jaffna": ["I198412587"],
    "ruhuna": ["I128559575"],
    "eastern": ["I2799347585"],
    "south eastern": ["I4210141695"],
    "rajarata": ["I4210137536"],
    "sabaragamuwa": ["I4210135894"],
    "wayamba": ["I4210138927"],
    "uwu": ["I52004705"],
    "uva wellassa": ["I52004705"],
    "open university": ["I188167664"],
    "kdu": ["I197250369"],
    "kotelawala": ["I197250369"],
    "sliit": ["I192365124"],
    "nsbm": ["I4405256374"],
    "cinec": ["I4400064418"],
    "kiu": ["I4405268052"],
    "icbt": ["I4392738302"],
    "gampaha": ["I4405266878"],
}

TITLES_REGEX = re.compile(
    r"^(prof(essor)?|dr|mr|mrs|ms|miss|eng|rev|ven|snr|senior|emeritus|ch\.?eng|capt|cdr|lt|col|brig)\.?\s+",
    re.IGNORECASE
)
STOPWORDS = {
    "department", "of", "faculty", "the", "and", "in", "studies", "center", "centre",
    "school", "division", "unit", "sciences", "science", "university", "technology", "engineering"
}

YEARS = ["2021", "2022", "2023", "2024", "2025"]

OPENALEX_OUTPUT_FIELDS = [
    "oa_status", "oa_id", "oa_url", "oa_display_name", "oa_works_count",
    "oa_cited_by_count", "oa_h_index", "oa_i10_index", "oa_citations_2021_2025",
    "oa_y2021", "oa_y2022", "oa_y2023", "oa_y2024", "oa_y2025",
    "oa_confidence", "oa_match_reason", "oa_retrieved_at"
]


def normalize_text(text: str) -> str:
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s.replace("-", " "))
    return re.sub(r"\s+", " ", s).strip()


def parse_name(full_name: str) -> dict | None:
    s = (full_name or "").strip()
    while TITLES_REGEX.match(s):
        s = TITLES_REGEX.sub("", s)
    s = re.sub(r"\(.*?\)", " ", s)
    parts = re.split(r"[\s.]+", s.replace(",", " "))
    parts = [p for p in parts if p]
    if len(parts) < 2:
        return None

    # Handle composite surnames like "De Silva", "Van Der Bilt"
    sur = [parts[-1]]
    i = len(parts) - 2
    while i >= 0 and parts[i].lower() in ("de", "da", "di", "van", "von", "la", "le", "al"):
        sur.insert(0, parts[i])
        i -= 1
    given = parts[: i + 1]

    initials = []
    for g in given:
        if len(g) <= 3 and g.isupper():
            initials += list(g.lower())
        else:
            initials.append(g.lower())
    return {
        "surname": normalize_text(" ".join(sur)),
        "given": initials,
        "query": normalize_text(" ".join(sur))
    }


def is_compatible(person: dict, display_name: str) -> bool:
    tokens = normalize_text(display_name).split()
    sur_tokens = person["surname"].split()
    if len(tokens) <= len(sur_tokens) or tokens[-len(sur_tokens):] != sur_tokens:
        return False
    cand_given = tokens[: -len(sur_tokens)]
    for idx, g in enumerate(person["given"]):
        if idx >= len(cand_given):
            break
        c = cand_given[idx]
        if len(g) == 1 or len(c) == 1:
            if g[0] != c[0]:
                return False
        elif g != c:
            return False
    return True


def extract_keywords(text: str | None) -> set[str]:
    if not text or not isinstance(text, str):
        return set()
    words = re.findall(r'[a-zA-Z]{3,}', text.lower())
    return {w for w in words if w not in STOPWORDS}


def get_institution_ids_for_university(university_str: str) -> list[str]:
    norm_u = normalize_text(university_str)
    for key, ids in SL_INSTITUTIONS.items():
        if key in norm_u:
            return ids
    return []


class OpenAlexClient:
    def __init__(self, api_key: str | None = None, cache_dir: Path | None = None):
        self.api_key = api_key or os.environ.get("OPENALEX_API_KEY", "").strip()
        self.cache_dir = cache_dir or (Path(__file__).resolve().parent / "scholar_output" / "openalex_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        # Secondary cache from repo_temp if present
        self.alt_cache_dirs = [
            Path(__file__).resolve().parents[1] / "repo_temp" / "scripts" / "baselines" / "_cache" / "openalex"
        ]

    def _cache_path(self, key: str) -> Path:
        return self.cache_dir / f"{key}.json"

    def _get(self, path: str, params: dict, refresh: bool = False) -> dict:
        serialized = path + json.dumps(params, sort_keys=True)
        h = hashlib.sha1(serialized.encode("utf-8")).hexdigest()
        cache_file = self._cache_path(h)

        if not refresh:
            if cache_file.exists():
                try:
                    return json.loads(cache_file.read_text(encoding="utf-8"))
                except Exception:
                    pass
            for ad in self.alt_cache_dirs:
                alt_f = ad / f"{h}.json"
                if alt_f.exists():
                    try:
                        data = json.loads(alt_f.read_text(encoding="utf-8"))
                        cache_file.write_text(json.dumps(data), encoding="utf-8")
                        return data
                    except Exception:
                        pass

        req_params = dict(params)
        if self.api_key:
            req_params["api_key"] = self.api_key

        headers = {"User-Agent": "LankaAcademia/1.0 (https://github.com/maninka123/academic-lens-lk)"}
        url = OPENALEX_API_URL + path

        for attempt in range(4):
            try:
                r = requests.get(url, params=req_params, headers=headers, timeout=40)
            except requests.exceptions.RequestException as e:
                if attempt == 3:
                    raise RuntimeError(f"OpenAlex network error after retries: {e}")
                time.sleep(1.5 * (attempt + 1))
                continue

            if r.status_code == 429:
                retry_after = float(r.headers.get("Retry-After", 2 ** attempt))
                time.sleep(min(retry_after, 30))
                continue
            if r.status_code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            if not r.ok:
                raise RuntimeError(f"OpenAlex HTTP {r.status_code} for {path}")

            data = r.json()
            try:
                cache_file.write_text(json.dumps(data), encoding="utf-8")
            except Exception:
                pass
            return data

        raise RuntimeError(f"OpenAlex request failed for {path}")

    def fetch_author_candidates(self, surname_or_name: str, institution_ids: list[str] | None = None) -> list[dict]:
        terms = [normalize_text(surname_or_name)]
        filters = []
        if institution_ids:
            filters.append(f"affiliations.institution.id:{'|'.join(institution_ids)}")
        filters.append(f"display_name.search:{'|'.join(terms)}")

        params = {
            "filter": ",".join(filters),
            "per-page": 50,
            "page": 1,
            "select": SELECT_AUTHOR_FIELDS
        }
        data = self._get("/authors", params)
        return data.get("results", [])

    def fetch_author_by_id(self, openalex_id: str) -> dict:
        clean_id = openalex_id.split("/")[-1]
        params = {"select": SELECT_AUTHOR_FIELDS}
        return self._get(f"/authors/{clean_id}", params)

    def search_and_disambiguate(
        self,
        full_name: str,
        university: str = "",
        faculty: str = "",
        department: str = "",
        research_interests: str = ""
    ) -> tuple[dict | None, str, int, str]:
        """
        Returns (best_match_candidate_dict, status_str, confidence_score, reason_str).
        """
        person = parse_name(full_name)
        if not person:
            return None, "unparseable_name", 0, "Name has fewer than 2 tokens"

        inst_ids = get_institution_ids_for_university(university)
        candidates = self.fetch_author_candidates(person["surname"], institution_ids=inst_ids)

        if not candidates and inst_ids:
            # Fallback search without institution restriction (author might have moved)
            candidates = self.fetch_author_candidates(person["surname"], institution_ids=None)

        if not candidates:
            return None, "no_candidates_found", 0, "No OpenAlex author matching surname"

        # Disambiguation scoring
        given_initials = [g[0].lower() for g in person["given"]]
        given_full = [g.lower() for g in person["given"] if len(g) > 1]
        dept_kw = extract_keywords(department)
        fac_kw = extract_keywords(faculty)
        int_kw = extract_keywords(research_interests)
        acad_kw = dept_kw | fac_kw | int_kw

        target_insts = set(inst_ids)

        scored = []
        for cand in candidates:
            disp = cand.get("display_name", "")
            alts = cand.get("display_name_alternatives") or []
            all_names = [disp] + alts

            if not any(is_compatible(person, n) for n in all_names):
                continue

            cand_tokens = normalize_text(disp).split()
            cand_initials = [t[0].lower() for t in cand_tokens[:-1]]
            cand_full = [t.lower() for t in cand_tokens[:-1] if len(t) > 1]

            score = 0
            reasons = []

            # 1. Initials matching quality
            if cand_initials == given_initials:
                score += 40
                reasons.append("exact_initials_sequence")
            elif len(given_initials) > 1 and all(gi in cand_initials for gi in given_initials):
                score += 35
                reasons.append("all_initials_present")
            elif len(given_initials) > 1 and len(cand_initials) == 1 and cand_initials[0] == given_initials[0]:
                score += 10
                reasons.append("single_initial_only")
            else:
                score += 15
                reasons.append("partial_initial_match")

            # 2. Full given name agreement
            common_given = set(given_full) & set(cand_full)
            if common_given:
                score += 35
                reasons.append(f"given_name_match:{list(common_given)[0]}")

            # 3. Institutional affiliation
            cand_affil_ids = set()
            for aff in cand.get("affiliations", []) or []:
                inst = aff.get("institution") or {}
                iid = inst.get("id", "").split("/")[-1]
                if iid:
                    cand_affil_ids.add(iid)
            for lk in cand.get("last_known_institutions", []) or []:
                iid = lk.get("id", "").split("/")[-1]
                if iid:
                    cand_affil_ids.add(iid)

            if target_insts and (cand_affil_ids & target_insts):
                score += 40
                reasons.append("verified_institution_match")
            elif any("sri lanka" in (lk.get("country_code", "") or "").lower() or lk.get("country_code") == "LK" for lk in cand.get("last_known_institutions", []) or []):
                score += 20
                reasons.append("sri_lanka_country_match")

            # 4. Department / topic keyword overlap
            cand_topic_words = set()
            for top in cand.get("topics", []) or []:
                cand_topic_words |= extract_keywords(top.get("display_name", ""))
                sub = top.get("subfield") or {}
                cand_topic_words |= extract_keywords(sub.get("display_name", ""))
                field = top.get("field") or {}
                cand_topic_words |= extract_keywords(field.get("display_name", ""))

            overlap = acad_kw & cand_topic_words
            if overlap:
                kw_boost = min(30, len(overlap) * 10)
                score += kw_boost
                reasons.append(f"topic_overlap:{','.join(list(overlap)[:3])}")

            # 5. Outlier sanity check
            works_count = cand.get("works_count", 0)
            if works_count > 2500 and "verified_institution_match" not in reasons:
                score -= 30
                reasons.append("high_volume_homonym_penalty")

            scored.append((score, cand, reasons))

        if not scored:
            return None, "no_compatible_candidates", 0, "No candidates with matching surname + initials"

        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best_cand, best_reasons = scored[0]

        second_score = scored[1][0] if len(scored) > 1 else 0
        diff = best_score - second_score

        is_strong = (
            best_score >= 80 or 
            (best_score >= 60 and "verified_institution_match" in best_reasons and "exact_initials_sequence" in best_reasons)
        )
        if is_strong:
            return best_cand, "approved_high_confidence", best_score, "; ".join(best_reasons)
        elif best_score >= 45:
            return best_cand, "requires_review_medium_confidence", best_score, "; ".join(best_reasons)
        else:
            return best_cand, "rejected_low_confidence", best_score, "; ".join(best_reasons)


def format_openalex_profile(author_data: dict, confidence: str = "high", match_reason: str = "") -> dict:
    if not author_data:
        return {k: "" for k in OPENALEX_OUTPUT_FIELDS}

    oa_id = author_data.get("id", "")
    summary_stats = author_data.get("summary_stats", {}) or {}
    counts_by_year = author_data.get("counts_by_year", []) or []

    yearly_citations = {y: 0 for y in YEARS}
    for item in counts_by_year:
        yr = str(item.get("year", ""))
        if yr in yearly_citations:
            yearly_citations[yr] = item.get("cited_by_count", 0)

    sum_2021_2025 = sum(yearly_citations.values())

    return {
        "oa_status": "ok",
        "oa_id": oa_id,
        "oa_url": oa_id if oa_id.startswith("http") else f"https://openalex.org/{oa_id}",
        "oa_display_name": author_data.get("display_name", ""),
        "oa_works_count": author_data.get("works_count", 0),
        "oa_cited_by_count": author_data.get("cited_by_count", 0),
        "oa_h_index": summary_stats.get("h_index", 0),
        "oa_i10_index": summary_stats.get("i10_index", 0),
        "oa_citations_2021_2025": sum_2021_2025,
        "oa_y2021": yearly_citations["2021"],
        "oa_y2022": yearly_citations["2022"],
        "oa_y2023": yearly_citations["2023"],
        "oa_y2024": yearly_citations["2024"],
        "oa_y2025": yearly_citations["2025"],
        "oa_confidence": confidence,
        "oa_match_reason": match_reason,
        "oa_retrieved_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_csv", nargs="?", type=Path, help="CSV file of academics")
    parser.add_argument("--search-name", help="Single researcher name to search directly")
    parser.add_argument("--university", default="", help="University affiliation for search")
    parser.add_argument("--out", type=Path, default=Path("scholar_output/openalex_enriched.csv"), help="Output enriched CSV")
    parser.add_argument("--limit", type=int, default=50, help="Max rows to process")
    parser.add_argument("--api-key", help="OpenAlex API key (or set OPENALEX_API_KEY in .env)")
    args = parser.parse_args()

    client = OpenAlexClient(api_key=args.api_key)

    if args.search_name:
        print(f"Searching OpenAlex for '{args.search_name}' ({args.university or 'any university'})...")
        cand, status, score, reason = client.search_and_disambiguate(args.search_name, university=args.university)
        if not cand:
            print(f"No match found: {status} ({reason})")
            return 1
        prof = format_openalex_profile(cand, confidence=status, match_reason=reason)
        print("\n--- Match Result ---")
        print(f"Status:       {status} (Score: {score})")
        print(f"Reason:       {reason}")
        print(f"OpenAlex ID:  {prof['oa_id']}")
        print(f"Author Name:  {prof['oa_display_name']}")
        print(f"Works Count:  {prof['oa_works_count']} publications")
        print(f"Citations:    {prof['oa_cited_by_count']} total citations")
        print(f"h-index:      {prof['oa_h_index']}")
        print(f"2021-2025:    {prof['oa_citations_2021_2025']} citations (2021:{prof['oa_y2021']}, 2022:{prof['oa_y2022']}, 2023:{prof['oa_y2023']}, 2024:{prof['oa_y2024']}, 2025:{prof['oa_y2025']})")
        return 0

    if not args.input_csv:
        parser.error("Must specify input_csv or --search-name")

    if not args.input_csv.exists():
        parser.error(f"Input file not found: {args.input_csv}")

    with args.input_csv.open("r", encoding="utf-8-sig") as f:
        reader = list(csv.DictReader(f))
        if not reader:
            print("CSV is empty.")
            return 0
        fieldnames = list(reader[0].keys())

    # Detect name and university columns
    name_col = next((c for c in fieldnames if c.lower() in ("full_name", "name", "academic_name")), fieldnames[0])
    uni_col = next((c for c in fieldnames if "uni" in c.lower()), None)
    fac_col = next((c for c in fieldnames if "fac" in c.lower()), None)
    dept_col = next((c for c in fieldnames if "dept" in c.lower() or "department" in c.lower()), None)

    print(f"Enriching up to {args.limit} rows using columns: name='{name_col}', uni='{uni_col}'...")

    enriched_rows = []
    processed = 0
    matched = 0

    for idx, row in enumerate(reader[:args.limit], start=1):
        full_name = row.get(name_col, "").strip()
        uni = row.get(uni_col, "").strip() if uni_col else ""
        fac = row.get(fac_col, "").strip() if fac_col else ""
        dept = row.get(dept_col, "").strip() if dept_col else ""

        print(f"[{idx}] {full_name} ({uni})...", end=" ", flush=True)
        cand, status, score, reason = client.search_and_disambiguate(full_name, university=uni, faculty=fac, department=dept)
        if cand and "approved" in status:
            prof = format_openalex_profile(cand, confidence=status, match_reason=reason)
            matched += 1
            print(f"MATCH: {prof['oa_display_name']} ({prof['oa_works_count']} works, {prof['oa_cited_by_count']} citations, h={prof['oa_h_index']})")
        else:
            prof = {k: "" for k in OPENALEX_OUTPUT_FIELDS}
            prof["oa_status"] = status
            prof["oa_match_reason"] = reason
            print(f"SKIPPED ({status})")

        out_row = dict(row)
        out_row.update(prof)
        enriched_rows.append(out_row)
        processed += 1
        time.sleep(0.15)

    out_fields = list(dict.fromkeys(fieldnames + OPENALEX_OUTPUT_FIELDS))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=out_fields)
        writer.writeheader()
        writer.writerows(enriched_rows)

    print(f"\nDone! Enriched {processed} records ({matched} matches) saved to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

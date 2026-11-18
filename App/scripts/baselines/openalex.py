"""Small cached OpenAlex client used by the baseline build.

Every response is cached on disk so re-running the build never spends API
credits twice. Set OPENALEX_API_KEY to use a key (raises the daily limit).
"""
import hashlib, json, os, re, time, unicodedata
from pathlib import Path

import requests

CACHE = Path(__file__).resolve().parent / "_cache" / "openalex"
API = "https://api.openalex.org"
SELECT = "id,display_name,display_name_alternatives,works_count,cited_by_count,summary_stats,counts_by_year,last_known_institutions,affiliations,orcid"


class BudgetExhausted(RuntimeError):
    pass


# Credentials are supplied through the environment only. Never read key files.
CACHE_ONLY = os.environ.get("OPENALEX_CACHE_ONLY") == "1"


def _redact(text):
    k = os.environ.get("OPENALEX_API_KEY")
    return text.replace(k, "[redacted]") if k else text


def _get(path, params, refresh=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()
    f = CACHE / f"{key}.json"
    if f.exists() and not refresh:
        return json.loads(f.read_text())
    if CACHE_ONLY:
        raise BudgetExhausted("No cached response available (offline mode)")
    if os.environ.get("OPENALEX_API_KEY"):
        params = {**params, "api_key": os.environ["OPENALEX_API_KEY"]}
    for attempt in range(4):
        try:
            r = requests.get(API + path, params=params, timeout=90)
        except requests.exceptions.RequestException:
            time.sleep(5 * (attempt + 1))
            continue
        if r.status_code == 429:
            if attempt < 3:
                try: delay = min(30, max(1, float(r.headers.get("Retry-After", 2 ** attempt))))
                except ValueError: delay = 2 ** attempt
                time.sleep(delay)
                continue
            raise BudgetExhausted("OpenAlex rate limit; retry later. Checkpoints preserved.")
        if r.status_code >= 500:
            time.sleep(3 * (attempt + 1))
            continue
        if not r.ok:
            # Never echo the request URL: it carries the API key.
            raise RuntimeError(f"OpenAlex HTTP {r.status_code} for {path}: {_redact(r.text[:200])}")
        data = r.json()
        f.write_text(json.dumps(data))
        time.sleep(0.2)
        return data
    raise RuntimeError(f"OpenAlex request failed after retries: {path}")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z ]+", " ", s.replace("-", " "))
    return re.sub(r"\s+", " ", s).strip()


def search_value(name):
    """A display_name.search term: ascii, no punctuation OpenAlex treats specially."""
    return norm(name)


def institutions(names):
    data = _get("/institutions", {"filter": "display_name.search:" + "|".join(search_value(n) for n in names),
                                  "per-page": 200, "select": "id,display_name,country_code,works_count,ror"})
    return data["results"]


def authors(inst_ids, names):
    """All authors affiliated (ever) with any of inst_ids whose name matches any of names."""
    out, page = [], 1
    terms = sorted({search_value(n) for n in names if search_value(n)})
    while True:
        data = _get("/authors", {"filter": f"affiliations.institution.id:{'|'.join(inst_ids)},"
                                           f"display_name.search:{'|'.join(terms)}",
                                 "per-page": 200, "page": page, "select": SELECT})
        out += data["results"]
        if page * 200 >= data["meta"]["count"] or page >= 5:
            return out
        page += 1

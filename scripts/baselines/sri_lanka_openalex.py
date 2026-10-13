"""OpenAlex metrics for Sri Lankan academics, for like-for-like comparison with
the international baselines. Writes Data files/international/sri_lanka_openalex_metrics.csv.
The authoritative Sri Lankan academic CSVs are NOT modified.

Sri Lankan directory names are often initials + surname ("H.L. De Silva"). A
candidate must share the full surname and agree with every published initial;
ambiguous matches are left blank, as in the baseline build.
"""
import csv, glob, re, sys, shutil
from collections import defaultdict
from pathlib import Path

import openalex as oa
from build_international import metrics

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Data files"
TITLES = r"^(prof(essor)?|dr|mr|mrs|ms|miss|eng|rev|ven|snr|senior|emeritus|ch\.?eng|capt|cdr|lt|col|brig)\.?\s+"
SL_INST = {
    "colombo": ["I90678064", "I4405259008"], "peradeniya": ["I111199411"], "jayewardenepura": ["I172828483"],
    "kelaniya": ["I142651801"], "moratuwa": ["I195740183"], "jaffna": ["I198412587"], "ruhuna": ["I128559575"],
    "kdu": ["I197250369"], "sliit": ["I192365124"], "nsbm": ["I4405256374"], "cinec": ["I4400064418"],
    "kiu": ["I4405268052"],
    "icbt": ["I4392738302"],
    "uwu": ["I52004705"],
}


def parse_name(full):
    s = full.strip()
    while re.match(TITLES, s, re.I):
        s = re.sub(TITLES, "", s, flags=re.I)
    s = re.sub(r"\(.*?\)", " ", s)
    parts = re.split(r"[\s.]+", s.replace(",", " "))
    parts = [p for p in parts if p]
    if len(parts) < 2:
        return None
    # Surname = trailing full words (handles "De Silva", "Wijesinghe"); given = the rest.
    sur = [parts[-1]]
    i = len(parts) - 2
    while i >= 0 and parts[i].lower() in ("de", "da", "di", "van", "von", "la", "le"):
        sur.insert(0, parts[i]); i -= 1
    given = parts[: i + 1]
    initials = []
    for g in given:
        if len(g) <= 3 and g.isupper():
            initials += list(g.lower())  # "HL" or "H"
        else:
            initials.append(g.lower())   # full given name
    return {"surname": oa.norm(" ".join(sur)), "given": initials, "query": oa.norm(" ".join(sur))}


def compatible(person, display):
    t = oa.norm(display).split()
    st = person["surname"].split()
    if len(t) <= len(st) or t[-len(st):] != st:
        return False
    cand = t[: -len(st)]
    for i, g in enumerate(person["given"]):
        if i >= len(cand):
            break  # candidate omits a later initial: still compatible
        c = cand[i]
        if len(g) == 1 or len(c) == 1:
            if g[0] != c[0]:
                return False
        elif g != c:
            return False
    return True


def main():
    # Keep the historical entry point; resolution is now evidence-driven and retryable.
    sys.path.insert(0, str(ROOT / "scripts" / "research"))
    from resolve_openalex import main as resolve_main
    resolve_main()


if __name__ == "__main__":
    main()

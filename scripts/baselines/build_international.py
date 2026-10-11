"""Build the international baseline dataset under Data files/international/.

Inputs : scripts/baselines/baselines_config.json
         Data files/international/_source_rosters/<uni>__<cs|physics>.txt
Outputs: Data files/international/<country>/universities/<uni>/faculties[.csv|/...]/academics.csv
         Data files/international/{universities,departments,qs_rankings_2027,openalex_matches}.csv

Roster line format: name | position | url | interests-or-unit | scholar | phd-text | native-name
Usage: python build_international.py [--no-profiles] [--no-openalex]
"""
import csv, hashlib, json, re, sys, time, unicodedata
from collections import defaultdict
from pathlib import Path

import requests
from bs4 import BeautifulSoup

import openalex as oa

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Data files"
OUT = DATA / "international"
ROSTERS = OUT / "_source_rosters"
CFG = json.loads((Path(__file__).parent / "baselines_config.json").read_text())
CACHE = Path(__file__).parent / "_cache"
COLLECTED = "2026-10-11"
SAMPLE_MAX = 25
FIELD = {"cs": "Computer Science", "physics": "Physics"}

HEADER = ("academic_id,full_name,university,faculty,department,academic_position,qualifications,phd_university,"
          "phd_country,phd_completion_year,teaching_academic_experience_years,research_interests,total_publications,"
          "total_citations,citations_2021_2025,h_index,total_q1_journal_publications,q1_publications_2021_2025,"
          "staff_profile_url,google_scholar_url,researchgate_url,research_metrics_source,metrics_source_url,"
          "collected_at,employment_status,record_status,research_lookup_status,phd_status,phd_country_basis,"
          "qualification_evidence,experience_evidence,notes").split(",")

INST = {
    "mit": ["I63966007"], "stanford": ["I97018004"], "iastate": ["I173911158"], "kstate": ["I189590672"],
    "stonybrook": ["I59553526"], "binghamton": ["I123946342"],
    "unsw": ["I31746571"], "anu": ["I118347636"], "murdoch": ["I176790772"], "cdu": ["I29894533"],
    "unisc": ["I174025329"],
    "pku": ["I20231570"], "tsinghua": ["I99065089"], "jilin": ["I194450716"], "uestc": ["I150229711"],
    "ningbo": ["I109935558"], "nwu": ["I37802460"],
    "iitd": ["I68891433"], "iitb": ["I162827531"], "iitbhu": ["I56404289"], "iiti": ["I64295750"],
    "panjab": ["I51452335"], "iitbbs": ["I99729588"],
    "mcgill": ["I5023651"], "toronto": ["I185261750"], "concordia": ["I60158472"], "windsor": ["I74413500"],
    "regina": ["I194028371"], "sherbrooke": ["I135117807"],
    "psl": ["I29607241", "I2746051580"], "ippar": ["I142476485", "I4210145102"], "bordeaux": ["I15057530"],
    "strasbourg": ["I68947357"], "ubo": ["I161929037", "I4405260085"], "cyu": ["I4210142324", "I4387155829"],
    "tum": ["I62916508"], "lmu": ["I8204097"], "bayreuth": ["I54009628"], "wuerzburg": ["I25974101"],
    "chemnitz": ["I2610724"], "wuppertal": ["I167360494"],
}

EXCLUDE = re.compile(r"visiting|adjunct|courtesy|emerit|émérite|honorary|honorar|postdoc|工程师|实验师|"
                     r"\bstudent\b|research associate", re.I)

# Country of doctoral institution, from keywords in the PhD text (conservative; blank when unknown).
PHD_COUNTRY = [
    (r"\bIIT\b|Indian Institute|IISc|Bombay|Delhi|Kanpur|Kharagpur|Madras|Roorkee|Guwahati|Hyderabad|Jadavpur|"
     r"Calcutta|Panjab|Banaras|BHU|Anna University|Pune|Mumbai|RGPV|NIT |Bhopal|Allahabad|Lucknow|Rajasthan|"
     r"Jawaharlal|Aligarh|Osmania|Andhra|Mysore|Bangalore|Bengaluru|Chennai|Kolkata|Tata Institute|TIFR", "India"),
    (r"Tsinghua|Peking|Beijing|Shanghai|Zhejiang|Fudan|Nanjing|Wuhan|Harbin|Xi'?an|Sichuan|Chengdu|Jilin|"
     r"Sun Yat|Tianjin|Shandong|Chinese Academy|USTC|Hefei|清华|北京|中国科学|浙江|复旦|南京|吉林|西北|上海|武汉|哈尔滨|西安|四川|电子科技|国防科技", "China"),
    (r"Stanford|MIT\b|Massachusetts|Harvard|Berkeley|California|Caltech|Princeton|Yale|Cornell|Columbia|Chicago|"
     r"Michigan|Illinois|Wisconsin|Carnegie|Texas|Washington|Purdue|Maryland|Pennsylvania|Georgia Tech|Virginia|"
     r"Ohio|Minnesota|Florida|Arizona|Rutgers|Brown|Duke|Northwestern|UCLA|UCSD|Boston|Iowa|Kansas|New York|"
     r"Johns Hopkins|Rice|Utah|Colorado|Oregon|Indiana|Stony Brook|Binghamton|NYU|Syracuse|Notre Dame|Vanderbilt|"
     r"Delaware|Pittsburgh|Tennessee|Kentucky|Missouri|Nebraska|Oklahoma|Louisiana|Alabama|Clemson|Tufts|"
     r"Dartmouth|Emory|Georgetown|Northeastern|Drexel|Lehigh|Rochester|Buffalo|Albany|Houston|Arkansas|"
     r"Connecticut|Massachusetts|Dayton|Case Western|Penn State|SUNY|UC ", "United States"),
    (r"Toronto|McGill|British Columbia|Waterloo|Alberta|Montr[ée]al|Laval|Ottawa|Queen's|McMaster|Concordia|"
     r"Sherbrooke|Calgary|Manitoba|Saskatchewan|Western Ontario|Simon Fraser|Windsor|Regina|Toronto Metropolitan", "Canada"),
    (r"Oxford|Cambridge|Imperial College|UCL|University College London|Edinburgh|Manchester|Bristol|Warwick|"
     r"Glasgow|King's College|Southampton|Leeds|Sheffield|Birmingham|Nottingham|Durham|St Andrews", "United Kingdom"),
    (r"Paris|Sorbonne|Grenoble|Lyon|Toulouse|Bordeaux|Strasbourg|Lille|Marseille|Montpellier|Nantes|Rennes|"
     r"Orsay|Saclay|Polytechnique|ENS\b|École|Ecole|Universit[ée] (de|Pierre|Joseph|Claude)|INRIA|CNRS|"
     r"Brest|Bretagne|Cergy|Nice|Lorraine|Nancy|Franche|Doctorat X", "France"),
    (r"München|Munich|TUM\b|Heidelberg|Berlin|Bonn|Göttingen|Hamburg|Karlsruhe|Aachen|RWTH|Stuttgart|Dresden|"
     r"Freiburg|Max[- ]Planck|Frankfurt|Köln|Cologne|Leipzig|Würzburg|Erlangen|Tübingen|Mainz|Bayreuth|"
     r"Chemnitz|Wuppertal|Duisburg|Saarland|Kiel|Jena|Dortmund|Bochum|Darmstadt|Hannover|Bremen|Münster", "Germany"),
    (r"Sydney|Melbourne|Monash|Queensland|UNSW|New South Wales|Australian National|ANU|Adelaide|Western Australia|"
     r"Macquarie|Griffith|Deakin|RMIT|Curtin|Wollongong|Newcastle|La Trobe|Murdoch|Tasmania|Swinburne|"
     r"Sunshine Coast|Charles Darwin|James Cook", "Australia"),
    (r"ETH|EPFL|Lausanne|Zurich|Zürich|Geneva|Basel|Bern", "Switzerland"),
    (r"Tokyo|Kyoto|Osaka|Tohoku|Nagoya|Japan", "Japan"),
    (r"Seoul|KAIST|POSTECH|Korea", "South Korea"),
    (r"Singapore|NUS\b|Nanyang", "Singapore"),
    (r"Hong Kong|HKUST", "Hong Kong"),
    (r"Delft|Amsterdam|Leiden|Utrecht|Eindhoven|Twente|Groningen", "Netherlands"),
    (r"Rome|Roma|Milan|Milano|Padova|Bologna|Pisa|Torino|Turin|Trieste|SISSA|Napoli|Naples|Sapienza", "Italy"),
    (r"Madrid|Barcelona|Valencia|Granada|Spain", "Spain"),
    (r"Moscow|Saint Petersburg|St\.? Petersburg|Novosibirsk|MIPT|Russia", "Russia"),
    (r"Tehran|Sharif|Iran|Isfahan|Amirkabir|Shiraz", "Iran"),
    (r"Colombo|Peradeniya|Moratuwa|Sri Lanka|Kelaniya|Jayewardenepura|Ruhuna", "Sri Lanka"),
    (r"Liège|Liege|Leuven|Ghent|Gent|Bruxelles|Brussels", "Belgium"),
    (r"Vienna|Wien|Graz|Innsbruck|Linz", "Austria"),
    (r"Technion|Hebrew University|Tel Aviv|Weizmann|Israel", "Israel"),
    (r"Copenhagen|Aarhus|Denmark|DTU", "Denmark"),
    (r"Stockholm|KTH|Uppsala|Lund|Chalmers|Gothenburg", "Sweden"),
]
INST_RE = re.compile(r"((?:[A-Z][\w'’.&-]*\s+){0,6}(?:University|Universit[éäa]t?|Universidad|Università|Institute|"
                     r"Institut|College|École|Ecole|Polytechnique|ETH|EPFL|MIT|Caltech|Technion|KAIST|IISc|Academy)"
                     r"(?:\s+(?:of|de|du|für|for|di|and|&)?\s*[A-Z][\w'’.-]*){0,6})")


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def parse_roster(path):
    head, rows = "", []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            head += line[1:].strip() + " "
            continue
        if not line.strip():
            continue
        p = [x.strip() for x in line.split("|")] + [""] * 7
        rows.append(dict(name=p[0], position=p[1], url=p[2], extra=p[3], scholar=p[4], phd=p[5], native=p[6]))
    return head.strip(), rows


def systematic(rows, k=SAMPLE_MAX):
    if len(rows) <= k:
        return rows
    return [rows[int(i * len(rows) / k)] for i in range(k)]


def phd_from_text(txt):
    """Return (phd_university, phd_year, evidence) from a doctoral statement."""
    if not txt:
        return "", "", ""
    m = re.search(r"(Ph\.?\s?D\.?|Doctorat|Doctorate|D\.?Phil|Dr\.\s?rer\.\s?nat|博士)[^\n]{0,220}", txt)
    if not m:
        return "", "", ""
    ev = re.sub(r"\s+", " ", m.group(0))[:240]
    inst = INST_RE.search(ev)
    yr = re.search(r"\b(19[5-9]\d|20[0-2]\d)\b", ev)
    name = inst.group(1).strip(" ,.;") if inst else ""
    name = re.sub(r"^(Ph\.?\s?D\.?|Doctorat|Doctorate|PhD)\s*(in [A-Z][\w ]+?,\s*)?(from|at|de|du|,)?\s*", "", name).strip(" ,.;")
    if re.fullmatch(r"(l['’])?[ÉE]cole", name):
        m2 = re.search(r"([ÉE]cole [\w'’ -]+?)(,|$| HDR)", ev)
        name = m2.group(1).strip() if m2 else name
    return name, (yr.group(1) if yr else ""), ev


def phd_country(text):
    for pat, c in PHD_COUNTRY:
        if re.search(pat, text or ""):
            return c
    return ""


def fetch_profile_phd(url, session):
    """Fetch an individual profile page and extract its doctoral statement (cached)."""
    if not url or not re.match(r"https?://", url):
        return ""
    key = hashlib.sha1(url.encode()).hexdigest()
    f = CACHE / "profiles" / f"{key}.txt"
    if f.exists():
        return f.read_text()
    f.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = session.get(url, timeout=12, verify=False)
        r.encoding = r.apparent_encoding if r.encoding in (None, "ISO-8859-1") else r.encoding
        text = BeautifulSoup(r.text, "html.parser").get_text("\n", strip=True) if r.ok else ""
    except Exception:
        text = ""
    m = re.search(r"[^\n]{0,80}(Ph\.?\s?D\.?|Doctorat|Doctorate|D\.Phil|Dr\. rer\. nat|博士学位|博士研究生)[^\n]{0,200}", text)
    out = m.group(0) if m else ""
    f.write_text(out)
    return out


def name_key(name):
    t = oa.norm(name).split()
    return t


def match(person, cands):
    """Pick the OpenAlex author for a roster person. Returns (author|None, status, n_candidates)."""
    pt = name_key(person["name"])
    if len(pt) < 2:
        return None, "openalex_not_searched_single_name", 0
    pfirst, plast = pt[0], pt[-1]
    hits = []
    for a in cands:
        primary = name_key(a["display_name"])
        if [t for t in primary if t not in pt and len(t) > 1 and not any(t in q or q in t for q in pt)] \
                and "".join(primary) != "".join(pt):
            continue  # primary name has another full given name: different person or merged profile
        names = [a["display_name"]] + (a.get("display_name_alternatives") or [])
        for n in names:
            at = name_key(n)
            if len(at) < 2:
                continue
            joined_p, joined_a = "".join(pt), "".join(at)
            same_last = at[-1] == plast or at[0] == plast and at[-1] == pfirst  # allow surname-first order
            first_ok = at[0] == pfirst or (len(at[0]) == 1 and at[0] == pfirst[0]) or at[0][0] == pfirst[0] and \
                (at[0].startswith(pfirst) or pfirst.startswith(at[0]))
            extra = [t for t in at if t not in pt and len(t) > 1 and not any(t in q or q in t for q in pt)]
            if extra and not (joined_a == joined_p):
                continue  # candidate carries an additional full given name: a different person or merged profile
            if (same_last and first_ok) or joined_a == joined_p or sorted(at) == sorted(pt):
                hits.append(a)
                break
    if not hits:
        return None, "openalex_no_name_match_at_institution", 0
    hits.sort(key=lambda a: a["works_count"], reverse=True)
    top = hits[0]
    if len(hits) > 1:
        sec = hits[1]["works_count"]
        if (sec >= 15 and sec >= 0.35 * top["works_count"]) or (len(hits) >= 3 and sec >= 10 and sec >= 0.1 * top["works_count"]):
            return None, "openalex_multiple_candidates_requires_review", len(hits)
    if top["works_count"] > 1500:
        return None, "openalex_implausible_merged_profile_requires_review", len(hits)
    return top, "openalex_matched_name_and_institution", len(hits)


def metrics(a):
    years = {c["year"]: c["cited_by_count"] for c in a.get("counts_by_year") or []}
    return dict(total_publications=a["works_count"], total_citations=a["cited_by_count"],
                h_index=(a.get("summary_stats") or {}).get("h_index", ""),
                citations_2021_2025=sum(years.get(y, 0) for y in range(2021, 2026)))


def main():
    use_profiles = "--no-profiles" not in sys.argv
    use_oa = "--no-openalex" not in sys.argv
    requests.packages.urllib3.disable_warnings()
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"

    uni_rows, dept_rows, match_rows = [], [], []
    for u in CFG["universities"]:
        cslug = slugify(u["country"])
        base = OUT / cslug / "universities" / u["id"]
        people = []  # (dept_key, faculty, department, person)
        for key, (faculty, department) in u["departments"].items():
            path = ROSTERS / f"{u['id']}__{key}.txt"
            if not path.exists():
                continue
            head, rows = parse_roster(path)
            eligible = [r for r in rows if not EXCLUDE.search(r["position"] + " " + r["name"])]
            sample = systematic(eligible)
            dept_rows.append(dict(university_id=u["id"], country=u["country"], tier=u["tier"], faculty=faculty,
                                  department=department, field=FIELD[key], roster_file=f"_source_rosters/{path.name}",
                                  roster_eligible=len(eligible), sampled=len(sample), source_note=head))
            people += [(key, faculty, department, p) for p in sample]

        # OpenAlex: one batched query per university (cached).
        cands = []
        if use_oa:
            try:
                cands = oa.authors(INST[u["id"]], [p["name"] for *_, p in people])
            except oa.BudgetExhausted as e:
                print("OpenAlex budget exhausted; rerun later with OPENALEX_API_KEY set.", e)
                use_oa = False

        if use_profiles:
            from concurrent.futures import ThreadPoolExecutor
            todo = list({p["url"] for *_, p in people if not p["phd"] and p["url"]})
            with ThreadPoolExecutor(12) as ex:
                list(ex.map(lambda url: fetch_profile_phd(url, session), todo))

        by_dept = defaultdict(list)
        for key, faculty, department, p in people:
            aid = "INT-" + hashlib.sha1(f"{u['id']}|{key}|{p['name']}".encode()).hexdigest()[:12]
            prof_phd = fetch_profile_phd(p["url"], session) if (use_profiles and not p["phd"]) else ""
            phd_text = p["phd"] or prof_phd
            phd_uni, phd_year, phd_ev = phd_from_text(phd_text)
            country = phd_country(phd_uni or phd_ev)
            in_progress = bool(re.search(r"candidate|pursuing|ongoing|在读", phd_ev, re.I))
            row = {h: "" for h in HEADER}
            row.update(academic_id=aid, full_name=p["name"], university=u["name"], faculty=faculty,
                       department=department, academic_position=p["position"],
                       research_interests=p["extra"] if key and p["extra"] and not p["extra"].startswith("lab ") and
                       not re.search(r"[一-鿿]{2,}(系|学院|中心|实验室)$", p["extra"]) else "",
                       staff_profile_url=p["url"], google_scholar_url=p["scholar"], collected_at=COLLECTED,
                       employment_status="listed_in_official_directory",
                       record_status="baseline_sample_official_directory",
                       phd_status="in_progress" if in_progress else ("listed_completed" if phd_ev else "not_published_or_not_extracted"),
                       qualifications=phd_ev, qualification_evidence=phd_ev,
                       phd_university="" if in_progress else phd_uni,
                       phd_completion_year="" if in_progress else phd_year,
                       phd_country="" if in_progress else country,
                       phd_country_basis="institution_keyword_mapping" if country and not in_progress else "")
            notes = [f"International baseline ({u['tier']} tier, QS 2027 {u['qs_rank_2027']}); systematic sample of the official directory."]
            if p["native"]:
                notes.append(f"Native-script name: {p['native']}; romanised with pypinyin.")
            if p["extra"] and not row["research_interests"]:
                notes.append(f"Unit/lab: {p['extra']}")
            if use_oa or cands:
                a, status, n = match(p, cands)
                row["research_lookup_status"] = status
                if a:
                    row.update({k: str(v) for k, v in metrics(a).items()})
                    row["research_metrics_source"] = "OpenAlex"
                    row["metrics_source_url"] = a["id"]
                    notes.append("OpenAlex metrics (works, citations, h-index, 2021-2025 citations from counts_by_year); "
                                 "not comparable 1:1 with Google Scholar values.")
                match_rows.append(dict(academic_id=aid, university_id=u["id"], full_name=p["name"],
                                       openalex_id=a["id"] if a else "", openalex_display_name=a["display_name"] if a else "",
                                       works_count=a["works_count"] if a else "", cited_by_count=a["cited_by_count"] if a else "",
                                       h_index=(a.get("summary_stats") or {}).get("h_index", "") if a else "",
                                       candidates=n, status=status))
            else:
                row["research_lookup_status"] = "openalex_pending"
            row["notes"] = " ".join(notes)
            by_dept[(faculty, department)].append(row)

        # Write the hierarchy mirroring the Sri Lankan layout.
        fac_counts = defaultdict(lambda: [set(), 0])
        for (faculty, department), rows in by_dept.items():
            d = base / "faculties" / slugify(faculty) / "departments" / slugify(department)
            d.mkdir(parents=True, exist_ok=True)
            with (d / "academics.csv").open("w", newline="", encoding="utf-8-sig") as f:
                w = csv.DictWriter(f, fieldnames=HEADER)
                w.writeheader()
                w.writerows(rows)
            fac_counts[faculty][0].add(department)
            fac_counts[faculty][1] += len(rows)
        base.mkdir(parents=True, exist_ok=True)
        with (base / "faculties.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["faculty_id", "faculty_name", "department_count", "academic_records"])
            for fac, (deps, n) in fac_counts.items():
                w.writerow([slugify(fac), fac, len(deps), n])
        total = sum(n for _, n in fac_counts.values())
        uni_rows.append(dict(id=u["id"], name=u["name"], short=u["short"], country=u["country"], type=u["type"],
                             qs_rank_2027=u["qs_rank_2027"], tier=u["tier"], academic_records=total,
                             openalex_institution_ids="|".join(INST[u["id"]]), substitution_note=u.get("substitution", "")))
        print(f"{u['id']:<11} {u['tier']:<7} {total:>3} academics, {len(cands):>4} OpenAlex candidates")

    def write(name, rows):
        with (OUT / name).open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    write("universities.csv", uni_rows)
    write("departments.csv", dept_rows)
    if match_rows:
        write("openalex_matches.csv", match_rows)

    # QS 2027 reference covering both the baselines and the Sri Lankan institutions.
    sl = list(csv.DictReader(open(DATA / "universities.csv", encoding="utf-8-sig")))
    qs = [dict(id=r["id"], name=r["name"], country=r["country"], qs_rank_2027=r["qs_rank_2027"], tier=r["tier"]) for r in uni_rows]
    for r in sl:
        qs.append(dict(id=r["id"], name=r["name"], country="Sri Lanka",
                       qs_rank_2027=CFG["sri_lanka_qs_2027"].get(r["id"], "not ranked"), tier="sri_lanka"))
    write("qs_rankings_2027.csv", qs)


if __name__ == "__main__":
    main()

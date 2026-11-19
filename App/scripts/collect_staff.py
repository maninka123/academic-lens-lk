#!/usr/bin/env python3
"""Collect academic-staff listings from OFFICIAL university sites (general dataset collection, not study-specific).

Polite crawler: honours robots.txt, one request at a time per host with a delay, never bypasses a 401/403/429/503 or bot protection
(the host is dropped for the run), caches pages in the git-ignored private/collect_cache/, and writes raw entries to the
git-ignored private/collect/<university>_entries.csv. It stores names, positions, qualification text, unit and the page URL only:
no contact details. Collection is by page structure, never by qualification, origin, publications or OpenAlex.

An entry is a line that looks like a person's name with an academic title followed, within a few lines, by an academic position.
Entries are raw; building the dataset (IDs, folders, statuses) is a separate reviewed step.

Usage: python3 App/scripts/collect_staff.py <university_id> [--max-pages 400] [--delay 1.2]
"""
import argparse, collections, csv, hashlib, html, json, re, sys, time, urllib.error, urllib.parse, urllib.request, urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "private/collect_cache"; OUT = ROOT / "private/collect"
CACHE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (compatible; LankaAcademiaResearch/1.0; polite single-request check)"
SEEDS = {
    "sabaragamuwa": ["https://www.sab.ac.lk/", "http://smartest.sab.ac.lk"],
    "wayamba": ["https://www.wyb.ac.lk/", "https://www.wyb.ac.lk/undergraduate/", "https://www.wyb.ac.lk/academic-division/"],
    "rajarata": ["https://www.rjt.ac.lk/", "https://www.rjt.ac.lk/academic/"],
    "eastern": ["https://www.esn.ac.lk/", "http://fag.esn.ac.lk", "http://www.fac.esn.ac.lk/", "http://fcm.esn.ac.lk", "http://fhcs.esn.ac.lk", "http://fsc.esn.ac.lk/", "http://fot.esn.ac.lk"],
    "seusl": ["https://www.seu.ac.lk/", "http://www.seu.ac.lk/academic_staff.php"],
    "ousl": ["https://www.ou.ac.lk/", "https://www.ou.ac.lk/find-an-academic/?wpv-staff-member=academic"],
    "uvpa": ["https://vpa.ac.lk/", "https://vpa.ac.lk/faculties/", "https://vpa.ac.lk/departments/", "https://vpa.ac.lk/faculty-of-music-2/", "https://vpa.ac.lk/faculty-of-visual-arts/", "https://vpa.ac.lk/faculty-of-dance-and-drama-2/"],
}
GOOD = re.compile(r"staff|academic|people|faculty|faculties|department|profile|lecturer|member|team|school|division|unit|centre|center|about", re.I)
EXTRA = {"ousl": [f"https://www.ou.ac.lk/find-an-academic/?wpv-staff-member=academic&wpv_view_count=806&wpv_paged={n}" for n in range(2, 39)], "rajarata": ["https://foa.rjt.ac.lk/", "https://fot.rjt.ac.lk/", "https://fms.rjt.ac.lk/", "https://fssh.rjt.ac.lk/", "https://fmas.rjt.ac.lk/", "https://aps.rjt.ac.lk/"]}
NONFAC_HOST = re.compile(r"^(email|e-learn|elearn|payment|repository|lib|library|mail|webmail|sdg|cdce|cits|ictk|ictm|cgee|cgu|sitharana)\.", re.I)
SKIP = re.compile(r"\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|pptx?|mp4)(\?|$)|/(news|events?|gallery|tender|vacanc|notice|download|login|wp-login|wp-json|feed|tag|category|author|calendar|publications?|research-?papers|alumni|admission|careers?)(/|$)|\?(?!wpv|page|p=|id=)", re.I)
BLOCK = re.compile(r"anubis|access denied|captcha|unusual traffic|are you a robot", re.I)

TITLE = r"(?:Senior\s+Prof(?:essor)?\.?|Snr\.?\s*Prof(?:essor)?\.?|Emeritus\s+Prof(?:essor)?\.?|Emer\.?\s*Prof(?:essor)?\.?|Prof(?:essor)?\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Ven\.?|Rev\.?|Eng\.?|Ch\.?\s?Eng\.?)"
NAME = re.compile(r"^(?:" + TITLE + r"[\s.(]*(?:\((?:Dr|Mrs|Ms|Mr|Prof)\.?\)\s*)?)+[A-Z][A-Za-z.'\-]*(?:\s+[A-Za-z.'\-]+){0,6}$")
POS = re.compile(r"\b(Senior Professor|Professor|Associate Professor|Senior Lecturer(?:\s*\(?Gr(?:ade)?\.?\s*(?:I{1,2}|1|2)\)?)?|Lecturer(?:\s*\(?(?:Probationary|Temporary|Contract|Gr(?:ade)?\.?\s*(?:I{1,2}|1|2))\)?)?|Probationary Lecturer|Temporary Lecturer|Assistant Lecturer|Visiting (?:Lecturer|Professor|Senior Lecturer)|Instructor|Demonstrator|Head of (?:the )?Department|Professor Emeritus|Emeritus Professor)\b", re.I)
DEGREE = re.compile(r"\b(Ph\.?\s?D|D\.?\s?Phil|BSc|B\.?Sc|MSc|M\.?Sc|MPhil|M\.?Phil|MBA|MA|B\.?A|MBBS|LLB|LLM|BBA|B\.?Com|B\.?Eng|M\.?Eng|BVSc|PGD|Postgraduate)\b", re.I)
NOTACAD = re.compile(r"\b(Registrar|Bursar|Librarian|Accountant|Assistant Registrar|Clerk|Secretary|Engineer|Manager|Warden|Officer|Technician|Driver|Attendant|Peon|Minute)\b", re.I)


class Fetcher:
    def __init__(self, delay):
        self.delay, self.last, self.robots, self.blocked = delay, {}, {}, set()
    def allowed(self, url):
        host = urllib.parse.urlparse(url).netloc; rp = self.robots.get(host)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            try: rp.parse(urllib.request.urlopen(urllib.request.Request(f"https://{host}/robots.txt", headers={"User-Agent": UA}), timeout=15).read().decode("utf-8", "ignore").splitlines())
            except Exception: rp.parse([])
            self.robots[host] = rp
        return rp.can_fetch(UA, url)
    def get(self, url):
        f = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")
        if f.exists(): return json.loads(f.read_text(encoding="utf-8"))
        host = urllib.parse.urlparse(url).netloc
        if host in self.blocked or not self.allowed(url): return {"url": url, "status": "skipped", "text": "", "links": [], "title": ""}
        wait = self.delay - (time.time() - self.last.get(host, 0))
        if wait > 0: time.sleep(wait)
        status, body = "ok", ""
        for u in [url] + ([url.replace("//www.", "//", 1)] if "//www." in url else []):
            try:
                body = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=30).read(3_000_000).decode("utf-8", "ignore"); status = "ok"; break
            except urllib.error.HTTPError as e:
                status = f"http_{e.code}"
                if e.code in (401, 403, 429, 503): self.blocked.add(host); break
            except Exception: status = "error"
        self.last[host] = time.time()
        if status == "ok" and BLOCK.search(body[:5000]) and len(body) < 20000: status, body = "bot_protection", ""; self.blocked.add(host)
        links = [(urllib.parse.urljoin(url, h), re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()) for h, t in re.findall(r"<a\s[^>]*href=[\"']([^\"'#]+)[\"'][^>]*>(.*?)</a>", body, re.S | re.I)]
        title = re.search(r"<title>(.*?)</title>", body, re.S | re.I)
        t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
        t = re.sub(r"</(p|div|li|tr|h\d|br|section|article|td|th|span)>|<br\s*/?>", "\n", t, flags=re.I); t = re.sub(r"<[^>]+>", " ", t)
        t = "\n".join(re.sub(r"[ \t ]+", " ", html.unescape(l)).strip() for l in t.splitlines()); t = re.sub(r"\n{2,}", "\n", t)
        rec = {"url": url, "status": status, "title": html.unescape(title.group(1)).strip() if title else "", "text": t, "links": links[:500]}
        f.write_text(json.dumps(rec), encoding="utf-8"); return rec


def unit_from(title, text, url):
    blob = " | ".join([title] + text.split("\n")[:25]) + " " + urllib.parse.unquote(url)
    fac = re.search(r"(Faculty of [A-Z][A-Za-z&,\- ]{3,70}?)(?= -| \||,? Univ|\n|$| and Department)", blob)
    dep = re.search(r"((?:Department|Dept\.?|Centre|Center|School|Unit|Division) of [A-Z][A-Za-z&,\- ]{3,70}?)(?= -| \||,? Univ|\n|$|,? Faculty)", blob)
    return (fac.group(1).strip() if fac else ""), (dep.group(1).strip() if dep else "")


def parse(rec):
    lines = [l for l in rec["text"].split("\n") if l.strip()]; out = []; fac, dep = unit_from(rec["title"], rec["text"], rec["url"])
    for i, l in enumerate(lines):
        l2 = l.strip(" -–•*:|")
        if len(l2) > 80 or len(l2) < 6 or not NAME.match(l2) or NOTACAD.search(l2): continue
        window = []
        for w in lines[i + 1: i + 6]:
            if len(w) < 80 and NAME.match(w.strip(" -–•*:|")): break          # the next person's block starts here
            window.append(w)
        pos = next((POS.search(w).group(1) for w in window if POS.search(w) and not NOTACAD.search(w) and len(w) < 140), None)
        if not pos:
            m = POS.search(l2)
            if m and not NOTACAD.search(l2): pos = m.group(1)
        if not pos: continue
        quals = " ; ".join(w for w in window if DEGREE.search(w) and len(w) < 300)[:400]
        dep_here = dep
        if "find-an-academic" in rec["url"]:     # OUSL directory card: name, position, [Head of the Department], unit
            cand = [w.strip() for w in window[1:] if 2 < len(w.strip()) < 70 and not POS.search(w) and not DEGREE.search(w) and not re.match(r"(?i)head of|\(on ", w.strip())]
            dep_here = cand[0] if cand else ""
        out.append({"name": re.sub(r"\s+", " ", l2), "position": pos, "qualifications": quals, "faculty": fac, "department": dep_here, "page_url": rec["url"], "page_title": rec["title"][:120]})
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("uni"); ap.add_argument("--max-pages", type=int, default=400); ap.add_argument("--delay", type=float, default=1.2); a = ap.parse_args()
    F = Fetcher(a.delay); seeds = list(SEEDS[a.uni])
    PARENT = {"sabaragamuwa": "sab.ac.lk", "wayamba": "wyb.ac.lk", "rajarata": "rjt.ac.lk", "eastern": "esn.ac.lk", "seusl": "seu.ac.lk", "ousl": "ou.ac.lk", "uvpa": "vpa.ac.lk"}[a.uni]
    base_domains = {PARENT}
    for s in EXTRA.get(a.uni, []): seeds.append(s)
    queue = collections.deque((s, 0) for s in seeds); seen = set(seeds); entries = {}; pages = 0
    while queue and pages < a.max_pages:
        url, d = queue.popleft(); rec = F.get(url); pages += 1
        if rec["status"] != "ok": continue
        for e in parse(rec): entries.setdefault((e["name"].lower(), e["faculty"], e["department"]), e)
        if d >= 3: continue
        for h, t in rec["links"]:
            h = h.split("#")[0]; net = urllib.parse.urlparse(h).netloc
            if h in seen or SKIP.search(h) or not any(net.endswith(b) for b in base_domains) or not (GOOD.search(t) or GOOD.search(urllib.parse.unquote(h))): continue
            if NONFAC_HOST.match(net): continue
            seen.add(h); queue.append((h, d + 1))
        if pages % 50 == 0: print(a.uni, pages, "pages;", len(entries), "entries;", len(queue), "queued; blocked:", sorted(F.blocked), flush=True)
    hostfac = {}
    for url in list(seen):
        net = urllib.parse.urlparse(url).netloc
        if net in hostfac: continue
        root = f"{urllib.parse.urlparse(url).scheme}://{net}/"; f = CACHE / (hashlib.sha1(root.encode()).hexdigest() + ".json")
        if f.exists():
            r0 = json.loads(f.read_text(encoding="utf-8")); fac0, _ = unit_from(r0.get("title", ""), r0.get("text", "")[:600], root)
            if fac0: hostfac[net] = fac0
    best = {}
    for e in entries.values():
        if not e["faculty"]: e["faculty"] = hostfac.get(urllib.parse.urlparse(e["page_url"]).netloc, "")
        k = re.sub(r"[^a-z]", "", e["name"].lower())
        cur = best.get(k)
        if cur is None or (bool(e["department"]), bool(e["faculty"]), len(e["qualifications"])) > (bool(cur["department"]), bool(cur["faculty"]), len(cur["qualifications"])): best[k] = e
    rows = list(best.values())
    with open(OUT / f"{a.uni}_entries.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "position", "qualifications", "faculty", "department", "page_url", "page_title"]); w.writeheader(); w.writerows(rows)
    print(a.uni, "pages", pages, "entries", len(rows), "blocked", sorted(F.blocked))


if __name__ == "__main__": main()

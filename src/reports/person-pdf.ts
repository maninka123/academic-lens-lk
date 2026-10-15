// A4 profile report drawn with vector shapes (no screenshots), so charts stay sharp.
import type { jsPDF } from "jspdf";
import type { Academic, Metadata, NumericMetric } from "../types";
import { metricLabels } from "../types";
import { buildPeerGroups } from "../analytics/profile-peers";
import {
  SCORE_BANDS,
  SCORE_MEASURES,
  standingScore,
  type StandingScore,
} from "../analytics/standing-score";
import { aheadOf, standingColor } from "../components/common";
import { MIN_SAMPLE, providerOf } from "../analytics/quality";

const W = 210,
  H = 297,
  M = 14,
  CW = W - 2 * M;
const INK = "#18203a",
  MUTED = "#5d6784",
  LINE = "#dfe3f0",
  SOFT = "#f1f3fa",
  BRAND = "#2a3aa8";

/** Standard PDF fonts only cover Latin text: fold anything else safely. */
const t = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/≥/g, ">=")
    .replace(/→/g, "->")
    .replace(/[▸▶]/g, ">")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");

const num = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "-"
    : new Intl.NumberFormat("en", { maximumFractionDigits: d }).format(v);

export async function buildPersonReport(
  person: Academic,
  everyone: Academic[],
  metadata: Metadata,
): Promise<jsPDF> {
  const { jsPDF: PDF } = await import("jspdf");
  const doc = new PDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const score = standingScore(person, everyone);
  const generated = new Date().toISOString().slice(0, 10);
  let y = 0;

  // ---------- drawing helpers ----------
  const color = (hex: string) => doc.setTextColor(hex);
  const text = (s: string, x: number, yy: number, size = 10, style: "normal" | "bold" = "normal", hex = INK, opts: Record<string, unknown> = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(hex);
    doc.text(t(s), x, yy, opts);
  };
  const wrap = (s: string, width: number, size: number) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(t(s), width) as string[];
  };
  const para = (s: string, x: number, width: number, size = 9.5, hex = INK, lh = 4.6) => {
    const lines = wrap(s, width, size);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    color(hex);
    lines.forEach((l, i) => doc.text(l, x, y + i * lh));
    y += lines.length * lh;
  };
  const ensure = (need: number) => {
    if (y + need > H - 18) {
      doc.addPage();
      y = M + 4;
    }
  };
  const rule = () => {
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
  };
  const heading = (s: string, sub?: string) => {
    ensure(42);
    y += 4;
    doc.setFillColor(BRAND);
    doc.roundedRect(M, y - 4.2, 1.6, 6.4, 0.8, 0.8, "F");
    text(s, M + 4, y + 0.6, 13, "bold");
    y += 5.5;
    if (sub) {
      para(sub, M + 4, CW - 4, 9, MUTED, 4.2);
      y += 1;
    }
    y += 1.5;
  };
  const bar = (x: number, yy: number, w: number, h: number, pct: number | null, hex?: string) => {
    doc.setFillColor(SOFT);
    doc.roundedRect(x, yy, w, h, h / 2, h / 2, "F");
    if (pct !== null && pct > 0) {
      doc.setFillColor(hex || standingColor(pct));
      doc.roundedRect(x, yy, Math.max(h, (w * pct) / 100), h, h / 2, h / 2, "F");
    }
  };
  const ring = (cx: number, cy: number, r: number, pct: number | null, label: string, indicative: boolean) => {
    doc.setLineCap("butt");
    doc.setDrawColor(SOFT);
    doc.setLineWidth(3.2);
    doc.circle(cx, cy, r, "S");
    if (pct !== null) {
      doc.setDrawColor(standingColor(pct));
      doc.setLineWidth(3.2);
      const steps = Math.max(2, Math.round((pct / 100) * 120));
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const ang = -Math.PI / 2 + (2 * Math.PI * (pct / 100) * i) / steps;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
      }
      // One continuous, round-capped path (no visible segment joins).
      doc.setLineCap("round");
      doc.setLineJoin("round");
      doc.lines(
        pts.slice(1).map((pt, i) => [pt[0] - pts[i][0], pt[1] - pts[i][1]] as [number, number]),
        pts[0][0],
        pts[0][1],
        [1, 1],
        "S",
        false,
      );
    }
    text((indicative ? "~" : "") + label, cx, cy + 3.2, 17, "bold", pct === null ? MUTED : standingColor(pct), { align: "center" });
  };

  // ---------- page 1: header ----------
  doc.setFillColor(BRAND);
  doc.rect(0, 0, W, 40, "F");
  doc.setFillColor("#0f9488");
  doc.rect(0, 40, W, 1.2, "F");
  text("RESEARCH PROFILE REPORT", M, 12, 8.5, "bold", "#bfc8ff");
  text(person.name, M, 23, 20, "bold", "#ffffff");
  text([person.position || person.rank, person.university].filter(Boolean).join("  |  "), M, 31, 10, "normal", "#dbe0ff");
  text(`Generated ${generated}`, W - M, 12, 8.5, "normal", "#bfc8ff", { align: "right" });
  text(`Dataset ${metadata.version || ""}`, W - M, 17, 8.5, "normal", "#bfc8ff", { align: "right" });
  y = 50;

  // ---------- score card ----------
  const scored = score.score !== null;
  doc.setFillColor("#ffffff");
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, CW, 38, 4, 4, "FD");
  ring(M + 24, y + 19, 12.5, score.score, scored ? `${score.score}%` : "-", score.basis === "indicative");
  const sx = M + 46;
  text("RESEARCH STANDING", sx, y + 10, 8, "bold", MUTED);
  text(scored ? score.band! : "Not scored", sx, y + 18, 15, "bold", scored ? standingColor(score.score!) : MUTED);
  const sub = scored
    ? `${score.measuresUsed} of 3 measures  |  ${score.confidence} confidence${score.basis === "indicative" ? "  |  indicative" : ""}`
    : score.reason;
  const subLines = wrap(sub, CW - 52, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(MUTED);
  subLines.slice(0, 2).forEach((l, i) => doc.text(l, sx, y + 24.5 + i * 4.2));
  if (scored) text(`Compared with: ${score.groupLabel} (${num(score.groupSize)} profiles)`, sx, y + 33.5, 8.5, "normal", INK);
  y += 46;

  // ---------- key facts ----------
  const facts: [string, string, string][] = [
    ["PhD", person.doctorateStatus === "completed_documented" ? String(person.phdYear ?? "Completed") : person.doctorateStatus === "in_progress" ? "In progress" : "-", [person.phdCountry, person.phdUniversity].filter(Boolean).join(", ") || "Not documented"],
    ["CITATIONS", num(person.citations), person.citations === null ? "Not recorded" : providerOf(person, "citations")],
    ["CITATIONS 2021-2025", num(person.recentCitations), person.recentCitations === null ? "Not recorded" : providerOf(person, "recentCitations")],
    ["H-INDEX", num(person.hIndex), person.hIndex === null ? "Not recorded" : providerOf(person, "hIndex")],
    ["PUBLICATIONS", num(person.publications), person.publications === null ? "Not recorded" : providerOf(person, "publications")],
  ];
  const tw = (CW - 4 * 3) / 5;
  facts.forEach(([label, value, subtext], i) => {
    const x = M + i * (tw + 3);
    doc.setFillColor(SOFT);
    doc.roundedRect(x, y, tw, 24, 3, 3, "F");
    text(label, x + 3, y + 6, 6.5, "bold", MUTED);
    text(value, x + 3, y + 14.5, 14, "bold");
    const sl = wrap(subtext, tw - 5, 7);
    doc.setFontSize(7);
    color(MUTED);
    sl.slice(0, 2).forEach((l, k) => doc.text(l, x + 3, y + 19.5 + k * 3.2));
  });
  y += 30;

  // ---------- how the score is calculated ----------
  heading("How the score is calculated", "A 0-100% blend of percentile ranks. 50% is typical for the peer group; higher is further ahead. It describes position among collected profiles, not quality, teaching or service.");
  const steps: [string, string][] = [
    ["1", `Peer group: ${scored || score.groupLabel ? score.groupLabel : "no fair peer group"}${score.groupSize ? ` (${num(score.groupSize)} profiles)` : ""}. People are compared by career stage and broad discipline, using values from the same source only.`],
    ["2", "Each measure becomes a percentile within that group: (people below + half of ties) / people with a value x 100."],
    ["3", "The percentiles are blended with weights (h-index 40%, citations 2021-2025 35%, publications 25%), rescaled over the measures that exist. A missing value is skipped, never counted as zero."],
  ];
  steps.forEach(([n, s]) => {
    ensure(14);
    doc.setFillColor(BRAND);
    doc.circle(M + 3, y - 1.2, 2.6, "F");
    text(n, M + 3, y - 0.2, 8, "bold", "#ffffff", { align: "center" });
    para(s, M + 9, CW - 9);
    y += 1.5;
  });
  if (score.caveats.length) {
    ensure(10 + score.caveats.length * 5);
    doc.setFillColor("#fff4de");
    const h = 9 + score.caveats.length * 4.8;
    doc.roundedRect(M, y, CW, h, 3, 3, "F");
    text("Indicative score: a fallback was used", M + 4, y + 5.5, 9, "bold", "#9a5d08");
    score.caveats.forEach((c, i) => text("- " + c, M + 4, y + 10.5 + i * 4.6, 8.5, "normal", "#7a4a06"));
    y += h + 3;
  }

  // measure table
  ensure(52);
  y += 1;
  const cols = [0, 46, 66, 98, 114, 160];
  doc.setFillColor(SOFT);
  doc.roundedRect(M, y, CW, 7, 2, 2, "F");
  ["MEASURE", "VALUE", "SOURCE", "PEERS", "AHEAD OF", "WEIGHT"].forEach((h, i) => text(h, M + 3 + cols[i], y + 4.7, 7, "bold", MUTED));
  y += 7;
  score.components.forEach((c) => {
    ensure(10);
    const yy = y + 6.5;
    const dim = c.status !== "scored" ? MUTED : INK;
    text(c.label, M + 3, yy, 9, "bold", dim);
    text(c.value === null ? "-" : num(c.value), M + 3 + cols[1], yy, 9, "normal", dim);
    text(c.provider, M + 3 + cols[2], yy, 8.5, "normal", MUTED);
    text(c.status === "missing" ? "-" : num(c.peers), M + 3 + cols[3], yy, 9, "normal", dim);
    if (c.percentile !== null) {
      bar(M + 3 + cols[4], yy - 3, 28, 3.6, c.percentile);
      text(`${Math.round(c.percentile)}%`, M + 3 + cols[4] + 31, yy, 9, "bold", standingColor(c.percentile));
    } else text(c.status === "missing" ? "Not recorded" : "Too few peers", M + 3 + cols[4], yy, 8.5, "normal", MUTED);
    text(`${Math.round(c.weight * 100)}%`, M + 3 + cols[5], yy, 9, "normal", dim);
    y += 9;
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y - 1.2, W - M, y - 1.2);
  });
  y += 3;
  score.components.filter((c) => c.status !== "scored").forEach((c) => {
    ensure(7);
    para(`${c.label}: ${c.note}`, M, CW, 8.5, MUTED, 4);
  });
  if (scored) {
    ensure(18);
    y += 2;
    doc.setFillColor(SOFT);
    doc.roundedRect(M, y, CW, 10, 2.5, 2.5, "F");
    const used = score.components.filter((c) => c.status === "scored");
    const f = used.map((c) => `${c.weight.toFixed(2)} x ${Math.round(c.percentile!)}`).join(" + ");
    text(`(${f}) / ${score.weightUsed.toFixed(2)} = ${score.score}%`, M + 4, y + 6.6, 10.5, "bold");
    y += 14;
    // band scale
    const bw = (CW - 4 * 2) / 5;
    [...SCORE_BANDS].reverse().forEach((b, i) => {
      const x = M + i * (bw + 2);
      const active = score.band === b.label;
      doc.setFillColor(standingColor(b.min + 10));
      doc.roundedRect(x, y, bw, 11, 2, 2, "F");
      text(`${b.min}+`, x + 2.5, y + 4.6, 8, "bold", "#ffffff");
      text(b.label, x + 2.5, y + 8.6, 6, "normal", "#ffffff");
      if (active) {
        doc.setDrawColor(INK);
        doc.setLineWidth(0.7);
        doc.roundedRect(x - 0.5, y - 0.5, bw + 1, 12, 2.2, 2.2, "S");
      }
    });
    y += 15;
  }

  // ---------- standing in each peer group ----------
  const present = (["hIndex", "citations", "recentCitations", "publications"] as NumericMetric[]).filter(
    (m) => person[m] !== null && person[m] !== undefined,
  );
  if (present.length) {
    heading(
      "Where this person stands",
      "Percentile of this person's value within each peer group (same position). Groups need at least " + MIN_SAMPLE + " people with a value from the same source.",
    );
    for (const m of present) {
      const { provider, groups } = buildPeerGroups(everyone, person, m, "position");
      ensure(14 + groups.length * 7.2);
      text(`${metricLabels[m]}  =  ${num(person[m])}`, M, y + 3, 10, "bold");
      text(provider, W - M, y + 3, 8.5, "normal", MUTED, { align: "right" });
      y += 7;
      groups.forEach((g) => {
        ensure(8);
        text(g.label, M, y + 3.6, 8.5, "normal", INK);
        const bx = M + 62;
        bar(bx, y + 0.8, 70, 3.8, g.percentile);
        if (g.percentile !== null) text(aheadOf(g.percentile), bx + 74, y + 3.8, 8.5, "bold", standingColor(g.percentile));
        else text(g.members.length === 0 ? "No eligible profiles" : `Needs ${MIN_SAMPLE} values (has ${g.v.length})`, bx + 74, y + 3.8, 8, "normal", MUTED);
        y += 6.6;
      });
      y += 4;
    }

    // person vs peer median
    ensure(20);
    heading("Person against the peer median", "The widest comparison group with enough values: department, faculty, university, discipline, position, then everyone.");
    const order = ["department", "faculty", "university", "field", "rank", "all"];
    for (const m of present) {
      const { groups } = buildPeerGroups(everyone, person, m, "position");
      const g = order.map((k) => groups.find((x) => x.key === k && x.median !== null)).find(Boolean);
      if (!g || g.median === null || g.mean === null) continue;
      ensure(24);
      text(`${metricLabels[m]}  (${g.label}, ${num(g.v.length)} values)`, M, y + 3, 9, "bold");
      y += 6;
      const top = Math.max(person[m] as number, g.median, g.mean, 1);
      (
        [
          ["This person", person[m] as number, "#e8590c"],
          ["Peer median", g.median, "#3b4fd6"],
          ["Peer mean", g.mean, "#8a93c9"],
        ] as [string, number, string][]
      ).forEach(([label, v, hex]) => {
        text(label, M, y + 3.4, 8.5, "normal", MUTED);
        const w = Math.max(0.8, (110 * v) / top);
        doc.setFillColor(hex);
        doc.roundedRect(M + 30, y + 0.6, w, 3.6, 1.4, 1.4, "F");
        text(num(v, 1), M + 30 + w + 2.5, y + 3.6, 8.5, "bold");
        y += 5.6;
      });
      y += 3;
    }
  }

  // ---------- details ----------
  heading("Profile details");
  const detail = (rows: [string, string][]) => {
    rows.forEach(([k, v]) => {
      const lines = wrap(v || "-", CW - 52, 9);
      ensure(lines.length * 4.4 + 3);
      text(k, M + 2, y + 3.4, 8.5, "bold", MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      color(INK);
      lines.forEach((l, i) => doc.text(l, M + 50, y + 3.4 + i * 4.4));
      y += lines.length * 4.4 + 2;
      doc.setDrawColor(LINE);
      doc.setLineWidth(0.2);
      doc.line(M, y - 0.8, W - M, y - 0.8);
    });
    y += 3;
  };
  detail([
    ["Name as published", person.sourceName || person.name],
    ["University", person.university],
    ["Faculty / school", person.faculty],
    ["Department", person.department],
    ["Published position", person.position],
    ["Career stage / position", person.rank],
    ["Broad discipline", person.field && person.field !== "Unmapped" ? person.field : ""],
    ["Employment status", person.employmentStatus.replace(/_/g, " ")],
    ["Research interests", person.interests],
  ]);
  text("Education", M, y + 2, 10.5, "bold");
  y += 6;
  detail([
    ["Published qualifications", person.qualifications],
    ["Highest qualification", person.qualification],
    ["PhD completion year", person.phdYear ? String(person.phdYear) : ""],
    ["PhD institution", person.phdUniversity],
    ["PhD country", person.phdCountry + (person.phdCountryInferred && person.phdCountry ? " (inferred from university name)" : "")],
  ]);
  text("Research metrics", M, y + 2, 10.5, "bold");
  y += 6;
  detail(
    (
      [
        ["publications", "Publications"],
        ["citations", "Citations (all time)"],
        ["recentCitations", `Citations ${metadata.window?.join("-") ?? "2021-2025"}`],
        ["hIndex", "h-index"],
        ["q1", "Q1 journal publications"],
        ["recentQ1", "Q1 publications in window"],
      ] as [NumericMetric, string][]
    ).map(([k, label]) => {
      const e = person.metricEvidence?.find((x) => x.metric === k);
      const v = person[k];
      return [label, v === null ? "Not recorded" : `${num(v)}  |  ${e?.source || person.metricsSource || "source not recorded"}${e?.date ? " | " + e.date : ""}`] as [string, string];
    }),
  );
  text("Sources and evidence", M, y + 2, 10.5, "bold");
  y += 6;
  detail([
    ["Official page", person.sourceUrl],
    ["Google Scholar", person.scholarUrl],
    ["ResearchGate", person.researchgateUrl || ""],
    ["OpenAlex", person.openAlexUrl || ""],
    ["Identity status", [person.scholarStatus, person.researchgateStatus].filter(Boolean).join("; ").replace(/_/g, " ")],
    ["Doctorate status", (person.doctorateStatus || "").replace(/_/g, " ")],
    ["Record collected", person.collectionDate],
    ["Notes", person.notes],
  ]);

  // ---------- method & limits ----------
  heading("About this report");
  para("Figures describe the collected profiles in Lanka Academia, not all academics, and not a measure of teaching, service or overall academic quality. Citation counts differ by source and field. Missing values are unknown, never zero, and are skipped. Percentiles need at least " + MIN_SAMPLE + " peers with a value from the same source unless the score is marked indicative.", M, CW, 9, MUTED);
  y += 2;
  para("Method: docs/STANDING_SCORE.md  |  Data dictionary and policy: Data files/README.md  |  Source: https://maninka123.github.io/academic-lens-lk/", M, CW, 8.5, MUTED);

  // ---------- footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    doc.line(M, H - 12, W - M, H - 12);
    text(`Lanka Academia  |  ${person.name}`, M, H - 7, 7.5, "normal", MUTED);
    text(`Page ${p} of ${pages}`, W - M, H - 7, 7.5, "normal", MUTED, { align: "right" });
  }
  return doc;
}

export const reportFileName = (person: Academic) =>
  "research-report-" +
  person.name
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() +
  ".pdf";

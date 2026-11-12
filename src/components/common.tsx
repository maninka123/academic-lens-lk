import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Academic } from "../types";
import Papa from "papaparse";
export const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "Not available"
    : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(v);
export const short = (name: string) =>
  name
    .replace(/^University of /, "")
    .replace("General Sir John Kotelawala Defence University", "KDU")
    .replace("Sri Lanka Institute of Information Technology", "SLIIT")
    .replace("NSBM Green University", "NSBM")
    .replace("Uva Wellassa University of Sri Lanka", "Uva Wellassa");
export function Header({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className={"stat" + (value === "Not available" ? " unavailable" : "")}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Card({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = "No available values",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">∅</div>
      <h3>{title}</h3>
      <p>
        {children ||
          "Try another metric or adjust the filters. Missing values are never treated as zero."}
      </p>
    </div>
  );
}
export function ExportLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function download(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(rows: Academic[]) {
  const safe = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        typeof v === "string" && /^[=+@\-\t\r]/.test(v)
          ? "'" + v
          : v && typeof v === "object"
            ? JSON.stringify(v)
            : v,
      ]),
    ),
  );
  download("lanka-academia-records.csv", "\uFEFF" + Papa.unparse(safe));
}
const COUNTRY_CODES: Record<string, string> = {
  "Sri Lanka": "LK", "United Kingdom": "GB", "United States": "US", Australia: "AU",
  Japan: "JP", China: "CN", Canada: "CA", "New Zealand": "NZ", India: "IN",
  Singapore: "SG", Malaysia: "MY", Germany: "DE", "South Korea": "KR", Sweden: "SE",
  "Hong Kong": "HK", Thailand: "TH", Netherlands: "NL", "South Africa": "ZA",
  Spain: "ES", Switzerland: "CH", Italy: "IT", France: "FR", Slovenia: "SI",
  Lithuania: "LT", Ireland: "IE", Belgium: "BE", Russia: "RU", Denmark: "DK",
  Portugal: "PT", Finland: "FI", Norway: "NO", Austria: "AT", Pakistan: "PK",
  Bangladesh: "BD", Indonesia: "ID", Taiwan: "TW", Turkey: "TR", Poland: "PL",
};
// Only the flags the data uses are bundled (real SVG icons, not emoji).
const FLAG_URLS = import.meta.glob(
  "/node_modules/country-flag-icons/3x2/{LK,GB,US,AU,JP,CN,CA,NZ,IN,SG,MY,DE,KR,SE,HK,TH,NL,ZA,ES,CH,IT,FR,SI,LT,IE,BE,RU,DK,PT,FI,NO,AT,PK,BD,ID,TW,TR,PL}.svg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
/** Flag icon URL for a country name, or undefined when unknown (never guessed). */
export const flagUrl = (country?: string | null) => {
  const code = country ? COUNTRY_CODES[country] : undefined;
  return code
    ? FLAG_URLS[`/node_modules/country-flag-icons/3x2/${code}.svg`]
    : undefined;
};
/** Small flag icon followed by the country name. */
export function CountryName({ country }: { country?: string | null }) {
  if (!country) return null;
  const url = flagUrl(country);
  return (
    <span className="country-name">
      {url && <img className="flag-icon" src={url} alt="" />}
      {country}
    </span>
  );
}

/** One scale for every percentile in the app: quiet slate for behind most peers, deepening to indigo for ahead of most.
 *  Hex (not CSS colour functions): chart libraries cannot lift or darken them on hover. Deliberately not red/green:
 *  a standing is a description of the collected profiles, not a verdict. */
export const standingColor = (p: number) => {
  const t = Math.min(100, Math.max(0, p)) / 100;
  const lo = [138, 147, 171], hi = [70, 88, 216];
  return "#" + lo.map((c, i) => Math.round(c + (hi[i] - c) * t).toString(16).padStart(2, "0")).join("");
};
/** Plain-language standing: how many peers the person is ahead of. */
export const aheadOf = (p: number) => {
  const n = Math.max(1, Math.round(p));
  return n >= 100 ? "Ahead of 99%+ of peers" : `Ahead of ${n}% of peers`;
};

/** Pinned people use warm colours that never appear on group bars or series. */
export const personColors = [
  "#e8590c",
  "#d6336c",
  "#f08c00",
  "#5c940d",
  "#a61e4d",
  "#8d5524",
  "#c92a2a",
  "#74b816",
];
/** Categorical series colours: mid-tone so they read on both the light and the dark canvas. The first is the highlight. */
export const colors = [
  "#5d6cf0",
  "#1ea896",
  "#8b6df0",
  "#d99a2b",
  "#e0586f",
  "#6b8ab8",
  "#4aa3df",
  "#a3b34b",
  "#c27ba0",
  "#8a8fa3",
  "#2b3aa8",
  "#b0690b",
];

/** A relative bar within one column; missing values never become zero. */
export function NumericValue({ value, maximum, digits = 1, suffix = "" }: { value: number | null | undefined; maximum: number; digits?: number; suffix?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="missing-value">—</span>;
  const width = maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) : 0;
  return <span className="table-number"><strong>{fmt(value, digits)}{suffix}</strong><span className="table-number-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></span></span>;
}

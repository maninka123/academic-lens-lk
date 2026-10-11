import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Academic } from "../types";
import Papa from "papaparse";
export const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined
    ? "Not available"
    : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(v);
export const short = (name: string) =>
  name
    .replace(/^University of /, "")
    .replace("General Sir John Kotelawala Defence University", "KDU")
    .replace("Sri Lanka Institute of Information Technology", "SLIIT")
    .replace("NSBM Green University", "NSBM");
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
        typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? "'" + v : v,
      ]),
    ),
  );
  download("academic-atlas-records.csv", "\uFEFF" + Papa.unparse(safe));
}
export const colors = [
  "#2675b9",
  "#169688",
  "#b57537",
  "#8966ad",
  "#c65170",
  "#54865d",
  "#8b743e",
  "#607a9d",
  "#c86842",
  "#7288b4",
  "#2d8cbe",
  "#934863",
];

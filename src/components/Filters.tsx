import { useEffect, useRef, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics } from "../analytics/engine";
import { Button } from "./ui/button";
import type { Filters as FilterType } from "../types";
export function Multi({
  label,
  noun,
  bare = false,
  options,
  selected,
  onChange,
}: {
  label: string;
  /** Plural name of the options (for example "faculties"), used in the hints. */
  noun?: string;
  /** Show only the current value in the box (the field label sits above it). */
  bare?: boolean;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details className="multi" ref={menu}>
      <summary aria-label={bare ? label : undefined} className={bare ? "multi-bare" : undefined}>
        {!bare && label}
        <span>{selected.length ? `${selected.length} selected` : noun ? `All ${noun}` : "All"}</span>
      </summary>
      <div className="multi-menu">
        <input
          aria-label={"Search " + label}
          placeholder={noun ? `Search ${noun}…` : "Search options…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {options
          .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
          .map((o) => (
            <label className="check" key={o.value}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() =>
                  onChange(
                    selected.includes(o.value)
                      ? selected.filter((v) => v !== o.value)
                      : [...selected, o.value],
                  )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        {!options.length && <p>{noun ? `No ${noun} available` : "No available groups"}</p>}
      </div>
    </details>
  );
}
export function Filters({ compact = false }: { compact?: boolean }) {
  const { academics, universities } = useData();
  const { filters: f, setFilters, clear } = useAtlas();
  const [open, setOpen] = useState(false);
  const units = academics.filter(
    (a) => !f.universities.length || f.universities.includes(a.universityId),
  );
  const depts = units.filter(
    (a) => !f.faculties.length || f.faculties.includes(a.facultyId),
  );
  const opts = (
    rows: typeof academics,
    k: keyof (typeof academics)[number],
    labelKey?: keyof (typeof academics)[number],
  ) =>
    [
      ...new Map(
        rows
          .filter((a) => a[k])
          .map((a) => [
            String(a[k]),
            {
              value: String(a[k]),
              label:
                labelKey === "faculty"
                  ? `${a.faculty} | ${a.university}`
                  : labelKey === "department"
                    ? `${a.department} | ${a.faculty || "Faculty unrecorded"} | ${a.university}`
                    : String(a[labelKey || k]),
            },
          ]),
      ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label));
  const change = (k: keyof FilterType, v: any) =>
    setFilters({
      [k]: v,
      ...(k === "universities"
        ? { faculties: [], departments: [] }
        : k === "faculties"
          ? { departments: [] }
          : {}),
    });
  return (
    <div className={"filters " + (compact ? "compact" : "")}>
      <div className="filter-heading">
        <Button
          variant="ghost"
          aria-expanded={open || compact}
          onClick={() => setOpen(!open)}
        >
          <Filter size={18} />
          Global filters{" "}
          <span className="pill">
            {filterAcademics(academics, f).length} records
          </span>
        </Button>
        <Button variant="ghost" onClick={clear}>
          <RotateCcw size={16} />
          Clear all
        </Button>
      </div>
      {(open || compact) && (
        <div className="filter-content">
          <Multi
            label="Institution type"
            options={["Public", "Non-state"].map((value) => ({
              value,
              label: value,
            }))}
            selected={f.types}
            onChange={(v) => change("types", v)}
          />
          <Multi
            label="Universities"
            options={universities.map((u) => ({ value: u.id, label: u.name }))}
            selected={f.universities}
            onChange={(v) => change("universities", v)}
          />
          <Multi
            label="Faculties / schools"
            options={opts(units, "facultyId", "faculty")}
            selected={f.faculties}
            onChange={(v) => change("faculties", v)}
          />
          <Multi
            label="Departments"
            options={opts(depts, "departmentId", "department")}
            selected={f.departments}
            onChange={(v) => change("departments", v)}
          />
          <Multi
            label="Academic positions"
            options={opts(academics, "rank")}
            selected={f.ranks}
            onChange={(v) => change("ranks", v)}
          />
          <Multi
            label="Qualifications"
            options={opts(academics, "qualification")}
            selected={f.qualifications}
            onChange={(v) => change("qualifications", v)}
          />
          <Multi
            label="PhD countries"
            options={opts(
              academics.map((a) => ({
                ...a,
                phdCountry: a.phdCountry || "Unknown",
              })),
              "phdCountry",
            )}
            selected={f.countries}
            onChange={(v) => change("countries", v)}
          />
          <Multi
            label="Broad disciplines"
            options={opts(academics, "field")}
            selected={f.fields}
            onChange={(v) => change("fields", v)}
          />
          <label className="field">
            Search profiles
            <input
              value={f.query}
              onChange={(e) => change("query", e.target.value)}
              placeholder="Name, university or department"
            />
          </label>
          <label className="field">
            Research interests
            <input
              value={f.interest}
              onChange={(e) => change("interest", e.target.value)}
              placeholder="Keyword"
            />
          </label>
          <details>
            <summary>Numeric ranges</summary>
            {(["citations", "publications"] as const).map((k) => (
              <label className="field" key={k}>
                {
                  {
                    citations: "Citations",
                    publications: "Publications",
                  }[k]
                }
                <div className="range">
                  <input
                    type="number"
                    min="0"
                    aria-label={k + " minimum"}
                    placeholder="Min"
                    value={f[k][0] ?? ""}
                    onChange={(e) =>
                      change(k, [
                        e.target.value === "" ? null : Number(e.target.value),
                        f[k][1],
                      ])
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    aria-label={k + " maximum"}
                    placeholder="Max"
                    value={f[k][1] ?? ""}
                    onChange={(e) =>
                      change(k, [
                        f[k][0],
                        e.target.value === "" ? null : Number(e.target.value),
                      ])
                    }
                  />
                </div>
                {f[k][0] !== null &&
                  f[k][1] !== null &&
                  f[k][0]! > f[k][1]! && (
                    <span role="alert" className="range-error">
                      Minimum exceeds maximum. No records can match this range.
                    </span>
                  )}
              </label>
            ))}
          </details>
        </div>
      )}
    </div>
  );
}

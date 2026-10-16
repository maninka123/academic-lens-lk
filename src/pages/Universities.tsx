import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  GraduationCap,
  Globe2,
  Quote,
  Search,
  Users,
} from "lucide-react";
import { useData } from "../data/context";
import { universityStats, leader } from "../analytics/universities";
import type { UniversityStats } from "../analytics/universities";
import { MIN_SAMPLE } from "../analytics/quality";
import { Header, fmt, short } from "../components/common";
import campusImages from "../data/campus-images.json";

type Sort = "profiles" | "phd" | "overseas" | "citations" | "h" | "name";
const sorts: [Sort, string][] = [
  ["profiles", "Most profiles"],
  ["phd", "Highest PhD share"],
  ["overseas", "Most overseas PhDs"],
  ["citations", "Highest median citations"],
  ["h", "Highest median h-index"],
  ["name", "Name A–Z"],
];
const pct = (v: number | null) => (v === null ? "—" : fmt(v, 0) + "%");
const num = (v: number | null) => (v === null ? "—" : fmt(v, 0));

function Meter({ value, tone }: { value: number | null; tone: string }) {
  return (
    <span className="uni-meter" aria-hidden="true">
      <span className={tone} style={{ width: `${value ?? 0}%` }} />
    </span>
  );
}

function UniversityCard({ s, rank, min }: { s: UniversityStats; rank: number; min: number }) {
  const campus = campusImages[s.id as keyof typeof campusImages];
  const thin = s.profiles < min;
  return (
    <Link to={"/university/" + s.id} className={"uni-card " + (s.type === "Non-state" ? "nonstate" : "public")}>
      <div className="uni-cover">
        {campus && (
          <img
            src={import.meta.env.BASE_URL + campus.image}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <span className="uni-rank">#{rank}</span>
        <span className="uni-type">{s.type}</span>
        <span className="uni-mono">{(s.short.length <= 5 ? s.short : s.short.slice(0, 2)).toUpperCase()}</span>
      </div>
      <div className="uni-body">
        <h3>{short(s.name)}</h3>
        {short(s.name) !== s.name && !s.name.startsWith("University of ") && (
          <p className="uni-full">{s.name}</p>
        )}
        <p className="uni-sub">
          {s.profiles
            ? [
                s.faculties ? `${s.faculties} faculties` : "",
                s.departments ? `${s.departments} departments` : "",
              ].filter(Boolean).join(" · ") || "Units not recorded"
            : "No collected profiles"}
        </p>
        <div className="uni-headline">
          <strong>{fmt(s.profiles)}</strong>
          <span>profiles · {s.share.toFixed(1)}% of Lanka Academia</span>
        </div>
        <dl className="uni-facts">
          <div>
            <dt>PhD share</dt>
            <dd>{thin || s.phdKnown < 5 ? "—" : pct(s.phd)}</dd>
            <Meter value={thin ? null : s.phd} tone="blue" />
          </div>
          <div>
            <dt>PhD from abroad</dt>
            <dd>{s.overseasKnown < 5 ? "—" : pct(s.overseas)}</dd>
            <Meter value={s.overseasKnown < 5 ? null : s.overseas} tone="teal" />
          </div>
          <div>
            <dt>Median citations</dt>
            <dd>{s.citationsN < 5 ? "—" : num(s.medianCitations)}</dd>
          </div>
          <div>
            <dt>Median h-index</dt>
            <dd>{s.hN < 5 ? "—" : num(s.medianH)}</dd>
          </div>
        </dl>
        {thin && s.profiles > 0 && (
          <p className="uni-flag">Small sample · figures indicative only</p>
        )}
        <span className="uni-open">
          Open institution <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}

export function Universities() {
  const { academics, universities, metadata } = useData();
  const min = metadata?.minimumSample || MIN_SAMPLE;
  const stats = useMemo(
    () => universityStats(academics, universities),
    [academics, universities],
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"All" | "Public" | "Non-state">("All");
  const [sort, setSort] = useState<Sort>("profiles");

  const spotlight = [
    {
      icon: Users,
      label: "Largest collection",
      s: leader(stats, (x) => x.profiles, (x) => x.profiles, 1),
      value: (x: UniversityStats) => fmt(x.profiles) + " profiles",
    },
    {
      icon: GraduationCap,
      label: "Highest PhD share",
      s: leader(stats, (x) => x.phd, (x) => x.phdKnown, min),
      value: (x: UniversityStats) => pct(x.phd) + " hold a PhD",
    },
    {
      icon: Quote,
      label: "Highest median citations",
      s: leader(stats, (x) => x.medianCitations, (x) => x.citationsN, min),
      value: (x: UniversityStats) => num(x.medianCitations) + " citations",
    },
    {
      icon: Globe2,
      label: "Most internationally trained",
      s: leader(stats, (x) => x.overseas, (x) => x.overseasKnown, min),
      value: (x: UniversityStats) => pct(x.overseas) + " PhD from abroad",
    },
  ];

  const key: Record<Exclude<Sort, "name">, (s: UniversityStats) => number | null> = {
    profiles: (s) => s.profiles,
    phd: (s) => (s.profiles < min ? null : s.phd),
    overseas: (s) => s.overseas,
    citations: (s) => s.medianCitations,
    h: (s) => s.medianH,
  };
  const visible = stats
    .filter(
      (s) =>
        (type === "All" || s.type === type) &&
        (s.name + " " + s.short).toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const av = key[sort](a),
        bv = key[sort](b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  const covered = stats.filter((s) => s.profiles).length;

  return (
    <>
      <Header
        eyebrow="Universities"
        title="Every institution, at a glance."
        description={`${covered} institutions with collected profiles. Open one to follow its faculties, departments and academics.`}
      />
      <section className="spotlight" aria-label="Highlights">
        {spotlight.map(({ icon: Icon, label, s, value }) => (
          <div key={label} className="spotlight-card">
            <span className="spotlight-icon">
              <Icon size={22} strokeWidth={1.9} />
            </span>
            <small>{label}</small>
            {s ? (
              <>
                <strong>{short(s.name)}</strong>
                <span>{value(s)}</span>
              </>
            ) : (
              <strong>—</strong>
            )}
          </div>
        ))}
      </section>
      <div className="uni-toolbar">
        <label className="uni-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search universities"
            aria-label="Search universities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="chip-group" role="group" aria-label="Institution type">
          {(["All", "Public", "Non-state"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
        <label className="uni-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {sorts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="uni-grid">
          {visible.map((s, i) => (
            <UniversityCard key={s.id} s={s} rank={i + 1} min={min} />
          ))}
        </div>
      ) : (
        <p className="caption">No university matches this search.</p>
      )}
      <p className="caption uni-note">
        <Building2 size={14} aria-hidden="true" /> Figures describe collected profiles, not whole
        staff. Medians use profiles with a value; institutions with fewer than {min} profiles
        or valid values are flagged and not ranked in highlights.
      </p>
    </>
  );
}

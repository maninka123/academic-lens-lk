import { useEffect, useState } from "react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import {
  filterAcademics,
  groupRows,
  aggregate,
  summary,
  values,
} from "../analytics/engine";
import { Chart, echarts } from "../components/Chart";
import { Header, Card, Stat, fmt, short, Empty } from "../components/common";
import { AcademicTable } from "../components/AcademicTable";
import { Button } from "../components/ui/button";
export function Origins() {
  const d = useData();
  const { filters } = useAtlas();
  const [country, setCountry] = useState(""),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState("simple");
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/world.geo.json")
      .then((r) => {
        if (!r.ok) throw Error("Map unavailable");
        return r.json();
      })
      .then((g) => {
        echarts.registerMap("world", g);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);
  const all = filterAcademics(d.academics, filters);
  const known = all.filter((a) => a.phdCountry && a.qualification === "PhD"),
    groups = groupRows(known, "phdCountry").sort(
      (a, b) => b.rows.length - a.rows.length,
    ),
    rows = country ? known.filter((a) => a.phdCountry === country) : known;
  const mapName = (s: string) =>
    s === "United States" ? "United States of America" : s;
  const mapCountry = (s: string) =>
    s === "United States of America" ? "United States" : s;
  const links = new Map<
      string,
      { source: string; target: string; value: number }
    >(),
    nodes = new Set<string>();
  for (const a of known) {
    const c = "Country: " + a.phdCountry,
      u = "Current: " + short(a.university),
      p = "PhD: " + (a.phdUniversity || "Institution unavailable");
    const pairs =
      mode === "full"
        ? [
            [c, p],
            [p, u],
          ]
        : [[c, u]];
    for (const [source, target] of pairs) {
      nodes.add(source);
      nodes.add(target);
      const key = source + "→" + target;
      links.set(key, {
        source,
        target,
        value: (links.get(key)?.value || 0) + 1,
      });
    }
  }
  return (
    <>
      <Header
        eyebrow="Education across borders"
        title="PhD Origins"
        description="Explore the countries and institutions connected to recorded doctoral qualifications."
      />
      <div className="stats-grid four">
        <Stat label="Known PhD countries" value={groups.length} />
        <Stat label="PhDs with recorded country" value={known.length} />
        <Stat
          label="Domestic awarding institutions"
          value={known.filter((a) => a.phdCountry === "Sri Lanka").length}
        />
        <Stat
          label="Overseas awarding institutions"
          value={known.filter((a) => a.phdCountry !== "Sri Lanka").length}
        />
      </div>
      <div className="inline-note">
        Countries identify awarding institutions. These are descriptive
        associations; they do not establish effects on research performance.
        Extracted qualification evidence requires factual review.
      </div>
      <Card
        title="A world of academic pathways"
        subtitle="Click a country to inspect its profiles. Map boundaries are bundled locally."
        action={
          country && (
            <Button variant="outline" onClick={() => setCountry("")}>
              Clear {country}
            </Button>
          )
        }
      >
        {ready ? (
          <Chart
            height={470}
            label="World map of PhD awarding countries"
            option={{
              tooltip: { renderMode: "richText" },
              visualMap: {
                min: 0,
                max: Math.max(1, ...groups.map((g) => g.rows.length)),
                text: ["More profiles", "Fewer"],
                left: 20,
                bottom: 20,
                inRange: { color: ["#e4edf3", "#156f94"] },
                textStyle: { fontSize: 14 },
              },
              series: [
                {
                  type: "map",
                  map: "world",
                  roam: true,
                  selectedMode: "single",
                  itemStyle: {
                    areaColor: "#ecf1f5",
                    borderColor: "#fff",
                    borderWidth: 0.5,
                  },
                  emphasis: { itemStyle: { areaColor: "#70bdab" } },
                  select: { itemStyle: { areaColor: "#ce9550" } },
                  data: groups.map((g) => ({
                    name: mapName(g.id),
                    value: g.rows.length,
                    selected: g.id === country,
                  })),
                },
              ],
            }}
            onClick={(p) => setCountry(mapCountry(p.name))}
          />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : (
          <div className="skeleton" style={{ height: 470 }} />
        )}
        <div className="country-pills">
          {groups.map((g) => (
            <Button
              variant={country === g.id ? "default" : "outline"}
              key={g.id}
              onClick={() => setCountry(country === g.id ? "" : g.id)}
            >
              {g.id}
              <span>{g.rows.length}</span>
            </Button>
          ))}
        </div>
      </Card>
      <div className="two-columns">
        <Card
          title={country || "All recorded origins"}
          subtitle={`${rows.length} profiles · ${new Set(rows.map((a) => a.universityId)).size} current institutions`}
        >
          <div className="origin-details">
            <h3>Current institutions</h3>
            {groupRows(rows, "university").map((g) => (
              <div className="detail-line" key={g.id}>
                <span>{short(g.label)}</span>
                <strong>{g.rows.length}</strong>
              </div>
            ))}
            <h3>Academic positions</h3>
            {groupRows(rows, "rank").map((g) => (
              <div className="detail-line" key={g.id}>
                <span>{g.label}</span>
                <strong>{g.rows.length}</strong>
              </div>
            ))}
            <h3>PhD awarding institutions</h3>
            {[...new Set(rows.map((a) => a.phdUniversity).filter(Boolean))].map(
              (u) => (
                <p key={u}>{u}</p>
              ),
            )}
            <h3>Research areas</h3>
            <p>
              {[...new Set(rows.map((a) => a.interests).filter(Boolean))].join(
                "; ",
              ) || "Not available"}
            </p>
          </div>
        </Card>
        <Card
          title="Research context"
          subtitle="Valid metric counts accompany every summary"
        >
          <div className="stats-grid two">
            {(["citations", "publications", "hIndex", "q1"] as const).map(
              (m) => (
                <Stat
                  key={m}
                  label={"Median " + m}
                  value={fmt(aggregate(rows, m, "median").value, 1)}
                  detail={`${aggregate(rows, m, "median").n} valid profiles`}
                />
              ),
            )}
          </div>
          <Chart
            height={290}
            option={{
              tooltip: { renderMode: "richText" },
              grid: { left: 80, right: 25, top: 25, bottom: 50 },
              xAxis: {
                type: "category",
                data: groupRows(rows, "rank").map((g) => g.label),
                axisLabel: { fontSize: 14, rotate: 15 },
              },
              yAxis: { type: "value", name: "Citations" },
              series: [
                {
                  type: "boxplot",
                  data: groupRows(rows, "rank").map((g) => {
                    const s = summary(values(g.rows.map((a) => a.citations)));
                    return [s.min, s.q1, s.median, s.q3, s.max];
                  }),
                  itemStyle: { color: "#e2edf6", borderColor: "#2675b9" },
                },
              ],
            }}
          />
        </Card>
      </div>
      <Card
        title="From doctorate to current institution"
        subtitle="PhD country → awarding university → current Sri Lankan institution"
        action={
          <select
            aria-label="Sankey detail"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="simple">Country → current institution</option>
            <option value="full">Include PhD university</option>
          </select>
        }
      >
        {known.length ? (
          <Chart
            height={500}
            option={{
              tooltip: { renderMode: "richText" },
              series: [
                {
                  type: "sankey",
                  left: 20,
                  right: 200,
                  top: 20,
                  bottom: 20,
                  nodeGap: 12,
                  label: {
                    fontSize: 14,
                    formatter: (p: any) =>
                      p.name.replace(/^(Country|Current|PhD): /, ""),
                  },
                  data: [...nodes].map((name) => ({ name })),
                  links: [...links.values()],
                  lineStyle: { color: "source", opacity: 0.25 },
                  emphasis: { focus: "adjacency" },
                },
              ],
            }}
          />
        ) : (
          <Empty />
        )}
      </Card>
      <Card
        title={
          country
            ? `Academics with a PhD institution in ${country}`
            : "Profiles with recorded PhD origins"
        }
      >
        <AcademicTable rows={rows} />
      </Card>
    </>
  );
}

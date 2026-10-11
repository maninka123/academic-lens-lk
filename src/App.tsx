import { useEffect, useState } from "react";
import {
  HashRouter,
  NavLink,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  ChartNoAxesCombined,
  Users,
  Globe2,
  Database,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useAtlas, restoreFromUrl } from "./store";
import { loadDataset } from "./data/loader";
import { DataContext } from "./data/context";
import type { Dataset } from "./types";
import { Overview } from "./pages/Overview";
import { Compare } from "./pages/Compare";
import { Academics, Profile, Institution } from "./pages/Academics";
import { Origins } from "./pages/Origins";
import { Methodology } from "./pages/Methodology";
import { Filters } from "./components/Filters";
import { Button } from "./components/ui/button";
import { Empty } from "./components/common";
restoreFromUrl();
function Shell() {
  const { mode, setMode, theme, setTheme, pinned } = useAtlas();
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    loadDataset(mode)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [mode]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const sharedDataset = new URLSearchParams(location.search).get("dataset");
  const routes = [
    ["/", "Overview", LayoutDashboard],
    ["/compare", "Compare", ChartNoAxesCombined],
    ["/academics", "Academics", Users],
    ["/origins", "PhD Origins", Globe2],
    ["/methodology", "Data & Methodology", Database],
  ] as const;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
        <Button
          className="mobile-nav-close"
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={22} />
        </Button>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOpen size={23} />
          </span>
          <span>
            Academic Atlas<small>SRI LANKA</small>
          </span>
        </Link>
        <div className="nav-caption">EXPLORE THE LANDSCAPE</div>
        <nav>
          {routes.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={21} />
              <span>{label}</span>
              {path === "/compare" && pinned.length > 0 && (
                <b>{pinned.length}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="dataset-card">
            <span className="status-dot" />
            <strong>{mode === "demo" ? "Demo Data" : "Partial dataset"}</strong>
            <p>{data?.metadata.version || "Loading collection…"}</p>
            <label className="field">
              Data source
              <select
                aria-label="Dataset"
                value={mode}
                onChange={(e) => setMode(e.target.value as "real" | "demo")}
              >
                <option value="real">Real collected data</option>
                <option value="demo">Demo Data (fictional)</option>
              </select>
            </label>
          </div>
          <Button variant="ghost" onClick={setTheme}>
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}{" "}
            {theme === "light" ? "Dark appearance" : "Light appearance"}
          </Button>
          <a
            className="repo-link"
            href="https://github.com/maninka123/academic-lens-lk"
            target="_blank"
            rel="noreferrer"
          >
            Project on GitHub
            <ArrowUpRight size={16} />
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation overlay"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-content">
        <div className="topbar">
          <div className="inline">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </Button>
            <span className="breadcrumb">
              Academic Atlas <span>/</span>{" "}
              {routes.find(
                ([p]) => p !== "/" && location.pathname.startsWith(p),
              )?.[1] || "Overview"}
            </span>
          </div>
          <span className={"data-badge " + (mode === "demo" ? "demo" : "")}>
            <span className="status-dot" />
            {mode === "demo"
              ? "Demo Data · fictional"
              : "Partial real collection"}
          </span>
        </div>
        <main id="main-content" className="main-content">
          {error ? (
            <Empty title="Unable to load the dataset">
              {error}
              <br />
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </Empty>
          ) : !data ? (
            <div className="loading" aria-live="polite">
              <div className="skeleton" style={{ height: 80 }} />
              <div className="skeleton" style={{ height: 180 }} />
              <p>Loading academic data…</p>
            </div>
          ) : (
            <DataContext.Provider value={data}>
              {sharedDataset && sharedDataset !== data.metadata.version && (
                <div className="notice">
                  This link was created with dataset {sharedDataset}. The loaded
                  version is {data.metadata.version}; results may differ.
                </div>
              )}
              {mode === "demo" && (
                <div className="demo-banner">
                  Demo Data · All names and metrics are fictional. Switch to
                  real collected data in the sidebar.
                </div>
              )}
              {mode === "real" && (
                <div className="collection-banner">
                  Partial collection · Extracted profiles require factual
                  review.{" "}
                  <Link to="/methodology">View coverage and limitations</Link>
                </div>
              )}
              {location.pathname !== "/compare" && <Filters />}
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/academics" element={<Academics />} />
                <Route path="/academics/:id" element={<Profile />} />
                <Route path="/origins" element={<Origins />} />
                <Route path="/methodology" element={<Methodology />} />
                <Route path="/university/:id" element={<Institution />} />
                <Route
                  path="/university/:id/faculty/:faculty"
                  element={<Institution />}
                />
                <Route
                  path="/university/:id/faculty/:faculty/department/:department"
                  element={<Institution />}
                />
                <Route
                  path="*"
                  element={
                    <Empty title="Page not found">
                      <Link to="/">Return to overview</Link>
                    </Empty>
                  }
                />
              </Routes>
            </DataContext.Provider>
          )}
          <footer>
            Built for exploration, with context.{" "}
            <span>Sri Lanka Academic Atlas · 2026</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

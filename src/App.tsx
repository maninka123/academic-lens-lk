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
useAtlas.getState().configure({});
restoreFromUrl();
function Shell() {
  const { theme, setTheme, pinned } = useAtlas();
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  const [shareError, setShareError] = useState(
    () => sessionStorage.getItem("atlas-share-error") || "",
  );
  useEffect(() => {
    if (location.search.includes("view=")) {
      restoreFromUrl();
      setShareError(sessionStorage.getItem("atlas-share-error") || "");
    }
  }, [location.search]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    loadDataset()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    sidebar?.querySelector<HTMLButtonElement>(".mobile-nav-close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
      if (e.key === "Tab") {
        const items = [
          ...(sidebar?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), select",
          ) || []),
        ];
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
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
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
      <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
        <Button
          className="mobile-nav-close"
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          onClick={() => {
            setMenu(false);
            document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
          }}
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
            <strong>Collected dataset</strong>
            <p>{data?.metadata.collectionDate || "Loading collection…"}</p>
            <small>
              Collected academic profiles · updated from project data files
            </small>
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
          onClick={() => {
            setMenu(false);
            document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
          }}
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
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </Button>
            <span className="breadcrumb">
              Academic Atlas <span>/</span>{" "}
              {routes.find(
                ([p]) => p !== "/" && location.pathname.startsWith(p),
              )?.[1] ||
                (location.pathname.startsWith("/university/")
                  ? "Institutions"
                  : "Overview")}
            </span>
          </div>
          <span className="data-badge">
            <span className="status-dot" />
            Partial real collection
          </span>
        </div>
        <main id="main-content" className="main-content" tabIndex={-1}>
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
              {shareError && (
                <div className="notice" role="alert">
                  {shareError}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      sessionStorage.removeItem("atlas-share-error");
                      setShareError("");
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              {sharedDataset && sharedDataset !== data.metadata.version && (
                <div className="notice">
                  This link was created with dataset {sharedDataset}. The loaded
                  version is {data.metadata.version}; results may differ.
                </div>
              )}
              <div className="collection-banner">
                Partial collection · Extracted profiles require factual review.{" "}
                <Link to="/methodology">View coverage and limitations</Link>
              </div>
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

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Filters } from "./Filters";
import { useAtlas } from "../store";

/** Number of filters currently narrowing the dataset (ranges count once). */
export function activeFilterCount(f: ReturnType<typeof useAtlas.getState>["filters"]) {
  return Object.values(f).filter((v) =>
    Array.isArray(v) ? v.some((x) => x !== null && x !== "") : Boolean(v),
  ).length;
}

/** Corner control for the dataset-wide filters; every page reads the same filters. */
export function GlobalFilterButton() {
  const filters = useAtlas((s) => s.filters);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const n = activeFilterCount(filters);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="global-filter" ref={box}>
      <button
        type="button"
        className={"global-filter-button" + (n ? " active" : "")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        title="Filters applied to every page"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filters
        {n > 0 && <span className="global-filter-count">{n}</span>}
      </button>
      {open && (
        <div className="global-filter-panel" role="dialog" aria-label="Dataset filters">
          <p className="caption">These filters apply to every page, not just one view.</p>
          <Filters compact />
        </div>
      )}
    </div>
  );
}

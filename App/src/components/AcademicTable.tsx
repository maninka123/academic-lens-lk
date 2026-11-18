import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Link } from "react-router-dom";
import {
  Pin,
  Download,
  ChevronLeft,
  ChevronRight,
  Columns3,
} from "lucide-react";
import type { Academic } from "../types";
import { useAtlas } from "../store";
import { Button } from "./ui/button";
import { fmt, short, exportCsv, NumericValue, CountryName } from "./common";
export function AcademicTable({
  rows,
  columnFilters = false,
  sortMetric,
  selectedIds,
  onToggleSelect,
  maxSelect = 3,
}: {
  rows: Academic[];
  columnFilters?: boolean;
  /** People ticked for the side-by-side view (shows a tick column when set). */
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  maxSelect?: number;
  /** Numeric column to show and sort high to low, with missing values last. */
  sortMetric?: string;
}) {
  const { pin, unpin, pinned } = useAtlas();
  const [sorting, setSorting] = useState<SortingState>(
    sortMetric
      ? [{ id: sortMetric, desc: true }, { id: "name", desc: false }]
      : [
          { id: "rank", desc: false },
          { id: "name", desc: false },
        ],
  );
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({
    faculty: false,
    department: false,
    qualification: false,
    phdCountry: false,
    recentCitations: sortMetric === "recentCitations",
  });
  const cols = useMemo<ColumnDef<Academic>[]>(
    () => [
      {
        id: "pin",
        header: "Pin",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              (pinned.includes(row.original.id) ? "Unpin " : "Pin ") +
              row.original.name
            }
            onClick={() =>
              pinned.includes(row.original.id)
                ? unpin(row.original.id)
                : pin(row.original.id)
            }
          >
            <Pin
              size={18}
              fill={pinned.includes(row.original.id) ? "currentColor" : "none"}
            />
          </Button>
        ),
      },
      ...(onToggleSelect && selectedIds
        ? [
            {
              id: "select",
              header: "Side by side",
              enableSorting: false,
              enableColumnFilter: false,
              cell: ({ row }: any) => {
                const on = selectedIds.includes(row.original.id);
                return (
                  <input
                    type="checkbox"
                    className="sbs-check"
                    checked={on}
                    disabled={!on && selectedIds.length >= maxSelect}
                    aria-label={`View ${row.original.name} side by side`}
                    title={!on && selectedIds.length >= maxSelect ? `Up to ${maxSelect} people` : "View side by side"}
                    onChange={() => onToggleSelect(row.original.id)}
                  />
                );
              },
            } as ColumnDef<Academic>,
          ]
        : []),
      {
        accessorKey: "name",
        header: "Academic",
        cell: ({ row }) => (
          <Link className="academic-name" to={"/academics/" + row.original.id}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "university",
        header: "University",
        cell: ({ getValue }) => short(String(getValue())),
      },
      { accessorKey: "faculty", header: "Faculty" },
      { accessorKey: "department", header: "Department" },
      {
        accessorKey: "rank",
        header: "Position",
        sortingFn: (a, b) => {
          const order = [
            "Senior Professor",
            "Professor",
            "Associate Professor",
            "Assistant Professor",
            "Senior Lecturer",
            "Lecturer",
            "Assistant Lecturer",
            "Instructor",
            "Librarian",
            "Other",
            "Unknown",
          ];
          const level = (rank: string) => {
            const i = order.indexOf(rank);
            return i < 0 ? order.length : i;
          };
          return level(a.original.rank) - level(b.original.rank);
        },
      },
      { accessorKey: "qualification", header: "Qualification" },
      {
        accessorKey: "phdCountry",
        header: "PhD country",
        cell: ({ getValue }) => getValue() ? <CountryName country={String(getValue())} /> : "—",
      },
      ...(
        [
          "publications",
          "citations",
          "recentCitations",
          "hIndex",
        ] as const
      ).map((key) => ({
        id: key,
        accessorFn: (r: Academic) => r[key] ?? undefined,
        sortUndefined: "last" as const,
        filterFn: ((row: any, id: string, range: [string, string]) => {
          const value = row.getValue(id);
          const [min, max] = range;
          return (
            value != null &&
            (min === "" || value >= Number(min)) &&
            (max === "" || value <= Number(max))
          );
        }) as any,
        header: {
          publications: "Publications",
          citations: "Citations",
          recentCitations: "5-year citations",
          hIndex: "h-index",
        }[key],
        cell: ({ getValue }: any) => (
          <NumericValue
            value={getValue()}
            maximum={Math.max(0, ...rows.map((r) => r[key] ?? 0))}
            digits={0}
          />
        ),
      })),
    ],
    [pinned, pin, unpin, rows, selectedIds, onToggleSelect, maxSelect],
  );
  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { sorting, columnVisibility: visibility, columnFilters: filters },
    onColumnFiltersChange: setFilters,
    getFilteredRowModel: getFilteredRowModel(),
    defaultColumn: { filterFn: "includesString" },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });
  return (
    <div className="table-section">
      <div className="table-toolbar">
        <span>
          {table.getFilteredRowModel().rows.length.toLocaleString()} matching
          profiles | — means unavailable
        </span>
        <div className="inline">
          {filters.length > 0 && (
            <Button variant="ghost" onClick={() => setFilters([])}>
              Clear column filters
            </Button>
          )}
          <details className="columns-menu">
            <summary>
              <Columns3 size={17} />
              Columns
            </summary>
            <div>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <label className="check" key={c.id}>
                    <input
                      type="checkbox"
                      checked={c.getIsVisible()}
                      onChange={c.getToggleVisibilityHandler()}
                    />
                    {String(c.columnDef.header)}
                  </label>
                ))}
            </div>
          </details>
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(table.getFilteredRowModel().rows.map((r) => r.original))
            }
          >
            <Download size={17} />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="academic-records-table">
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id}>
                    <button
                      disabled={!h.column.getCanSort()}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc"
                        ? " ↑"
                        : h.column.getIsSorted() === "desc"
                          ? " ↓"
                          : ""}
                    </button>
                    {columnFilters &&
                      h.column.getCanFilter() &&
                      ([
                        "publications",
                        "citations",
                        "recentCitations",
                        "hIndex",
                      ].includes(h.column.id) ? (
                        <div className="column-range">
                          {["Minimum", "Maximum"].map((label, index) => (
                            <input
                              key={label}
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`${label} ${h.column.columnDef.header}`}
                              placeholder={index === 0 ? "Min" : "Max"}
                              value={
                                (
                                  h.column.getFilterValue() as
                                    [string, string] | undefined
                                )?.[index] || ""
                              }
                              onChange={(e) => {
                                const range = [
                                  ...((h.column.getFilterValue() as [
                                    string,
                                    string,
                                  ]) || ["", ""]),
                                ];
                                range[index] = e.target.value;
                                h.column.setFilterValue(
                                  range.some(Boolean) ? range : undefined,
                                );
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <input
                          className="column-filter"
                          type="search"
                          aria-label={`Filter ${h.column.columnDef.header}`}
                          placeholder="Filter…"
                          value={(h.column.getFilterValue() as string) || ""}
                          onChange={(e) =>
                            h.column.setFilterValue(e.target.value || undefined)
                          }
                        />
                      ))}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!table.getFilteredRowModel().rows.length && (
          <div className="empty">No profiles match these filters.</div>
        )}
      </div>
      <div className="pagination">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(1, table.getPageCount())}
        </span>
        <div className="inline">
          <Button
            variant="outline"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="outline"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

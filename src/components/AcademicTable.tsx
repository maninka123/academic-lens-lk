import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
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
import { fmt, short, exportCsv } from "./common";
export function AcademicTable({ rows }: { rows: Academic[] }) {
  const { pin, unpin, pinned } = useAtlas();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({
    faculty: false,
    department: false,
    qualification: false,
    phdCountry: false,
    experience: false,
    recentCitations: false,
    q1: false,
    recentQ1: false,
  });
  const cols = useMemo<ColumnDef<Academic>[]>(
    () => [
      {
        id: "pin",
        header: "Pin",
        enableSorting: false,
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
      { accessorKey: "rank", header: "Position" },
      { accessorKey: "qualification", header: "Qualification" },
      { accessorKey: "phdCountry", header: "PhD country" },
      ...(
        [
          "experience",
          "publications",
          "citations",
          "recentCitations",
          "hIndex",
          "q1",
          "recentQ1",
        ] as const
      ).map((key) => ({
        accessorKey: key,
        header: {
          experience: "Experience",
          publications: "Publications",
          citations: "Citations",
          recentCitations: "5-year citations",
          hIndex: "h-index",
          q1: "Q1",
          recentQ1: "5-year Q1",
        }[key],
        cell: ({ getValue }: any) => (
          <span className="numeric">
            {getValue() === null ? "—" : fmt(getValue())}
          </span>
        ),
      })),
    ],
    [pinned, pin, unpin],
  );
  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { sorting, columnVisibility: visibility },
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
          {rows.length.toLocaleString()} matching profiles · — means unavailable
        </span>
        <div className="inline">
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
          <Button variant="outline" onClick={() => exportCsv(rows)}>
            <Download size={17} />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
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
        {!rows.length && (
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

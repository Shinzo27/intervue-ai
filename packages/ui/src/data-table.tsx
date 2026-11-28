"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "./lib/cn";
import { Skeleton } from "./skeleton";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  /** Hide the column below a breakpoint to keep tables readable on phones. */
  hideBelow?: "sm" | "md" | "lg";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible name for the table. */
  label: string;
  loading?: boolean;
  /** Shown instead of the body when there are no rows. */
  empty?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /**
   * Makes the whole row clickable by stretching the link marked `data-row-link`.
   * It is a real link, so keyboard and screen-reader users get it too.
   */
  rowLinks?: boolean;
  className?: string;
}

const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** Dense, sortable data table: sticky header, 44px rows, horizontal scroll on small screens. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  loading = false,
  empty,
  initialSort,
  rowLinks = false,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const value = column.sortValue;
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const result = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? result : -result;
    });
  }, [rows, columns, sort]);

  function toggle(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-surface shadow-sm",
        className,
      )}
    >
      <table aria-label={label} aria-busy={loading || undefined} className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined;
              const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    "h-10 whitespace-nowrap border-b border-border px-4 text-xs font-medium text-muted-fg",
                    column.align === "right" ? "text-right" : "text-left",
                    column.hideBelow && hide[column.hideBelow],
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 transition-colors hover:text-fg",
                        active && "text-fg",
                      )}
                    >
                      {column.header}
                      <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn("h-11 px-4", column.hideBelow && hide[column.hideBelow])}
                    >
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : sorted.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={cn(
                    "border-b border-border transition-colors last:border-0 hover:bg-surface-hover",
                    rowLinks &&
                      "relative cursor-pointer [&_[data-row-link]]:after:absolute [&_[data-row-link]]:after:inset-0 [&_[data-row-link]]:after:content-['']",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "h-11 px-4 py-2 align-middle",
                        column.align === "right" && "text-right",
                        column.hideBelow && hide[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

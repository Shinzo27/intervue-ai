"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** "1–20 of 57" with previous/next; pages are 1-based. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-1 py-3 text-sm">
      <p className="tabular text-muted-fg">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          aria-label="Previous page"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </IconButton>
        <span className="tabular px-2 text-muted-fg">
          {page} / {pageCount}
        </span>
        <IconButton
          aria-label="Next page"
          variant="secondary"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </IconButton>
      </div>
    </nav>
  );
}

/** Slice helper for client-side pagination. */
export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

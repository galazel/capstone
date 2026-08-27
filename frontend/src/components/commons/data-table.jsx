/**
 * Data-table chrome.
 *
 * One shape for every list in the product: a plain white card holding a
 * toolbar, the rows, and a numbered pager. Not a grid of cards — a table reads
 * down a column, and comparing values down a column is the entire reason a list
 * is a list. Cards make the reader compare across boxes instead.
 *
 * The three parts are separate exports rather than one <DataTable rows columns>
 * component on purpose: every page here renders genuinely different cells
 * (avatars, progress bars, status pills, row menus), and a column-config API
 * would end up taking a render function per column anyway. These give a page
 * the chrome and leave the <tbody> alone.
 */

import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  Search,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableHead } from "@/components/ui/table"

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * Surface classes for a plain <Card> that holds a table, so those pages match
 * TableCard instead of out-weighing it.
 *
 * Card's default is a 2px border plus the design system's 2px solid "lip"
 * shadow. That reads well on a small tile, but a table is the widest surface
 * on its page: at that size the lip is a bar under the whole panel, and the
 * heavy border is a crate. A data panel sits flat -- the rows are the content,
 * not the box.
 */
export const TABLE_SURFACE = "border border-border/70 shadow-none"

/**
 * The card the toolbar, table, and pager sit in.
 *
 * One hairline, not the 2px cage this used to draw. At full page width a heavy
 * border reads as a crate around the data rather than an edge to it, and it
 * was competing with the rules the toolbar, header band and pager already put
 * across the same surface.
 */
export function TableCard({ className = "", children }) {
  return (
    <div className={`overflow-hidden rounded-rb-card border border-border/70 bg-card ${className}`}>
      {children}
    </div>
  )
}

/**
 * "Show [n] entries" on the left, search on the right, and room between them
 * for a page's own filters.
 */
export function TableToolbar({
  pageSize,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search table field",
  children,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Show
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-[74px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            entries
          </label>
        ) : null}

        {children}
      </div>

      {onSearchChange ? (
        <label className="relative w-full lg:max-w-xs">
          <span className="sr-only">{searchPlaceholder}</span>
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pr-9"
          />
          <Search
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </label>
      ) : null}
    </div>
  )
}

/**
 * A header cell that sorts. `sort` is the {key, direction} state and `onSort`
 * takes the column key — see useTableSort below, which owns both.
 */
export function SortableHead({ column, label, sort, onSort, className = "", align = "left" }) {
  const isActive = sort?.key === column
  const Arrow = !isActive
    ? ChevronsUpDownIcon
    : sort.direction === "asc"
      ? ChevronUpIcon
      : ChevronDown

  return (
    <TableHead className={`${className} ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1 text-[13px] font-bold uppercase tracking-wide transition-colors hover:text-foreground ${
          isActive ? "text-foreground" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Arrow
          className={`size-3.5 shrink-0 transition-opacity ${
            isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"
          }`}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}

/** A plain header cell, so unsortable columns still match the sortable ones. */
export function PlainHead({ label, className = "", align = "left" }) {
  return (
    <TableHead className={`${className} ${align === "right" ? "text-right" : ""}`}>
      <span className="text-[13px] font-bold uppercase tracking-wide">{label}</span>
    </TableHead>
  )
}

/**
 * Sort state plus the comparator. `accessors` maps a column key to a function
 * returning the value to sort on, so a column can sort on something other than
 * what it renders (a date's timestamp, a name's surname).
 */
export function useTableSort(initialKey = null, initialDirection = "asc") {
  const [sort, setSort] = useState(
    initialKey ? { key: initialKey, direction: initialDirection } : null
  )

  function toggle(key) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" }
      /* Third click clears the sort — the list returns to whatever order the
         server sent, which is usually "newest first" and worth getting back. */
      if (current.direction === "asc") return { key, direction: "desc" }
      return null
    })
  }

  function sortRows(rows, accessors) {
    if (!sort || !accessors?.[sort.key]) return rows

    const read = accessors[sort.key]
    const factor = sort.direction === "asc" ? 1 : -1

    return [...rows].sort((a, b) => {
      const left = read(a)
      const right = read(b)

      if (left == null && right == null) return 0
      if (left == null) return 1 /* blanks sink, in either direction */
      if (right == null) return -1

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor
      }

      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor
    })
  }

  return { sort, toggle, sortRows }
}

/** Windowed page numbers: 1 … 4 5 6 … 12, never more than seven slots. */
function pageWindow(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const slots = new Set([1, totalPages, page, page - 1, page + 1])
  if (page <= 3) [2, 3, 4].forEach((value) => slots.add(value))
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((value) => slots.add(value))
  }

  const pages = [...slots].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)

  const withGaps = []
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) withGaps.push("gap")
    withGaps.push(value)
  })
  return withGaps
}

/** Previous · numbered pages · Next, with the counted range beside it. */
export function TablePagination({
  page,
  totalPages,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  unit = "entries",
}) {
  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages])

  return (
    <div className="flex flex-col items-center gap-3 border-t border-border/60 px-4 py-4 sm:px-5 md:flex-row md:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-bold text-foreground tabular-nums">{rangeStart}</span>–
        <span className="font-bold text-foreground tabular-nums">{rangeEnd}</span> of{" "}
        <span className="font-bold text-foreground tabular-nums">{total}</span> {unit}
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full px-3"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>

        {pages.map((value, index) =>
          value === "gap" ? (
            <span
              key={`gap-${index}`}
              className="px-2 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              onClick={() => onPageChange(value)}
              aria-current={value === page ? "page" : undefined}
              className={`size-9 rounded-full text-sm font-bold tabular-nums transition-colors ${
                value === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {value}
            </button>
          )
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full px-3"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </nav>
    </div>
  )
}

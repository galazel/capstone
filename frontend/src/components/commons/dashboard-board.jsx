import { useEffect, useMemo, useRef, useState } from "react"
import { Responsive } from "react-grid-layout"

import { GripHorizontal } from "@/components/icons"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import "./dashboard-board.css"

/**
 * The board's own width, measured continuously.
 *
 * Not `WidthProvider`, which the library ships for this: it reads `offsetWidth`
 * once on mount and then only re-checks on a *window* resize. Mounted inside a
 * layout that is still settling -- this page renders behind an entitlement
 * guard and a loading branch -- it measures near zero and stays there, which
 * collapses every tile into a sliver. A ResizeObserver on the container sees
 * the real width whenever it changes, window resize or not.
 */
function useContainerWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry?.contentRect?.width ?? element.offsetWidth))
    })
    observer.observe(element)
    setWidth(element.offsetWidth)

    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

const COLS = { lg: 6, md: 6, sm: 2, xs: 1, xxs: 1 }
const BREAKPOINTS = { lg: 1024, md: 768, sm: 640, xs: 480, xxs: 0 }
const ROW_HEIGHT = 176
const MARGIN = [20, 20]

/**
 * Packs the default tile table into rows six columns wide, left to right, the
 * way the CSS grid used to. Only used until the learner arranges the board
 * themselves.
 */
function defaultLayout(tiles) {
  let x = 0
  let y = 0
  let rowHeight = 0

  return tiles.map((tile) => {
    const w = Math.min(tile.col ?? 2, COLS.lg)
    const h = tile.row ?? 1

    if (x + w > COLS.lg) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }

    const item = { i: tile.id, x, y, w, h }
    x += w
    rowHeight = Math.max(rowHeight, h)
    return item
  })
}

/**
 * The learner's analytics board: tiles placed by coordinate, dragged and
 * resized freely.
 *
 * Coordinates rather than a sortable sequence, which is what this replaced. A
 * sortable grid can only reorder, and with tiles of different sizes CSS grid
 * back-fills the gaps -- so a tile dropped in a chosen spot would slide
 * somewhere else, which reads as the board fighting you.
 *
 * Tiles do settle upward after a move (`compactType="vertical"`). Leaving gaps
 * exactly where they fall is the stricter reading of "put it where I want", but
 * in practice one move opens a hole the board then keeps, and the page reads as
 * broken rather than arranged.
 *
 * @param tiles     [{ id, col, row, element }] — defaults for a fresh board
 * @param layout    saved [{ id, x, y, w, h }]
 * @param editing   whether tiles can be dragged and resized
 * @param onLayoutChange  called with the full layout after a move or resize
 */
export function DashboardBoard({ tiles, layout, editing = false, onLayoutChange }) {
  const [containerRef, width] = useContainerWidth()
  const byId = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles])

  const currentLayout = useMemo(() => {
    // Every coordinate has to be present and whole. A row saved by an earlier
    // version of this board carried `col`/`row` instead of `x/y/w/h`, and those
    // entries parse into nulls -- handing react-grid-layout an item without
    // coordinates puts the tile somewhere arbitrary rather than failing, which
    // reads as the layout having been lost. Treated as unmentioned instead, so
    // the tile takes its default place.
    const saved = (layout ?? []).filter(
      (item) =>
        byId.has(item.id) &&
        [item.x, item.y, item.w, item.h].every((value) => Number.isInteger(value))
    )
    const savedIds = new Set(saved.map((item) => item.id))

    // Tiles the saved board does not mention keep their default placement, so
    // shipping a new tile later never breaks an arrangement someone made.
    const missing = tiles.filter((tile) => !savedIds.has(tile.id))
    const fallback = defaultLayout(missing)
    const lowest = saved.reduce((max, item) => Math.max(max, item.y + item.h), 0)

    return [
      ...saved.map((item) => ({ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h })),
      ...fallback.map((item) => ({ ...item, y: item.y + lowest })),
    ]
  }, [tiles, layout, byId])

  const handleLayoutChange = (next) => {
    if (!editing) return
    onLayoutChange?.(
      next.map((item) => ({ id: item.i, x: item.x, y: item.y, w: item.w, h: item.h }))
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      {width === 0 ? (
        // Nothing is rendered until the width is known: laying tiles out
        // against a guessed width and then re-flowing is a visible jump.
        <div className="h-96" aria-hidden="true" />
      ) : (
    <Responsive
      width={width}
      className={`rebyu-board ${editing ? "is-editing" : ""}`}
      layouts={{ lg: currentLayout, md: currentLayout }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      // Dragging is on a handle: these tiles hold buttons, checkboxes and
      // selectable text, and a whole-surface drag target swallows all of it.
      draggableHandle=".rebyu-board-handle"
      isDraggable={editing}
      isResizable={editing}
      resizeHandles={["se"]}
      // Tiles settle upward after every move, so the board never keeps a hole
      // where one used to be. Placement is still the learner's -- what they
      // choose is the order and which tiles share a row -- but the page stays
      // a page rather than becoming a scatter of cards with gaps between them.
      // (`null` here, which leaves gaps exactly as dropped, is what made the
      // board look broken the moment anything was moved.)
      compactType="vertical"
      preventCollision={false}
      allowOverlap={false}
      onDragStop={handleLayoutChange}
      onResizeStop={handleLayoutChange}
    >
      {currentLayout.map((item) => {
        const tile = byId.get(item.i)
        if (!tile) return null

        return (
          <div key={item.i} className="min-w-0">
            {tile.element}

            {editing ? (
              <button
                type="button"
                aria-label={`Move ${item.i.replaceAll("-", " ")}`}
                className="rebyu-board-handle absolute right-2 top-2 z-10 grid size-7 cursor-grab place-items-center rounded-lg bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
              >
                <GripHorizontal className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )
      })}
    </Responsive>
      )}
    </div>
  )
}

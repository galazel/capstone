import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-slate-950/30 duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/** Diameter of the close key, and how far its centre sits inside the corner. */
const CLOSE_SIZE = 48
const VIEWPORT_MARGIN = 8

/** Gap between the panel's right edge and the close key. */
const CORNER_GAP = 8

/**
 * Pins a fixed-position element to the top-right corner of `ref`, straddling it
 * so the key reads as attached to the panel rather than floating in the page.
 *
 * The close key cannot be a child of the dialog panel — panels that scroll would
 * clip it away — so it cannot inherit the panel's box and has to measure it.
 *
 * Measurement runs on a short rAF loop rather than once on mount: the panel
 * animates in with `zoom-in-95`, and a transform does not trigger
 * ResizeObserver, so a single early read would anchor the key to the panel's
 * 95%-scale box and leave it visibly offset. After the animation settles, a
 * ResizeObserver plus a resize listener keep it in place for content that grows
 * or a window that changes size.
 *
 * Takes the element from a callback ref, not a ref object: the panel lives
 * inside a portal, which mounts its children in an effect, so a ref object is
 * still null when this hook's layout effect first runs. Keyed on the element
 * itself, the effect re-runs the moment the panel actually exists.
 */
function useCornerAnchor(
  el: HTMLElement | null,
  enabled: boolean
): React.CSSProperties | undefined {
  const [style, setStyle] = React.useState<React.CSSProperties>()

  React.useLayoutEffect(() => {
    if (!enabled || !el) return

    const clamp = (value: number, max: number) =>
      Math.min(Math.max(value, VIEWPORT_MARGIN), max - CLOSE_SIZE - VIEWPORT_MARGIN)

    const update = () => {
      const rect = el.getBoundingClientRect()
      setStyle({
        // Beside the panel, not straddling it. Centred on the corner the key
        // sat half on top of the dialog and covered whatever the header put
        // near its right edge; `clamp` still pulls it back over the panel when
        // the viewport has no room beside it, which is the only case where
        // overlapping beats being off-screen.
        left: clamp(rect.right + CORNER_GAP, window.innerWidth),
        top: clamp(rect.top - CLOSE_SIZE / 2, window.innerHeight),
      })
    }

    update()

    // Follow the open animation, then stop.
    let frame = 0
    const started = performance.now()
    const follow = () => {
      update()
      if (performance.now() - started < 400) frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)

    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener("resize", update)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [el, enabled])

  return style
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [contentEl, setContentEl] = React.useState<HTMLDivElement | null>(null)
  const closeCorner = useCornerAnchor(contentEl, showCloseButton)

  return (
    <DialogPortal>
      <DialogOverlay />
      {showCloseButton && (
        // Deliberately a SIBLING of the content, not a child. 14 of the app's
        // dialogs set their own `overflow-y-auto` for long bodies, and a child
        // positioned outside the panel would be clipped away by that — the
        // dialog would render with no visible way to close it. A sibling can
        // never be clipped, which is why its position has to be measured from
        // the panel rather than inherited from it.
        //
        // Same round tactile key as `.rb-btn-icon` / BackButton, rebuilt with
        // utilities because a portal renders outside the `.rebyu-ds` scope
        // those classes need. Snow face, not the blue one: it sits on the
        // dimmed overlay where a filled primary key would out-shout the
        // dialog's own call to action.
        <DialogPrimitive.Close data-slot="dialog-close" asChild>
          <button
            type="button"
            // aria-hidden + tabIndex -1: this key sits outside Radix's focus
            // trap, so it is unreachable by keyboard. The sr-only Close inside
            // the content below is the keyboard/screen-reader path, and Esc
            // still dismisses. Exposing both would announce Close twice.
            aria-hidden="true"
            tabIndex={-1}
            style={closeCorner}
            // `pointer-events-auto` is load-bearing: Radix puts
            // `pointer-events: none` on <body> for a modal dialog and only
            // re-enables it on the content, so a sibling inherits the block and
            // silently becomes unclickable. z-51 puts it over the overlay.
            // `opacity-0` until measured, so it never flashes at 0,0.
            className={cn(
              "pointer-events-auto fixed z-51 inline-flex size-12 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-[0_4px_0_var(--border)] transition-[transform,box-shadow,filter] duration-75 hover:brightness-[0.98] active:translate-y-1 active:shadow-none motion-reduce:transition-none",
              closeCorner ? "opacity-100" : "opacity-0"
            )}
          >
            <ArrowLeftIcon className="size-4" />
          </button>
        </DialogPrimitive.Close>
      )}
      <DialogPrimitive.Content
        ref={setContentEl}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl border border-border bg-popover p-6 text-base text-popover-foreground shadow-2xl shadow-slate-950/15 duration-200 outline-none sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          // The keyboard and screen-reader path for the key rendered above:
          // inside the content, so it lives in Radix's focus trap and can be
          // tabbed to, but visually hidden so the tactile key is the only thing
          // seen. Esc dismisses either way.
          <DialogPrimitive.Close className="sr-only">Close</DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // No `pr-8` reserve any more — the close key moved outside the panel, so
      // the title gets the full width back.
      className={cn("font-heading text-xl font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "max-w-prose text-[15px] leading-relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

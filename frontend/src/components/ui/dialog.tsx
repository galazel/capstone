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

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      {showCloseButton && (
        // Deliberately a SIBLING of the content, not a child. 14 of the app's
        // dialogs set their own `overflow-y-auto` for long bodies, and a child
        // positioned outside the panel would be clipped away by that — the
        // dialog would render with no visible way to close it. As a sibling of
        // the content it is anchored to the viewport and can never be clipped.
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
            // `pointer-events-auto` is load-bearing: Radix puts
            // `pointer-events: none` on <body> for a modal dialog and only
            // re-enables it on the content, so a sibling inherits the block and
            // silently becomes unclickable. z-51 puts it over the overlay.
            className="pointer-events-auto fixed top-6 left-6 z-51 inline-flex size-14 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-[0_4px_0_var(--border)] transition-[transform,box-shadow,filter] duration-75 hover:brightness-[0.98] active:translate-y-1 active:shadow-none max-sm:top-4 max-sm:left-4 max-sm:size-12 motion-reduce:transition-none"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
        </DialogPrimitive.Close>
      )}
      <DialogPrimitive.Content
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

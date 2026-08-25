import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon, Bell, CheckCheck, ChevronRight, Loader2, Trash2 } from "@/components/icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotifications } from "@/hooks/use-notifications.js"

/* The clock time alone on the row, because the date is on the group heading
   above it. Every row carrying "Aug 17, 2026, 6:58 AM" spent a line of each
   notification restating the same date thirty times. */
function formatClock(value) {
  const date = new Date(value ?? "")
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(date)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function formatDayLabel(value) {
  const date = new Date(value ?? "")
  if (Number.isNaN(date.getTime())) return "Earlier"

  const now = new Date()
  const today = startOfDay(now)
  const day = startOfDay(date)

  /* Yesterday is built from the calendar, not by subtracting 24 hours: a clock
     change makes a local day 23 or 25 hours long, and on those two days a
     fixed 86,400,000 would miss -- labelling yesterday's notifications with a
     date while today's said "Today". `setDate(0)` rolls back across month and
     year boundaries on its own. */
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()

  if (day === today) return "Today"
  if (day === yesterday) return "Yesterday"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date)
}

/**
 * Consecutive runs of notifications from the same day.
 *
 * A run, not a bucket keyed by date: the list is already sorted newest-first,
 * so walking it keeps that order without a second sort, and an item with an
 * unparseable date falls into whatever run it is sitting in rather than being
 * collected into a stray "Earlier" group at the end.
 */
function groupByDay(items) {
  const groups = []

  for (const item of items) {
    const label = formatDayLabel(item.createdAt)
    const current = groups[groups.length - 1]

    if (current && current.label === label) {
      current.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return groups
}

/**
 * The full notification history for whoever is signed in -- one page shared by
 * the admin, institution, and learner portals, since the feed itself is
 * per-user rather than per-portal. The bell in every layout links here.
 */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const inbox = useNotifications()

  const items = [...inbox.items].sort(
    (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
  )
  const unreadCount = inbox.unreadCount
  const isLoading = inbox.isLoading
  const isError = inbox.isError
  const isMarkingAllRead = inbox.isMarkingAllRead
  const isRemovingAll = inbox.isRemovingAll

  const open = (item) => {
    inbox.open(item)
  }

  const remove = (item) => {
    inbox.remove(item.id)
  }

  const markAllRead = () => {
    if (inbox.unreadCount > 0) inbox.markAllRead()
  }

  const removeAll = () => {
    if (inbox.items.length > 0) inbox.removeAll()
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-6">
      {/* Back on its own line. It used to sit inside the title block, which
          pushed the title down while the actions stayed pinned to the top of
          the row -- so the two buttons lined up with the back link rather than
          with the heading they act on. */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length
              ? `${items.length} notification${items.length === 1 ? "" : "s"}${
                  unreadCount ? ` · ${unreadCount} unread` : ""
                }`
              : "Updates about your account will appear here."}
          </p>
        </div>

        {items.length ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead()}
              disabled={unreadCount === 0 || isMarkingAllRead}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearAll(true)}
              disabled={isRemovingAll}
              className="text-muted-foreground hover:text-destructive"
            >
              {isRemovingAll ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Clear all
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                Unable to load your notifications
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your connection and try again.
              </p>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invitations, partnership updates, and other account activity land here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Day groups, and hairlines instead of a bordered card. Thirty rows
             in one framed block is a wall; the headings break it into runs the
             eye can land in, and they are the reason each row now needs only a
             clock time. */
          <div className="space-y-8">
            {/* Keyed by position too: an item with an unreadable date labels
                its run "Earlier", and two of those can occur non-consecutively,
                which would collide on the label alone. */}
            {groupByDay(items).map((group, index) => (
              <section key={`${group.label}-${index}`}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>

                <ul className="divide-y divide-border">
                  {group.items.map((item) => (
                    <li
                      key={`${item.source ?? "inbox"}-${item.id}`}
                      className="group relative flex items-start"
                    >
                      {/* `pr-11` reserves the delete button's gutter, so the
                          timestamp column ends before it -- otherwise the
                          button faded in directly on top of the time. */}
                      <button
                        type="button"
                        onClick={() => open(item)}
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-4 pl-3 pr-11 text-left transition-colors hover:bg-accent"
                      >
                        {/* Unread as a dot on the icon, not a "New" badge after
                            the title: the badge sat in the text flow and moved
                            with every title length, so a column of them
                            zig-zagged down the page. */}
                        <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Bell className="size-4" aria-hidden="true" />
                          {item.read ? null : (
                            <span
                              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                              aria-hidden="true"
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          {/* Title and time on one line, the time hard right --
                              a fixed column to read down, rather than a third
                              line under every notification. */}
                          <span className="flex items-baseline gap-3">
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${
                                item.read
                                  ? "font-medium text-foreground"
                                  : "font-semibold text-foreground"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatClock(item.createdAt)}
                            </span>
                          </span>

                          {item.description ? (
                            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </span>

                        {item.href ? (
                          <ChevronRight
                            className="mt-1.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>

                      {/* Absolute, so the row's text does not reflow when the
                          button fades in on hover. */}
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        aria-label={`Delete notification: ${item.title}`}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} notification{items.length === 1 ? "" : "s"} will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeAll()
                setConfirmClearAll(false)
              }}
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

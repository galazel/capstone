import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context.jsx"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotifications } from "@/hooks/use-notifications.js"
import { useCommunityNotifications } from "@/hooks/use-community-notifications.js"

function formatTime(value) {
  if (!value) return "Recently"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

/**
 * The full notification history for whoever is signed in -- one page shared by
 * the admin, enterprise, and learner portals, since the feed itself is
 * per-user rather than per-portal. The bell in every layout links here.
 */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const inbox = useNotifications()
  // Learners have a second feed (community upvotes, replies, moderation) that
  // the bell already merges in. This page has to merge it too, or "Clear all"
  // empties the page while the bell still shows every community row -- which is
  // exactly what "delete all doesn't delete everything" looked like.
  const community = useCommunityNotifications({
    enabled: String(user?.role ?? "").toUpperCase() === "LEARNER",
  })

  const items = [...inbox.items, ...community.items].sort(
    (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
  )
  const unreadCount = inbox.unreadCount + community.unreadCount
  const isLoading = inbox.isLoading || community.isLoading
  const isError = inbox.isError
  const isMarkingAllRead = inbox.isMarkingAllRead
  const isRemovingAll = inbox.isRemovingAll || community.isRemovingAll

  // Every write is routed by `source`: the two feeds are separate tables whose
  // ids collide, so sending a community id to the inbox endpoint 404s.
  const open = (item) => {
    if (item.source === "community") {
      if (item.read === false) community.markRead(item.id)
      if (item.href) navigate(item.href)
      return
    }
    inbox.open(item)
  }

  const remove = (item) => {
    if (item.source === "community") {
      community.remove(item.id)
      return
    }
    inbox.remove(item.id)
  }

  const markAllRead = () => {
    if (inbox.unreadCount > 0) inbox.markAllRead()
    if (community.unreadCount > 0) community.markAllRead().catch(() => {})
  }

  const removeAll = () => {
    if (inbox.items.length > 0) inbox.removeAll()
    if (community.items.length > 0) community.removeAll().catch(() => {})
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 text-muted-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back
          </Button>
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

      <div className="mt-6">
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
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((item) => (
              <li
                key={`${item.source ?? "inbox"}-${item.id}`}
                className="group flex items-start gap-2"
              >
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={`flex min-w-0 flex-1 items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent ${
                    item.read ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      {item.read ? null : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          New
                        </Badge>
                      )}
                    </span>
                    {item.description ? (
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {formatTime(item.createdAt)}
                    </span>
                  </span>
                  {item.href ? (
                    <ChevronRight
                      className="mt-2 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Delete notification: ${item.title}`}
                  className="mr-2 mt-4 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
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

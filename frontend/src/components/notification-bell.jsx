import {
  Bell,
  CheckCheck,
  CheckCircle2,
  GraduationCap,
  Mail,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "@/components/icons"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const iconByType = {
  certification: GraduationCap,
  accepted: CheckCircle2,
  cancelled: XCircle,
  invitation: Mail,
}

// The notifications table has no `type` column -- these rows (assessment
// results, retakes, and the Phase 6 AI generation consumers) are told apart
// client-side by their title prefix instead.
const iconByTitlePrefix = [
  [/^Curriculum ready|^Questions ready/, Sparkles],
  [/^Generation failed/, XCircle],
  [/^Results ready/, GraduationCap],
  [/^Retake started/, RotateCcw],
]

function resolveIcon(item) {
  if (iconByType[item.type]) {
    return iconByType[item.type]
  }
  const match = iconByTitlePrefix.find(([pattern]) => pattern.test(item.title ?? ""))
  return match ? match[1] : Bell
}

function formatTime(value) {
  if (!value) return "Recently"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function NotificationBell({
  items = [],
  loading = false,
  emptyMessage,
  onItemOpen,
  onMarkAllRead,
  onDelete,
  unreadCount,
}) {
  const visibleItems = items.slice(0, 8)
  // The badge counts what is actually unread, not the size of the whole feed --
  // a read backlog should not keep showing as pending.
  const unread =
    typeof unreadCount === "number"
      ? unreadCount
      : items.filter((item) => item.read === false).length

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Open notifications${unread ? `, ${unread} unread` : ""}`}
              className="relative"
            >
              <Bell />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <span>Notifications</span>
          {onMarkAllRead && unread > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onMarkAllRead()
              }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Button asChild variant="outline" size="sm" className="h-8 w-full justify-center">
            <Link to="/notifications">
              View all notifications
              {items.length ? ` (${items.length})` : ""}
            </Link>
          </Button>
        </div>
        <DropdownMenuSeparator className="m-0" />

        {loading ? (
          <div className="space-y-3 p-4" aria-label="Loading notifications">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-5 py-9 text-center">
            <Bell className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {emptyMessage ?? "New updates will appear here."}
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto p-2">
            {visibleItems.map((item) => {
              const Icon = resolveIcon(item)
              return (
                <div
                  key={item.id}
                  className={`group flex items-start gap-1 rounded-lg transition-colors hover:bg-accent ${
                    item.read === false ? "bg-primary/5" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onItemOpen?.(item)}
                    className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left disabled:cursor-default"
                    disabled={!onItemOpen}
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-5">{item.title}</span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                  {onDelete && typeof item.id === "number" ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onDelete(item.id)
                      }}
                      aria-label={`Delete notification: ${item.title}`}
                      className="mr-1 mt-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {items.length > visibleItems.length ? (
          <>
            <DropdownMenuSeparator className="m-0" />
            <p className="px-4 py-2 text-center text-xs text-muted-foreground">
              Showing {visibleItems.length} of {items.length}
            </p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

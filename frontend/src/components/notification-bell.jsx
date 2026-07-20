import { Bell, CheckCircle2, GraduationCap, Mail, XCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

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

function formatTime(value) {
  if (!value) return "Recently"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function NotificationBell({ items = [], loading = false, emptyMessage, onItemOpen }) {
  const navigate = useNavigate()
  const visibleItems = items.slice(0, 8)

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Open notifications${items.length ? `, ${items.length} available` : ""}`}
              className="relative"
            >
              <Bell />
              {items.length > 0 ? (
                <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
                  {items.length > 9 ? "9+" : items.length}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80 p-0">
        <DropdownMenuLabel className="px-4 py-3">Notifications</DropdownMenuLabel>
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
              const Icon = iconByType[item.type] ?? Bell
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onItemOpen?.(item)
                    if (item.href) navigate(item.href)
                  }}
                  className={`flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent disabled:cursor-default ${
                    item.read === false ? "bg-primary/5" : ""
                  }`}
                  disabled={!item.href && !onItemOpen}
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
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

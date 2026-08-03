import * as React from "react"
import { MoonIcon, SunIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"

/** Shared between the icon button and the menu item, so the two can never
 *  disagree about which way the theme is currently set. */
function useIsDark() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = mounted
    ? theme === "dark" ||
      (theme === "system" && document.documentElement.classList.contains("dark"))
    : false

  return { isDark, toggle: () => setTheme(isDark ? "light" : "dark") }
}

/**
 * The theme switch as a row in the account menu.
 *
 * The portals used to spend a permanent header slot on this. Changing theme is
 * a once-a-session preference, not an action worth standing next to the
 * notification bell — it belongs with the other account settings.
 *
 * `onSelect` is prevented from closing the menu: switching theme with the menu
 * open lets you see the result and switch straight back if you don't like it.
 */
export function PortalThemeMenuItem() {
  const { isDark, toggle } = useIsDark()
  const label = isDark ? "Light mode" : "Dark mode"

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault()
        toggle()
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {label}
    </DropdownMenuItem>
  )
}

export function PortalThemeToggle() {
  const { isDark, toggle } = useIsDark()
  const label = isDark ? "Use light theme" : "Use dark theme"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={toggle}
        >
          {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

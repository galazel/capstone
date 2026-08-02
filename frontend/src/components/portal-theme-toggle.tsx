import * as React from "react"
import { MoonIcon, SunIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"

export function PortalThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const isDark = mounted
    ? theme === "dark" ||
      (theme === "system" && document.documentElement.classList.contains("dark"))
    : false

  React.useEffect(() => setMounted(true), [])

  const label = isDark ? "Use light theme" : "Use dark theme"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

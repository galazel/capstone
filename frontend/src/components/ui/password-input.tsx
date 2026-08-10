import * as React from "react"

import { Eye, EyeOffIcon } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Password field with a show/hide toggle.
 *
 * The toggle is skipped by Tab so it never sits between the password field
 * and the submit button; it stays labelled for screen readers and clickable.
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />

      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none disabled:pointer-events-none"
        disabled={props.disabled}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Sized up from shadcn's 18px rail to a real toggle: the thumb has room
        // to travel, and the 2px border ties it to the other controls.
        "peer inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-border p-0.5 transition-all outline-none data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:data-[state=unchecked]:bg-input/80",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-background shadow-[0_1px_0_rgb(0_0_0/0.12)] ring-0 transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

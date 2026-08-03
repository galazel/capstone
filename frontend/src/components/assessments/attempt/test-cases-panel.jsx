import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  EyeOffIcon,
  InfoIcon,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const TEST_STATUS_LABEL = {
  NOT_RUN: "Not run",
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
}

function TestRow({ test }) {
  const [open, setOpen] = useState(false)
  const canExpand = test.sample && test.input != null

  return (
    <li className="rounded-lg border">
      <button
        type="button"
        onClick={() => canExpand && setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
          canExpand ? "cursor-pointer" : "cursor-default"
        )}
        aria-expanded={canExpand ? open : undefined}
      >
        <span className="flex items-center gap-2">
          {canExpand ? (
            open ? (
              <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="size-4 shrink-0" aria-hidden="true" />
            )
          ) : (
            <EyeOffIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="font-medium">{test.label}</span>
          {test.sample ? (
            <Badge variant="secondary" className="text-[10px]">
              Sample
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Hidden
            </Badge>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleDashedIcon className="size-3.5" aria-hidden="true" />
          {TEST_STATUS_LABEL[test.status] ?? test.status}
        </span>
      </button>
      {canExpand && open ? (
        <div className="border-t px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
            {test.input}
          </pre>
        </div>
      ) : null}
    </li>
  )
}

// Right-panel "Tests" tab. Sample inputs are expandable; hidden cases show a
// label only and never expose expected output.
export default function TestCasesPanel({ tests, notice }) {
  const list = Array.isArray(tests) ? tests : []

  return (
    <div className="space-y-3">
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No test cases are attached to this item.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((test) => (
            <TestRow key={test.index} test={test} />
          ))}
        </ul>
      )}
    </div>
  )
}

import { useMemo, useRef } from "react"

import { cn } from "@/lib/utils"

/**
 * A one-time code, as one box per digit.
 *
 * <p>Backed by real inputs rather than a styled single field: the boxes have to
 * be individually focusable for the caret to land where the eye expects, and a
 * fake caret over a hidden input breaks selection, screen readers, and the
 * platform's own "from Messages" autofill.
 *
 * <p>Every affordance a code field is expected to have is handled here, because
 * each one is invisible until it is missing: typing advances, backspace on an
 * empty box steps back and clears, arrows move, and pasting a whole code from
 * an email fills the row instead of dropping five characters into box one.
 */
export function OtpInput({
  value = "",
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  id = "otp",
  label = "Verification code",
}) {
  const inputsRef = useRef([])

  const digits = useMemo(() => {
    const characters = String(value ?? "").slice(0, length).split("")
    return Array.from({ length }, (_, index) => characters[index] ?? "")
  }, [value, length])

  function focusBox(index) {
    const target = inputsRef.current[index]
    if (target) {
      target.focus()
      target.select()
    }
  }

  function commit(next) {
    const trimmed = next.slice(0, length)
    onChange?.(trimmed)

    if (trimmed.length === length) {
      onComplete?.(trimmed)
    }
  }

  function handleChange(index, raw) {
    const typed = raw.replace(/\D/g, "")
    if (!typed) return

    /* More than one digit means a paste (or a phone keyboard emitting the whole
       code into the focused box). Spread it across this box and the ones after
       rather than keeping the first and silently binning the rest. */
    const next = digits.slice()
    for (let offset = 0; offset < typed.length && index + offset < length; offset += 1) {
      next[index + offset] = typed[offset]
    }

    commit(next.join(""))
    focusBox(Math.min(index + typed.length, length - 1))
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace") {
      event.preventDefault()

      const next = digits.slice()
      if (next[index]) {
        // Clear this box and stay put: the digit under the caret is the one the
        // learner meant to delete.
        next[index] = ""
        commit(next.join(""))
        return
      }

      // Already empty, so backspace means "go back and delete that one".
      if (index > 0) {
        next[index - 1] = ""
        commit(next.join(""))
        focusBox(index - 1)
      }
      return
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      focusBox(index - 1)
      return
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  function handlePaste(index, event) {
    const pasted = event.clipboardData?.getData("text")?.replace(/\D/g, "")
    if (!pasted) return

    event.preventDefault()
    handleChange(index, pasted)
  }

  return (
    <div
      // A group rather than six unrelated boxes, so assistive tech announces
      // what this row of fields collectively is before reading any one of them.
      role="group"
      aria-label={label}
      className="flex items-center justify-between gap-2 sm:gap-3"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node
          }}
          id={index === 0 ? id : `${id}-${index}`}
          type="text"
          inputMode="numeric"
          // Only the first box claims the OTP hint: on every box, the platform
          // offers to autofill the whole code into each one in turn.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border-2 bg-card text-center text-xl font-semibold text-foreground",
            "transition-[border-color,box-shadow] outline-none",
            "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
              : "border-border hover:border-rb-hare"
          )}
        />
      ))}
    </div>
  )
}

export default OtpInput

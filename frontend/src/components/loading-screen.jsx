import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

// Original messages, restyled only — these cycle as the app boots.
const MESSAGES = [
  "Calculating your readiness...",
  "Syncing mastery progress...",
  "Leveling up your study plan...",
  "Loading your next challenge...",
]

export function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((current) => (current + 1) % MESSAGES.length)
    }, 1900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rebyu-ds flex min-h-svh flex-col items-center justify-center bg-rb-snow px-6">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Typographic monogram on a Polar disc — reads as an illustration
            rather than a logo dropped onto an empty page. */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative grid size-40 place-items-center"
        >
          <span className="absolute inset-0 rounded-full bg-rb-polar" aria-hidden="true" />
          <motion.span
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="relative grid size-20 place-items-center rounded-3xl bg-rb-feather shadow-[0_5px_0_var(--color-rb-feather-lip)]"
            aria-hidden="true"
          >
            <span className="font-rb-display text-4xl font-black lowercase leading-none text-rb-snow">
              r
            </span>
          </motion.span>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="mt-10 text-center text-lg font-semibold text-rb-wolf"
            role="status"
            aria-live="polite"
          >
            {MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="mt-8 h-4 w-full max-w-xs overflow-hidden rounded-full bg-rb-swan">
          <motion.div
            className="h-full w-1/3 rounded-full bg-rb-feather"
            animate={{ x: ["-110%", "330%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  )
}

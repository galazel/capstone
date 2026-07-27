import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BookOpenIcon, BrainIcon, FlameIcon, TrophyIcon } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo.tsx"

const MESSAGES = [
  "Calculating your readiness...",
  "Syncing mastery progress...",
  "Leveling up your study plan...",
  "Loading your next challenge...",
]

const BADGES = [
  { Icon: TrophyIcon, delay: 0 },
  { Icon: FlameIcon, delay: 0.15 },
  { Icon: BrainIcon, delay: 0.3 },
  { Icon: BookOpenIcon, delay: 0.45 },
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative flex items-center justify-center"
      >
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.15, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute size-24 rounded-full bg-primary/30 blur-xl"
          aria-hidden="true"
        />
        <BrandLogo className="relative size-16" />
      </motion.div>

      <div className="flex items-center gap-3" aria-hidden="true">
        {BADGES.map(({ Icon, delay }, index) => (
          <motion.div
            key={index}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay }}
            className="flex size-9 items-center justify-center rounded-full border bg-card text-primary shadow-sm"
          >
            <Icon className="size-4" />
          </motion.div>
        ))}
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

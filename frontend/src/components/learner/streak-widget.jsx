import { useGamification } from '@/hooks/useGamification'
import { Flame } from "@/components/icons"

export function StreakWidget() {
  const { streak, recordActivity } = useGamification()

  if (!streak) return null

  return (
    <section className="flex items-center gap-4 rounded-rb-card border-2 border-rb-fox/30 bg-rb-fox-wash p-6 dark:bg-[#3a2a12]">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-rb-fox">
        <Flame className="size-8 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-rb-fox-lip">Current Streak</p>
        <p className="font-rb-display text-3xl font-extrabold tracking-tight text-rb-eel dark:text-rb-snow">
          {streak.currentStreak || 0} days
        </p>
        <p className="text-xs font-semibold text-rb-fox-lip">Best: {streak.bestStreak || 0} days</p>
      </div>
      <button
        onClick={recordActivity}
        className="ml-auto rounded-xl bg-rb-fox px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
      >
        Record Activity
      </button>
    </section>
  )
}

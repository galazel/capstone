import { useGamification } from '@/hooks/useGamification'
import { Flame } from "@/components/icons"
import { Card } from '@/components/ui/card'

export function StreakWidget() {
  const { streak, recordActivity } = useGamification()

  if (!streak) return null

  return (
    <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 bg-orange-500 rounded-full">
          <Flame className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-sm text-slate-600">Current Streak</p>
          <p className="text-3xl font-bold text-orange-600">{streak.currentStreak || 0} days</p>
          <p className="text-xs text-slate-500">Best: {streak.bestStreak || 0} days</p>
        </div>
        <button
          onClick={recordActivity}
          className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
        >
          Record Activity
        </button>
      </div>
    </Card>
  )
}

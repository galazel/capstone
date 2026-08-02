import { useQuery } from '@tanstack/react-query'
import { TrendingUp, BookOpen, Target, Zap } from "@/components/icons"
import { getMyMastery } from '@/services/learnerAnalyticsService'
import { MasteryIndicator } from './mastery-indicator'
import { LearnerLoadingSkeleton, LearnerEmptyState } from './learner-ui'

/**
 * Mastery Summary Card - displays overall mastery statistics
 * Shows average mastery, mastery level counts, and study velocity
 */
export function MasterySummaryCard({ className = '' }) {
  const { data: mastery, isLoading } = useQuery({
    queryKey: ['myMastery'],
    queryFn: () => getMyMastery(),
  })

  if (isLoading) {
    return <LearnerLoadingSkeleton className="h-24" />
  }

  if (!mastery?.items || mastery.items.length === 0) {
    return (
      <LearnerEmptyState
        title="Start Learning"
        message="Take an assessment to track your mastery"
        className={className}
      />
    )
  }

  const avgMastery = mastery.average_mastery_probability
  const avgPercent = Math.round(avgMastery * 100)

  // Count items by level
  const levelCounts = {
    mastered: 0,
    good: 0,
    developing: 0,
    weak: 0,
  }

  mastery.items?.forEach((item) => {
    const level = item.mastery_level || 'weak'
    if (levelCounts.hasOwnProperty(level)) {
      levelCounts[level]++
    }
  })

  return (
    <div
      className={`rounded-lg border border-border bg-card p-6 shadow-sm ${className}`}
    >
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Overall Mastery
            </p>
            <h3 className="text-3xl font-bold text-foreground mt-1">
              {avgPercent}%
            </h3>
          </div>

          <div>
            <MasteryIndicator
              level={getMasteryLevel(avgMastery)}
              showLabel={false}
              size="lg"
            />
          </div>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(avgPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatItem
          icon={Target}
          label="Mastered"
          value={levelCounts.mastered}
          color="bg-green-100 dark:bg-green-950"
          textColor="text-green-700 dark:text-green-300"
        />
        <StatItem
          icon={TrendingUp}
          label="Good"
          value={levelCounts.good}
          color="bg-blue-100 dark:bg-blue-950"
          textColor="text-blue-700 dark:text-blue-300"
        />
        <StatItem
          icon={BookOpen}
          label="Learning"
          value={levelCounts.developing}
          color="bg-yellow-100 dark:bg-yellow-950"
          textColor="text-yellow-700 dark:text-yellow-300"
        />
        <StatItem
          icon={Zap}
          label="Started"
          value={levelCounts.weak}
          color="bg-red-100 dark:bg-red-950"
          textColor="text-red-700 dark:text-red-300"
        />
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {mastery.total} topics tracked • Updated regularly
        </p>
      </div>
    </div>
  )
}

function StatItem({ icon: Icon, label, value, color, textColor }) {
  return (
    <div
      className={`rounded-lg ${color} p-3 flex flex-col items-center justify-center text-center`}
    >
      <Icon className={`w-5 h-5 ${textColor} mb-1`} />
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      <p className={`text-xs ${textColor} opacity-80`}>{label}</p>
    </div>
  )
}

function getMasteryLevel(probability) {
  if (probability >= 0.8) return 4
  if (probability >= 0.6) return 3
  if (probability >= 0.4) return 2
  if (probability >= 0.2) return 1
  return 0
}

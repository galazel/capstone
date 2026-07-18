import { useQuery } from '@tanstack/react-query'
import { Award, TrendingUp, BookOpen, Target } from 'lucide-react'
import { getMyConfidence, getMyPriorities } from '@/services/learnerAnalyticsService'
import { MasteryIndicator } from './mastery-indicator'
import { PriorityTag } from './priority-tag'
import { LearnerLoadingSkeleton, LearnerEmptyState } from './learner-ui'

/**
 * Certification Mastery Panel - shows certification-level confidence and readiness
 */
export function CertificationMasteryPanel({ certificationId, className = '' }) {
  const { data: confidence, isLoading: confLoading } = useQuery({
    queryKey: ['confidence', certificationId],
    queryFn: () => getMyConfidence(certificationId),
    enabled: Boolean(certificationId),
  })

  const { data: priorities } = useQuery({
    queryKey: ['priorities', certificationId],
    queryFn: () => getMyPriorities(certificationId),
    enabled: Boolean(certificationId),
  })

  if (confLoading) {
    return <LearnerLoadingSkeleton className="h-40" />
  }

  if (!confidence) {
    return (
      <LearnerEmptyState
        title="No Data Yet"
        message="Complete assessments to see your certification readiness"
      />
    )
  }

  const overallPercent = Math.round(
    (confidence.overall_confidence || 0) * 100
  )
  const masteryLevel = getMasteryLevel(confidence.overall_confidence)
  const readinessPercent = Math.round(
    (confidence.ready_for_certification ? 100 : 50)
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Confidence */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Certification Confidence
            </p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {overallPercent}%
            </p>
          </div>
          <MasteryIndicator
            level={masteryLevel}
            showLabel={false}
            size="lg"
          />
        </div>

        <div className="space-y-2">
          <div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Overall Mastery</p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Award}
          label="Mastered"
          value={confidence.lessons_mastered || 0}
          color="text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Developing"
          value={confidence.lessons_developing || 0}
          color="text-blue-600"
        />
        <StatCard
          icon={BookOpen}
          label="Learning"
          value={confidence.lessons_weak || 0}
          color="text-yellow-600"
        />
        <StatCard
          icon={Target}
          label="Total Topics"
          value={confidence.total_lessons || 0}
          color="text-purple-600"
        />
      </div>

      {/* Readiness Status */}
      {confidence.ready_for_certification !== undefined && (
        <div
          className={`rounded-lg p-4 ${
            confidence.ready_for_certification
              ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-2 h-2 rounded-full mt-1 ${
                confidence.ready_for_certification
                  ? 'bg-green-600'
                  : 'bg-amber-600'
              }`}
            />
            <div>
              <p
                className={`font-semibold text-sm ${
                  confidence.ready_for_certification
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-amber-900 dark:text-amber-100'
                }`}
              >
                {confidence.ready_for_certification
                  ? '✅ Ready for Certification'
                  : '⏳ Continue Learning'}
              </p>
              <p
                className={`text-xs ${
                  confidence.ready_for_certification
                    ? 'text-green-700 dark:text-green-200'
                    : 'text-amber-700 dark:text-amber-200'
                }`}
              >
                {confidence.ready_for_certification
                  ? 'You have demonstrated mastery across most topics'
                  : 'Focus on critical areas to improve your readiness'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Priority Areas */}
      {priorities?.lessons && priorities.lessons.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">
            Focus Areas
          </p>
          <div className="space-y-2">
            {priorities.lessons.slice(0, 3).map((lesson) => (
              <div
                key={lesson.lesson_id}
                className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30 text-sm"
              >
                <span className="flex-1 truncate text-foreground">
                  {lesson.lesson_title}
                </span>
                {lesson.priority_tag && (
                  <PriorityTag tag={lesson.priority_tag} size="sm" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function getMasteryLevel(confidence) {
  if (confidence >= 0.8) return 4
  if (confidence >= 0.6) return 3
  if (confidence >= 0.4) return 2
  if (confidence >= 0.2) return 1
  return 0
}

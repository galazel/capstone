import { useQuery } from '@tanstack/react-query'
import { Award, TrendingUp, BookOpen, Target } from "@/components/icons"
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

  // getMyPriorities() returns a bare JSON array of lesson priorities, not an
  // object with a `.lessons` property.
  const { data: priorityLessons } = useQuery({
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

  // confidence_score arrives already scaled 0-100; average_mastery is 0-1.
  const overallPercent = Math.round(confidence.confidence_score || 0)
  const masteryLevel = getMasteryLevel(confidence.average_mastery || 0)

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
          value={confidence.mastered_count || 0}
          color="text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Developing"
          value={confidence.developing_count || 0}
          color="text-blue-600"
        />
        <StatCard
          icon={BookOpen}
          label="Learning"
          value={confidence.weak_count || 0}
          color="text-yellow-600"
        />
        <StatCard
          icon={Target}
          label="Total Topics"
          value={confidence.total_lessons || 0}
          color="text-purple-600"
        />
      </div>

      {/* Coverage: how much of the curriculum has been assessed at all */}
      {typeof confidence.coverage_percentage === 'number' && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">Curriculum Coverage</p>
            <p className="text-sm font-semibold text-foreground">
              {Math.round(confidence.coverage_percentage)}%
            </p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              style={{ width: `${Math.min(confidence.coverage_percentage, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {confidence.total_lessons || 0} of the curriculum's lessons assessed so far
          </p>
        </div>
      )}

      {/* Top Priority Areas */}
      {Array.isArray(priorityLessons) && priorityLessons.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">
            Focus Areas
          </p>
          <div className="space-y-2">
            {[...priorityLessons]
              .sort((a, b) => (b?.priority_score || 0) - (a?.priority_score || 0))
              .slice(0, 3)
              .map((lesson) => (
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

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, BookOpen, Zap } from 'lucide-react'
import { getCertificationPriorities } from '@/services/learnerAnalyticsService'
import { PriorityTag } from './priority-tag'
import { Button } from '@/components/ui/button'
import {
  LearnerLoadingSkeleton,
  LearnerEmptyState,
  LearnerErrorState,
} from './learner-ui'

/**
 * Study Recommendations component - shows priority-based lessons to study next
 * Displays top critical/high priority lessons with reasons and recommended actions
 */
export default function StudyRecommendations({
  certificationId,
  learnerId,
  maxItems = 3,
  className = '',
}) {
  const { data: hierarchy, isLoading, error } = useQuery({
    queryKey: ['priorities', certificationId, learnerId],
    queryFn: () => getCertificationPriorities(learnerId, certificationId),
    enabled: Boolean(learnerId && certificationId),
  })

  if (isLoading) {
    return <LearnerLoadingSkeleton className="h-32" />
  }

  if (error) {
    return (
      <LearnerErrorState
        title="Could not load recommendations"
        message="Please refresh the page or try again later."
        className={className}
      />
    )
  }

  // Flatten hierarchy and sort by priority
  const allLessons = hierarchy?.majorCategories
    ?.flatMap((major) =>
      major.middleCategories?.flatMap((middle) => middle.lessons || []) || []
    )
    ?.sort((a, b) => (b?.priorityScore || 0) - (a?.priorityScore || 0))

  const criticalLessons = allLessons?.slice(0, maxItems)

  if (!criticalLessons || criticalLessons.length === 0) {
    return (
      <LearnerEmptyState
        title="All caught up!"
        message="You're doing great. Keep practicing to improve your mastery."
        className={className}
      />
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-600" />
        <h3 className="font-semibold text-foreground">What to Study Next</h3>
      </div>

      <div className="space-y-2">
        {criticalLessons.map((lesson, index) => (
          <RecommendationCard
            key={lesson.lessonId || index}
            lesson={lesson}
            index={index}
          />
        ))}
      </div>

      {allLessons?.length > maxItems && (
        <p className="text-xs text-muted-foreground">
          +{allLessons.length - maxItems} more topics to review
        </p>
      )}
    </div>
  )
}

function RecommendationCard({ lesson, index }) {
  const masteryPercent = lesson.masteryProbability
    ? Math.round(lesson.masteryProbability * 100)
    : 0

  const getActivityIcon = (activity) => {
    if (!activity) return <BookOpen className="w-4 h-4" />
    if (activity.includes('INTERACTIVE')) return <BookOpen className="w-4 h-4" />
    if (activity.includes('QUIZ')) return <AlertCircle className="w-4 h-4" />
    return <BookOpen className="w-4 h-4" />
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              #{index + 1}
            </span>
            <h4 className="text-sm font-medium text-foreground truncate">
              {lesson.lessonTitle || 'Untitled Topic'}
            </h4>
          </div>
        </div>

        {lesson.priorityTag && (
          <PriorityTag tag={lesson.priorityTag} size="sm" />
        )}
      </div>

      {lesson.primaryReason && (
        <p className="text-xs leading-relaxed text-muted-foreground mb-2">
          {lesson.primaryReason}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(masteryPercent, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {masteryPercent}%
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            // TODO: Navigate to lesson or recommended activity
            console.log(`Start ${lesson.recommendedActivity} for lesson ${lesson.lessonId}`)
          }}
        >
          {getActivityIcon(lesson.recommendedActivity)}
          {lesson.recommendedActivity
            ? lesson.recommendedActivity.replace('_', ' ')
            : 'Start'}
        </Button>
      </div>
    </div>
  )
}

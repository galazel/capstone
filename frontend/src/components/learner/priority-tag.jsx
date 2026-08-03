import { AlertCircle, TrendingUp, Zap, BookOpen, CheckCircle, Clock } from "@/components/icons"

// Priority tags remapped onto the design system palette. Labels, icons and
// descriptions are unchanged — only the colours move onto the Rebyu ramp
// (Cardinal -> Fox -> Bee -> Macaw -> Feather) so priority reads as one scale.
export const PRIORITY_CONFIG = {
  CRITICAL_PRIORITY: {
    label: '🔴 Critical',
    bgColor: 'bg-rb-cardinal-wash',
    textColor: 'text-rb-cardinal-lip',
    icon: AlertCircle,
    description: 'Focus here first',
  },
  HIGH_PRIORITY: {
    label: '🟠 High Priority',
    bgColor: 'bg-rb-fox-wash',
    textColor: 'text-rb-fox-lip',
    icon: Zap,
    description: 'Important to review',
  },
  MEDIUM_PRIORITY: {
    label: '🟡 Medium',
    bgColor: 'bg-rb-bee-wash',
    textColor: 'text-[#8a6d00]',
    icon: BookOpen,
    description: 'Good to practice',
  },
  LOW_PRIORITY: {
    label: '🔵 Low',
    bgColor: 'bg-rb-macaw-wash',
    textColor: 'text-rb-macaw-lip',
    icon: TrendingUp,
    description: 'Optional review',
  },
  STRONG: {
    label: '✅ Strong',
    bgColor: 'bg-rb-feather-wash',
    textColor: 'text-[#3d6b06]',
    icon: CheckCircle,
    description: 'Well mastered',
  },
  ON_TRACK: {
    label: '⭐ On Track',
    bgColor: 'bg-rb-polar',
    textColor: 'text-rb-wolf',
    icon: Clock,
    description: 'Making good progress',
  },
  NOT_ENOUGH_DATA: {
    label: '❓ Insufficient Data',
    bgColor: 'bg-rb-polar',
    textColor: 'text-rb-hare',
    icon: Clock,
    description: 'Take more assessments',
  },
  NEEDS_REASSESSMENT: {
    label: '🔄 Reassess',
    bgColor: 'bg-rb-beetle-wash',
    textColor: 'text-rb-beetle-lip',
    icon: Clock,
    description: 'Assessment expired',
  },
}

export function PriorityTag({ tag, size = 'md', showDescription = false }) {
  if (!tag) return null

  const config = PRIORITY_CONFIG[tag]
  if (!config) return null

  const Icon = config.icon
  const sizeClass = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }[size] || 'px-3 py-1.5 text-sm'

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${config.bgColor} ${config.textColor} ${sizeClass} w-fit`}
      >
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
      {showDescription && (
        <p className="text-xs text-muted-foreground">{config.description}</p>
      )}
    </div>
  )
}

export function PriorityBadge({ tag, masteryPercentage }) {
  if (!tag) return null

  const config = PRIORITY_CONFIG[tag]
  if (!config) return null

  return (
    <div className={`rounded-md ${config.bgColor} ${config.textColor} px-2 py-1.5`}>
      <p className="text-xs font-semibold">{config.label}</p>
      {masteryPercentage !== undefined && (
        <p className="text-xs opacity-75">
          {Math.round(masteryPercentage * 100)}% mastered
        </p>
      )}
    </div>
  )
}

import { AlertCircle, TrendingUp, Zap, BookOpen, CheckCircle, Clock } from 'lucide-react'

export const PRIORITY_CONFIG = {
  CRITICAL: {
    label: '🔴 Critical',
    bgColor: 'bg-red-100 dark:bg-red-950',
    textColor: 'text-red-800 dark:text-red-300',
    icon: AlertCircle,
    description: 'Focus here first',
  },
  HIGH: {
    label: '🟠 High Priority',
    bgColor: 'bg-orange-100 dark:bg-orange-950',
    textColor: 'text-orange-800 dark:text-orange-300',
    icon: Zap,
    description: 'Important to review',
  },
  MEDIUM: {
    label: '🟡 Medium',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950',
    textColor: 'text-yellow-800 dark:text-yellow-300',
    icon: BookOpen,
    description: 'Good to practice',
  },
  LOW: {
    label: '🔵 Low',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-800 dark:text-blue-300',
    icon: TrendingUp,
    description: 'Optional review',
  },
  STRONG: {
    label: '✅ Strong',
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-800 dark:text-green-300',
    icon: CheckCircle,
    description: 'Well mastered',
  },
  ON_TRACK: {
    label: '⭐ On Track',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-800 dark:text-slate-300',
    icon: Clock,
    description: 'Making good progress',
  },
  NOT_ENOUGH_DATA: {
    label: '❓ Insufficient Data',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    icon: Clock,
    description: 'Take more assessments',
  },
  NEEDS_REASSESSMENT: {
    label: '🔄 Reassess',
    bgColor: 'bg-purple-100 dark:bg-purple-950',
    textColor: 'text-purple-800 dark:text-purple-300',
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

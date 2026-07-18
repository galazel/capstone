import { TrendingUp } from 'lucide-react'

const MASTERY_LEVELS = [
  { level: 0, label: 'Not Started', color: 'bg-gray-300', textColor: 'text-gray-700' },
  { level: 1, label: 'Familiarity', color: 'bg-yellow-400', textColor: 'text-yellow-700' },
  { level: 2, label: 'Beginning', color: 'bg-orange-400', textColor: 'text-orange-700' },
  { level: 3, label: 'Intermediate', color: 'bg-blue-400', textColor: 'text-blue-700' },
  { level: 4, label: 'Mastery', color: 'bg-green-500', textColor: 'text-green-700' },
]

export function MasteryIndicator({ level = 0, showLabel = true, size = 'md' }) {
  const config = MASTERY_LEVELS[Math.min(level, 4)]
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizes[size]} ${config.color} rounded-full flex items-center justify-center`}>
        <TrendingUp className="w-full h-full p-1 text-white" />
      </div>
      {showLabel && (
        <div>
          <p className="text-xs text-muted-foreground">Mastery</p>
          <p className={`text-sm font-semibold ${config.textColor}`}>{config.label}</p>
        </div>
      )}
    </div>
  )
}

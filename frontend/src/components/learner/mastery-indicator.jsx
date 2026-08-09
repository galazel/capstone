import { TrendingUp } from "@/components/icons"

const MASTERY_LEVELS = [
  { level: 0, label: 'Not Started', color: 'bg-muted-foreground/40', textColor: 'text-muted-foreground' },
  { level: 1, label: 'Familiarity', color: 'bg-rb-fox', textColor: 'text-rb-fox-lip' },
  { level: 2, label: 'Beginning', color: 'bg-rb-beetle', textColor: 'text-rb-beetle-lip' },
  { level: 3, label: 'Intermediate', color: 'bg-rb-feather', textColor: 'text-rb-feather-lip' },
  { level: 4, label: 'Mastery', color: 'bg-rb-bee', textColor: 'text-rb-bee-lip' },
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
